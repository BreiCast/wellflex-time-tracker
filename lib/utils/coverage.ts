export interface CoverageSnapshot {
  working_count: number
  min_working_count: number | null
}

/**
 * Whether taking one more person off the floor (i.e. starting a break) would
 * leave the team at or below its configured minimum working count. Returns
 * false when no minimum is configured (null or <= 0).
 *
 * `working_count` is the number currently working (not on break), including the
 * person about to take a break — so `<=` min means dropping to/below the floor.
 */
export function wouldDropBelowMinimum(coverage: CoverageSnapshot): boolean {
  const min = coverage.min_working_count
  if (min == null || min <= 0) return false
  return coverage.working_count <= min
}
