import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { sendReminderEmail } from '@/lib/utils/email-reminders'

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecretHeader = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) return false
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '') === expectedSecret
  }
  return cronSecretHeader === expectedSecret
}

function getWindowBounds(windowType: 'daily' | 'weekly'): { start: Date; end: Date; label: string } {
  const now = new Date()
  if (windowType === 'daily') {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return {
      start,
      end,
      label: `${start.toLocaleDateString()} 00:00 - ${end.toLocaleDateString()} 23:59`,
    }
  }

  const end = new Date(now)
  end.setDate(end.getDate() - end.getDay())
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 7)
  const weeklyEnd = new Date(end.getTime() - 1)
  return {
    start,
    end: weeklyEnd,
    label: `${start.toLocaleDateString()} - ${weeklyEnd.toLocaleDateString()}`,
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceSupabaseClient()
    const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'
    const windowType = (request.nextUrl.searchParams.get('window') === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly'
    const bounds = getWindowBounds(windowType)

    const trackedTypes = ['LUNCH_NOT_ENDED_REMINDER', 'BREAK_NOT_ENDED_REMINDER', 'MISSED_PUNCH_REMINDER']

    const { data: events, error: eventsError } = await supabase
      .from('notification_events' as any)
      .select('id, user_id, notification_type, created_at, payload')
      .in('notification_type', trackedTypes as any)
      .eq('status', 'SENT')
      .gte('created_at', bounds.start.toISOString())
      .lte('created_at', bounds.end.toISOString()) as any

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 400 })
    }

    const lunchCount = (events || []).filter((e: any) => e.notification_type === 'LUNCH_NOT_ENDED_REMINDER').length
    const breakCount = (events || []).filter((e: any) => e.notification_type === 'BREAK_NOT_ENDED_REMINDER').length
    const missedCount = (events || []).filter((e: any) => e.notification_type === 'MISSED_PUNCH_REMINDER').length

    const affectedUsers = new Set<string>()
    for (const event of events || []) {
      affectedUsers.add((event as any).payload?.source_user_id || event.user_id)
    }

    const summaryLines = [
      `Lunch reminders sent: ${lunchCount}`,
      `Break reminders sent: ${breakCount}`,
      `Missed clock-out reminders sent: ${missedCount}`,
      `Unique affected employees: ${affectedUsers.size}`,
    ]

    const { data: adminTeamMembers } = await supabase
      .from('team_members')
      .select('user_id, role')
      .in('role', ['MANAGER', 'ADMIN']) as any

    const recipientIds: string[] = [
      ...new Set(
        ((adminTeamMembers ?? []) as { user_id: string }[])
          .map((tm) => tm.user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ]
    if (recipientIds.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        window: windowType,
        recipients: 0,
        emailsSent: 0,
        summaryLines,
      })
    }

    const { data: recipients } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', recipientIds) as any

    let emailsSent = 0
    const notificationType = windowType === 'weekly' ? 'ADMIN_WEEKLY_ATTENDANCE_REPORT' : 'ADMIN_DAILY_ATTENDANCE_REPORT'

    for (const recipient of recipients || []) {
      if (!recipient.email) continue

      if (!dryRun) {
        const sentResult = await sendReminderEmail({
          userEmail: recipient.email,
          userName: recipient.full_name || recipient.email,
          notificationType,
          sessionInfo: null,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin`,
          reportData: {
            windowLabel: bounds.label,
            summaryLines,
          },
        })

        await supabase
          .from('notification_events' as any)
          .insert({
            user_id: recipient.id,
            notification_type: notificationType,
            status: sentResult.success ? 'SENT' : 'FAILED',
            payload: {
              window_type: windowType,
              window_start: bounds.start.toISOString(),
              window_end: bounds.end.toISOString(),
              summary: summaryLines,
            },
            sent_at: sentResult.success ? new Date().toISOString() : null,
            error_message: sentResult.error || null,
          } as any)

        if (sentResult.success) emailsSent += 1
      } else {
        emailsSent += 1
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      window: windowType,
      recipients: (recipients || []).length,
      emailsSent,
      summaryLines,
      period: {
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[NOTIFICATION-REPORT] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
