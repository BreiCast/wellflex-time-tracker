import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { sendReminderEmail } from '@/lib/utils/email-reminders'

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
    const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'

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

    // Get all users with notification preferences
    const { data: users } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        notification_preferences:notification_preferences (
          clock_in_reminders_enabled,
          clock_out_reminders_enabled,
          break_return_reminders_enabled,
          missed_punch_reminders_enabled,
          quiet_hours_start,
          quiet_hours_end,
          timezone
        )
      `) as any

    if (!users) {
      return NextResponse.json({ processed: 0, sent: 0 })
    }

    const now = new Date()
    const processed: string[] = []
    const sent: string[] = []
    const skipped: string[] = []

    for (const user of users) {
      const prefs = (user as any).notification_preferences?.[0]
      if (!prefs) {
        // Create default preferences
        await supabase
          .from('notification_preferences' as any)
          .insert({
            user_id: user.id,
            timezone: 'UTC'
          } as any)
        continue
      }

      // Check if in quiet hours
      const userTz = ((prefs as any)?.timezone || 'UTC') as string
      const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTz }))
      const quietStart = (((prefs as any)?.quiet_hours_start) || ((orgSettings as any)?.quiet_hours_start) || '22:00:00') as string
      const quietEnd = (((prefs as any)?.quiet_hours_end) || ((orgSettings as any)?.quiet_hours_end) || '06:00:00') as string

      const [startHour, startMin] = quietStart.split(':').map(Number)
      const [endHour, endMin] = quietEnd.split(':').map(Number)
      const quietStartTime = new Date(userNow)
      quietStartTime.setHours(startHour, startMin, 0, 0)
      const quietEndTime = new Date(userNow)
      quietEndTime.setHours(endHour, endMin, 0, 0)

      // Handle quiet hours that span midnight
      let inQuietHours = false
      if (quietStartTime <= quietEndTime) {
        inQuietHours = userNow >= quietStartTime && userNow <= quietEndTime
      } else {
        inQuietHours = userNow >= quietStartTime || userNow <= quietEndTime
      }

      if (inQuietHours) {
        skipped.push(`${user.email} (quiet hours)`)
        continue
      }

      // Get user's active session
      const { data: activeSession } = await supabase
        .from('time_sessions')
        .select('id, clock_in_at, team_id')
        .eq('user_id', user.id)
        .is('clock_out_at', null)
        .single()

      // Get user's active break
      let activeBreak = null
      if (activeSession) {
        const { data: breakData } = await supabase
          .from('break_segments')
          .select('id, break_start_at')
          .eq('time_session_id', activeSession.id)
          .is('break_end_at', null)
          .single()
        activeBreak = breakData
      }

      // Get user's schedule for today
      const dayOfWeek = userNow.getDay()
      const { data: todaySchedule } = await supabase
        .from('schedules')
        .select('start_time, end_time, break_expected_minutes')
        .eq('user_id', user.id)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single() as any

      // Check for recent notifications (cooldown)
      const cooldownMinutes = (orgSettings as any).reminder_cooldown_minutes || 60
      const cooldownCutoff = new Date(now.getTime() - cooldownMinutes * 60 * 1000)

      // 1. CLOCK_IN_REMINDER
      if ((prefs?.clock_in_reminders_enabled !== false) && !activeSession && todaySchedule) {
        const [startHour, startMin] = (todaySchedule as any).start_time.split(':').map(Number)
        const scheduledStart = new Date(userNow)
        scheduledStart.setHours(startHour, startMin, 0, 0)
        
        const reminderWindow = new Date(scheduledStart.getTime() + ((orgSettings as any).clock_in_reminder_window_minutes || 30) * 60 * 1000)
        
        if (userNow >= scheduledStart && userNow <= reminderWindow) {
          // Check cooldown
          const { data: recentNotification } = await supabase
            .from('notification_events' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'CLOCK_IN_REMINDER')
            .gte('created_at', cooldownCutoff.toISOString())
            .limit(1)
            .maybeSingle()

          if (!recentNotification) {
            processed.push(`${user.email}: CLOCK_IN_REMINDER`)
            
            if (!dryRun) {
              const sentResult = await sendReminderEmail({
                userEmail: user.email,
                userName: user.full_name || user.email,
                notificationType: 'CLOCK_IN_REMINDER',
                sessionInfo: null,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tracking`
              })

              await supabase
                .from('notification_events' as any)
                .insert({
                  user_id: user.id,
                  notification_type: 'CLOCK_IN_REMINDER',
                  status: sentResult.success ? 'SENT' : 'FAILED',
                  payload: {
                    scheduled_start: scheduledStart.toISOString(),
                    current_time: userNow.toISOString()
                  },
                  sent_at: sentResult.success ? new Date().toISOString() : null,
                  error_message: sentResult.error || null
                } as any)

              if (sentResult.success) {
                sent.push(`${user.email}: CLOCK_IN_REMINDER`)
              }
            } else {
              sent.push(`${user.email}: CLOCK_IN_REMINDER (dry run)`)
            }
          }
        }
      }

      // 2. CLOCK_OUT_REMINDER
      if ((prefs?.clock_out_reminders_enabled !== false) && activeSession && todaySchedule) {
        const [endHour, endMin] = (todaySchedule as any).end_time.split(':').map(Number)
        const scheduledEnd = new Date(userNow)
        scheduledEnd.setHours(endHour, endMin, 0, 0)
        
        const reminderBefore = new Date(scheduledEnd.getTime() - ((orgSettings as any).clock_out_reminder_before_minutes || 15) * 60 * 1000)
        const reminderAfter = new Date(scheduledEnd.getTime() + ((orgSettings as any).clock_out_reminder_after_minutes || 30) * 60 * 1000)
        
        const shouldRemind = (userNow >= reminderBefore && userNow <= scheduledEnd) || 
                            (userNow >= scheduledEnd && userNow <= reminderAfter)

        if (shouldRemind) {
          const { data: recentNotification } = await supabase
            .from('notification_events' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'CLOCK_OUT_REMINDER')
            .gte('created_at', cooldownCutoff.toISOString())
            .limit(1)
            .maybeSingle()

          if (!recentNotification) {
            processed.push(`${user.email}: CLOCK_OUT_REMINDER`)
            
            if (!dryRun) {
              const clockInTime = new Date(activeSession.clock_in_at)
              const sessionDuration = Math.floor((userNow.getTime() - clockInTime.getTime()) / (1000 * 60))
              
              const sentResult = await sendReminderEmail({
                userEmail: user.email,
                userName: user.full_name || user.email,
                notificationType: 'CLOCK_OUT_REMINDER',
                sessionInfo: {
                  clockInAt: activeSession.clock_in_at,
                  durationMinutes: sessionDuration
                },
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tracking`
              })

              await supabase
                .from('notification_events' as any)
                .insert({
                  user_id: user.id,
                  notification_type: 'CLOCK_OUT_REMINDER',
                  status: sentResult.success ? 'SENT' : 'FAILED',
                  payload: {
                    scheduled_end: scheduledEnd.toISOString(),
                    current_time: userNow.toISOString(),
                    session_id: activeSession.id
                  },
                  sent_at: sentResult.success ? new Date().toISOString() : null,
                  error_message: sentResult.error || null
                })

              if (sentResult.success) {
                sent.push(`${user.email}: CLOCK_OUT_REMINDER`)
              }
            } else {
              sent.push(`${user.email}: CLOCK_OUT_REMINDER (dry run)`)
            }
          }
        }
      }

      // 3. BREAK_RETURN_REMINDER
      if ((prefs?.break_return_reminders_enabled !== false) && activeBreak) {
        const breakStart = new Date(activeBreak.break_start_at)
        const breakDuration = Math.floor((userNow.getTime() - breakStart.getTime()) / (1000 * 60))
        
        if (breakDuration >= ((orgSettings as any).break_return_threshold_minutes || 30)) {
          const { data: recentNotification } = await supabase
            .from('notification_events' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'BREAK_RETURN_REMINDER')
            .gte('created_at', cooldownCutoff.toISOString())
            .limit(1)
            .maybeSingle()

          if (!recentNotification) {
            processed.push(`${user.email}: BREAK_RETURN_REMINDER`)
            
            if (!dryRun) {
              const sentResult = await sendReminderEmail({
                userEmail: user.email,
                userName: user.full_name || user.email,
                notificationType: 'BREAK_RETURN_REMINDER',
                sessionInfo: {
                  breakStartAt: activeBreak.break_start_at,
                  breakDurationMinutes: breakDuration
                },
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tracking`
              })

              await supabase
                .from('notification_events' as any)
                .insert({
                  user_id: user.id,
                  notification_type: 'BREAK_RETURN_REMINDER',
                  status: sentResult.success ? 'SENT' : 'FAILED',
                  payload: {
                    break_id: activeBreak.id,
                    break_duration_minutes: breakDuration
                  },
                  sent_at: sentResult.success ? new Date().toISOString() : null,
                  error_message: sentResult.error || null
                })

              if (sentResult.success) {
                sent.push(`${user.email}: BREAK_RETURN_REMINDER`)
              }
            } else {
              sent.push(`${user.email}: BREAK_RETURN_REMINDER (dry run)`)
            }
          }
        }
      }

      // 4. MISSED_PUNCH_REMINDER
      if ((prefs?.missed_punch_reminders_enabled !== false) && activeSession) {
        const clockInTime = new Date(activeSession.clock_in_at)
        const sessionDuration = Math.floor((userNow.getTime() - clockInTime.getTime()) / (1000 * 60))
        
        if (sessionDuration >= ((orgSettings as any).missed_punch_threshold_hours || 12) * 60) {
          const { data: recentNotification } = await supabase
            .from('notification_events' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('notification_type', 'MISSED_PUNCH_REMINDER')
            .gte('created_at', cooldownCutoff.toISOString())
            .limit(1)
            .maybeSingle()

          if (!recentNotification) {
            processed.push(`${user.email}: MISSED_PUNCH_REMINDER`)
            
            if (!dryRun) {
              const sentResult = await sendReminderEmail({
                userEmail: user.email,
                userName: user.full_name || user.email,
                notificationType: 'MISSED_PUNCH_REMINDER',
                sessionInfo: {
                  clockInAt: activeSession.clock_in_at,
                  durationMinutes: sessionDuration
                },
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/tracking`
              })

              await supabase
                .from('notification_events' as any)
                .insert({
                  user_id: user.id,
                  notification_type: 'MISSED_PUNCH_REMINDER',
                  status: sentResult.success ? 'SENT' : 'FAILED',
                  payload: {
                    session_id: activeSession.id,
                    session_duration_minutes: sessionDuration
                  },
                  sent_at: sentResult.success ? new Date().toISOString() : null,
                  error_message: sentResult.error || null
                })

              if (sentResult.success) {
                sent.push(`${user.email}: MISSED_PUNCH_REMINDER`)
              }
            } else {
              sent.push(`${user.email}: MISSED_PUNCH_REMINDER (dry run)`)
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processed.length,
      sent: sent.length,
      skipped: skipped.length,
      details: {
        processed,
        sent,
        skipped
      },
      dryRun
    })
  } catch (error: any) {
    console.error('[NOTIFICATIONS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
