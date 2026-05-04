const MOBILE_USER_AGENT_REGEX = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i

export function isDesktopRequest(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true
  return !MOBILE_USER_AGENT_REGEX.test(userAgent)
}

export function sanitizeUserAgentForLogs(userAgent: string | null | undefined): string {
  if (!userAgent) return 'unknown'
  return userAgent.slice(0, 160)
}
