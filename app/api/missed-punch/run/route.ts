import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

// Verify CRON_SECRET
function verifyCronSecret(request: NextRequest): boolean {
  // Check Authorization header (Vercel Cron standard) or x-cron-secret header
  const authHeader = request.headers.get('authorization')
  const cronSecretHeader = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET
  
  if (!expectedSecret) return false
  
  // Vercel Cron sends: Authorization: Bearer <secret>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    return token === expectedSecret
  }
  
  // Fallback to custom header
  return cronSecretHeader === expectedSecret
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()

    // Get organization settings
    const { data: orgSettings } = await supabase
      .from('organization_settings' as any)
      .select('*')
      .single()

    if (!orgSettings) {
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
    const autoClockedOut: string[] = []
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

      const autoClockOutAt = new Date(new Date(session.clock_in_at).getTime() + thresholdMs).toISOString()

      // Create missed punch flag
      const { error: flagError } = await supabase
        .from('missed_punch_flags' as any)
        .insert({
          user_id: session.user_id,
          time_session_id: session.id,
          team_id: session.team_id,
          flag_reason: `${flagReason} (auto clock-out applied at ${autoClockOutAt})`
        })

      if (flagError) {
        console.error(`[MISSED-PUNCH] Failed to flag session ${session.id}:`, flagError)
        skipped.push(`Session ${session.id}: ${flagError.message}`)
        continue
      }

      // End any active break segment at the same auto clock-out timestamp
      const { error: breakEndError } = await supabase
        .from('break_segments')
        .update({ break_end_at: autoClockOutAt })
        .eq('time_session_id', session.id)
        .is('break_end_at', null)

      if (breakEndError) {
        console.error(`[MISSED-PUNCH] Failed to end break for session ${session.id}:`, breakEndError)
        skipped.push(`Session ${session.id}: ${breakEndError.message}`)
        continue
      }

      // Auto clock out the time session
      const { error: clockOutError } = await supabase
        .from('time_sessions')
        .update({ clock_out_at: autoClockOutAt })
        .eq('id', session.id)
        .is('clock_out_at', null)

      if (clockOutError) {
        console.error(`[MISSED-PUNCH] Failed to auto clock out session ${session.id}:`, clockOutError)
        skipped.push(`Session ${session.id}: ${clockOutError.message}`)
        continue
      }

      const noteContent = `[Auto Clock-Out] Session automatically clocked out after ${thresholdHours} hours to prevent an open shift.`
      const { error: noteError } = await supabase
        .from('notes')
        .insert({
          time_session_id: session.id,
          content: noteContent,
          created_by: session.user_id,
        })

      if (noteError) {
        console.error(`[MISSED-PUNCH] Failed to create note for session ${session.id}:`, noteError)
        skipped.push(`Session ${session.id}: note creation failed (${noteError.message})`)
      }

      flagged.push(`Session ${session.id} (User: ${session.user_id})`)
      autoClockedOut.push(`Session ${session.id} auto clocked out at ${autoClockOutAt}`)
    }

    const totalTime = Date.now() - startTime
    console.log(`[PERF] Missed-punch complete: ${totalTime}ms, flagged=${flagged.length}, autoClockedOut=${autoClockedOut.length}, skipped=${skipped.length}`)

    return NextResponse.json({
      success: true,
      flagged: flagged.length,
      autoClockedOut: autoClockedOut.length,
      skipped: skipped.length,
      details: {
        flagged,
        autoClockedOut,
        skipped
      }
    })
  } catch (error: any) {
    console.error('[MISSED-PUNCH] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
