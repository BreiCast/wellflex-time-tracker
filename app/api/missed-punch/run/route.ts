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

    // Find all RUNNING sessions older than threshold
    const { data: longRunningSessions } = await supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at')
      .is('clock_out_at', null)
      .lt('clock_in_at', thresholdTime.toISOString())

    if (!longRunningSessions || longRunningSessions.length === 0) {
      return NextResponse.json({
        success: true,
        flagged: 0,
        details: []
      })
    }

    const flagged: string[] = []
    const skipped: string[] = []

    for (const session of longRunningSessions) {
      // Check if flag already exists
      const { data: existingFlag } = await supabase
        .from('missed_punch_flags' as any)
        .select('id')
        .eq('time_session_id', session.id)
        .is('resolved_at', null)
        .maybeSingle()

      if (existingFlag) {
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
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
