import { describe, expect, it } from 'vitest'
import {
  calculateBreakDurationDifference,
  getAdjustmentTypeFromRequestType,
  getBreakAdjustmentType,
} from './request-helpers'
import { createRequestSchema } from '../validations/schemas'

describe('break/lunch adjustment logic', () => {
  it('subtracts work time when adjusted duration is longer (e.g. 1h -> 3h)', () => {
    expect(calculateBreakDurationDifference(60, 180)).toBe(-120)
    expect(getBreakAdjustmentType(60, 180)).toBe('SUBTRACT_TIME')
  })

  it('adds work time when adjusted duration is shorter (e.g. 3h -> 1h)', () => {
    expect(calculateBreakDurationDifference(180, 60)).toBe(120)
    expect(getBreakAdjustmentType(180, 60)).toBe('ADD_TIME')
  })

  it('classifies lunch adjustment requests as break/lunch adjustments for validation', () => {
    const parsed = createRequestSchema.parse({
      team_id: '11111111-1111-1111-1111-111111111111',
      request_type: 'Lunch Duration Adjustment',
      description: 'Lunch should be reduced',
      requested_data: {
        break_segment_id: '22222222-2222-2222-2222-222222222222',
        current_duration_minutes: 180,
        adjusted_duration_minutes: 60,
      },
    })

    expect(parsed.request_type).toBe('Lunch Duration Adjustment')
  })

  it('maps lunch adjustment request type to subtract by default when generic helper is used', () => {
    expect(getAdjustmentTypeFromRequestType('Lunch Duration Adjustment')).toBe('SUBTRACT_TIME')
  })
})
