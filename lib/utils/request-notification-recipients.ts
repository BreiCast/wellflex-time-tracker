import { createServiceSupabaseClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>

const LEGACY_OPS_INBOX = ['info@wellflex.co', 'breidercastro@icloud.com']

function mergeUniqueEmails(...groups: string[][]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    for (const raw of group) {
      const e = raw.trim()
      if (!e) continue
      const key = e.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
  }
  return out
}

/**
 * Emails that receive "new request" notifications: team managers/admins,
 * optional REQUEST_NOTIFICATION_EMAILS (comma-separated), plus legacy ops inboxes.
 */
export async function getRequestNotificationRecipientEmails(
  supabase: ServiceClient,
  teamId: string
): Promise<string[]> {
  const envList = (process.env.REQUEST_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  const { data: leaders } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .in('role', ['MANAGER', 'ADMIN'])

  const leaderIds = [...new Set((leaders || []).map((r: { user_id: string }) => r.user_id))]
  let leaderEmails: string[] = []
  if (leaderIds.length > 0) {
    const { data: users } = await supabase.from('users').select('email').in('id', leaderIds)
    leaderEmails = (users || [])
      .map((u: { email: string | null }) => (u.email || '').trim())
      .filter(Boolean)
  }

  return mergeUniqueEmails(LEGACY_OPS_INBOX, envList, leaderEmails)
}
