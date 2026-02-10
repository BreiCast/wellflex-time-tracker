/**
 * Compute the start and end of "today" in ISO strings, adjusted for a given
 * UTC offset so that "today" matches the viewer's local calendar day.
 *
 * @param offsetMinutes UTC offset in minutes (e.g. -300 for EST, 60 for CET).
 *                      When omitted or 0, uses UTC.
 */
export function getTodayBounds(offsetMinutes: number = 0): { start: string; end: string } {
  const now = new Date()

  // Shift "now" by the offset so UTC date parts give the local calendar date
  const adjusted = new Date(now.getTime() + offsetMinutes * 60 * 1000)

  const y = adjusted.getUTCFullYear()
  const m = adjusted.getUTCMonth()
  const d = adjusted.getUTCDate()

  // Start of that calendar day in the given timezone, as a UTC instant
  const startMs = Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  // End = start + 24h - 1ms
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}
