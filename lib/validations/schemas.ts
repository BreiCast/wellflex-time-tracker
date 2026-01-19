import { z } from 'zod'

export const clockInSchema = z.object({
  team_id: z.string().uuid(),
})

export const clockOutSchema = z.object({
  time_session_id: z.string().uuid(),
})

export const breakStartSchema = z.object({
  time_session_id: z.string().uuid(),
  break_type: z.enum(['BREAK', 'LUNCH']),
})

export const breakEndSchema = z.object({
  break_segment_id: z.string().uuid(),
})

export const createNoteSchema = z.object({
  time_session_id: z.string().uuid(),
  content: z.string().min(1),
})

export const createRequestSchema = z.object({
  team_id: z.string().uuid(),
  time_session_id: z.string().uuid().optional(),
  request_type: z.string().min(1),
  description: z.string().min(1),
  requested_data: z.record(z.any()).optional(),
})

export const reviewRequestSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  review_notes: z.string().optional(),
})

export const createAdjustmentSchema = z.object({
  request_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  team_id: z.string().uuid(),
  time_session_id: z.string().uuid().optional(),
  adjustment_type: z.enum(['ADD_TIME', 'SUBTRACT_TIME', 'OVERRIDE']),
  minutes: z.number().int(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
})

export const getTimesheetSchema = z.object({
  user_id: z.union([z.string().uuid(), z.literal('all')]).optional(),
  team_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

