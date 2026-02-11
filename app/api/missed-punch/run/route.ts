import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { verifyCronBearerToken } from '@/lib/utils/cron-auth'
import { CRON_JOBS, recordCronRun } from '@/lib/utils/cron-monitor'

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  const supabase = createServiceSupabaseClient()

  try {
    // Verify cron secret
    if (!verifyCronBearerToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get organization settings
    const { data: orgSettings } = await supabase
      .from('organization_settings' as any)
      .select('*')
      .single()

    if (!orgSettings) {
      await recordCronRun(supabase as any, {
        jobName: CRON_JOBS.missedPunch,
        status: 'FAILED',
        startedAt,
        errorMessage: 'Organization settings not found'
      })

      return NextResponse.json(
        { error: 'Organization settings not found' },
        { status: 500 }
      )
    }

    const thresholdHours = (orgSettings as any).missed_punch_threshold_hours || 12
    const thresholdMs = thresholdHours * 60 * 60 * 1000
    const now = new Date()
    const thresholdTime = new Date(now.getTime() - thresholdMs)

    const startTime = Date.now()
    // Find all RUNNING sessions older than threshold - uses partial index
    const { data: longRunningSessions } = await supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at')
      .is('clock_out_at', null) // Uses idx_time_sessions_running partial index
      .lt('clock_in_at', thresholdTime.toISOString())
      .order('clock_in_at', { ascending: true }) // Process oldest first
      .limit(100) // Limit batch size to prevent overload

    const queryTime = Date.now() - startTime
    console.log(`[PERF] Missed-punch scan: ${queryTime}ms, found ${longRunningSessions?.length || 0} sessions`)

    if (!longRunningSessions || longRunningSessions.length === 0) {
      await recordCronRun(supabase as any, {
        jobName: CRON_JOBS.missedPunch,
        status: 'SUCCESS',
        startedAt,
        details: { flagged: 0, skipped: 0 }
      })

      return NextResponse.json({
        success: true,
        flagged: 0,
        details: []
      })
    }

    // Batch check for existing flags to reduce queries
    const sessionIds = longRunningSessions.map(s => s.id)
    const { data: existingFlags } = await supabase
      .from('missed_punch_flags' as any)
      .select('time_session_id')
      .in('time_session_id', sessionIds)
      .is('resolved_at', null)
    
    const flaggedSessionIds = new Set((existingFlags || []).map((f: any) => f.time_session_id))

    const flagged: string[] = []
    const skipped: string[] = []

    for (const session of longRunningSessions) {
      // Check if flag already exists (from batch query)
      if (flaggedSessionIds.has(session.id)) {
        skipped.push(`Session ${session.id} already flagged`)
        continue
      }

      // Get user's schedule for the day of clock_in
      const clockInDate = new Date(session.clock_in_at)
      const dayOfWeek = clockInDate.getDay()
      
      const { data: schedule } = await supabase
        .from('schedules')
        .select('end_time')
        .eq('user_id', session.user_id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single()

      let flagReason = `Session running longer than ${thresholdHours} hours`
      
      // If schedule exists, check if past end time
      if (schedule) {
        const [endHour, endMin] = schedule.end_time.split(':').map(Number)
        const scheduledEnd = new Date(clockInDate)
        scheduledEnd.setHours(endHour, endMin, 0, 0)
        
        if (now > scheduledEnd) {
          flagReason = `Session past scheduled end time (${schedule.end_time})`
        }
      }

      // Create missed punch flag
      const { error: flagError } = await supabase
        .from('missed_punch_flags' as any)
        .insert({
          user_id: session.user_id,
          time_session_id: session.id,
          team_id: session.team_id,
          flag_reason: flagReason
        })

      if (flagError) {
        console.error(`[MISSED-PUNCH] Failed to flag session ${session.id}:`, flagError)
        skipped.push(`Session ${session.id}: ${flagError.message}`)
      } else {
        flagged.push(`Session ${session.id} (User: ${session.user_id})`)
      }
    }

    const totalTime = Date.now() - startTime
    console.log(`[PERF] Missed-punch complete: ${totalTime}ms, flagged=${flagged.length}, skipped=${skipped.length}`)

    await recordCronRun(supabase as any, {
      jobName: CRON_JOBS.missedPunch,
      status: 'SUCCESS',
      startedAt,
      details: {
        flagged: flagged.length,
        skipped: skipped.length
      }
    })

    return NextResponse.json({
      success: true,
      flagged: flagged.length,
      skipped: skipped.length,
      details: {
        flagged,
        skipped
      }
    })
  } catch (error: any) {
    console.error('[MISSED-PUNCH] Error:', error)

    await recordCronRun(supabase as any, {
      jobName: CRON_JOBS.missedPunch,
      status: 'FAILED',
      startedAt,
      errorMessage: error.message || 'Internal server error'
    })

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
