import { describe, expect, it } from 'vitest'
import { isDesktopRequest, sanitizeUserAgentForLogs } from './access-guards'

describe('access guards', () => {
  it('allows desktop user agents', () => {
    const desktopUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    expect(isDesktopRequest(desktopUa)).toBe(true)
  })

  it('blocks common mobile and tablet user agents', () => {
    const iphoneUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const androidUa =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

    expect(isDesktopRequest(iphoneUa)).toBe(false)
    expect(isDesktopRequest(androidUa)).toBe(false)
  })

  it('defaults to allowing when user-agent is missing', () => {
    expect(isDesktopRequest(undefined)).toBe(true)
    expect(isDesktopRequest(null)).toBe(true)
    expect(isDesktopRequest('')).toBe(true)
  })

  it('sanitizes user agent for logs', () => {
    expect(sanitizeUserAgentForLogs(undefined)).toBe('unknown')
    const longUa = 'A'.repeat(500)
    expect(sanitizeUserAgentForLogs(longUa).length).toBe(160)
  })
})
