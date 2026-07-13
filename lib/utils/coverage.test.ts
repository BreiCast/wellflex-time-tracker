import { describe, it, expect } from 'vitest'
import { wouldDropBelowMinimum } from './coverage'

describe('wouldDropBelowMinimum', () => {
  it('warns when working count is at or below the minimum', () => {
    expect(wouldDropBelowMinimum({ working_count: 2, min_working_count: 2 })).toBe(true)
    expect(wouldDropBelowMinimum({ working_count: 1, min_working_count: 2 })).toBe(true)
  })

  it('does not warn when comfortably above the minimum', () => {
    expect(wouldDropBelowMinimum({ working_count: 5, min_working_count: 2 })).toBe(false)
    expect(wouldDropBelowMinimum({ working_count: 3, min_working_count: 2 })).toBe(false)
  })

  it('does not warn when no minimum is configured', () => {
    expect(wouldDropBelowMinimum({ working_count: 0, min_working_count: null })).toBe(false)
    expect(wouldDropBelowMinimum({ working_count: 0, min_working_count: 0 })).toBe(false)
  })
})
