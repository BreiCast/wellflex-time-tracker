import { Database } from '@/types/database'

type TimeSession = Database['public']['Tables']['time_sessions']['Row']
type BreakSegment = Database['public']['Tables']['break_segments']['Row']
type Adjustment = Database['public']['Tables']['adjustments']['Row']

export interface TimesheetEntry {
  date: string
  clockIn: string | null
  clockOut: string | null
  totalMinutes: number
  breakMinutes: number
  workMinutes: number
  adjustments: Adjustment[]
  adjustedMinutes: number
}

export function calculateTimesheet(
  sessions: TimeSession[],
  breaks: BreakSegment[],
  adjustments: Adjustment[],
  startDate: Date,
  endDate: Date
): TimesheetEntry[] {
  const entries: Map<string, TimesheetEntry> = new Map()

  // Initialize entries for date range
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    entries.set(dateKey, {
      date: dateKey,
      clockIn: null,
      clockOut: null,
      totalMinutes: 0,
      breakMinutes: 0,
      workMinutes: 0,
      adjustments: [],
      adjustedMinutes: 0,
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Process sessions
  for (const session of sessions) {
    const sessionDate = new Date(session.clock_in_at)
    const dateKey = sessionDate.toISOString().split('T')[0]
    
    if (entries.has(dateKey)) {
      const entry = entries.get(dateKey)!
      if (!entry.clockIn || sessionDate < new Date(entry.clockIn)) {
        entry.clockIn = session.clock_in_at
      }
      
      if (session.clock_out_at) {
        const clockOutDate = new Date(session.clock_out_at)
        if (!entry.clockOut || clockOutDate > new Date(entry.clockOut)) {
          entry.clockOut = session.clock_out_at
        }
        
        // Calculate total minutes for this session
        const sessionMinutes = Math.floor(
          (clockOutDate.getTime() - sessionDate.getTime()) / (1000 * 60)
        )
        entry.totalMinutes += sessionMinutes
      }
    }
  }

  // Process breaks
  for (const breakSegment of breaks) {
    if (!breakSegment.break_end_at) continue
    
    const breakStart = new Date(breakSegment.break_start_at)
    const breakEnd = new Date(breakSegment.break_end_at)
    const dateKey = breakStart.toISOString().split('T')[0]
    
    if (entries.has(dateKey)) {
      const entry = entries.get(dateKey)!
      const breakMinutes = Math.floor(
        (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60)
      )
      entry.breakMinutes += breakMinutes
    }
  }

  // Process adjustments
  for (const adjustment of adjustments) {
    const adjustmentDate = new Date(adjustment.effective_date)
    const dateKey = adjustmentDate.toISOString().split('T')[0]
    
    if (entries.has(dateKey)) {
      const entry = entries.get(dateKey)!
      entry.adjustments.push(adjustment)
      
      switch (adjustment.adjustment_type) {
        case 'ADD_TIME':
          entry.adjustedMinutes += adjustment.minutes
          break
        case 'SUBTRACT_TIME':
          entry.adjustedMinutes -= adjustment.minutes
          break
        case 'OVERRIDE':
          entry.adjustedMinutes = adjustment.minutes - entry.workMinutes
          break
      }
    }
  }

  // Calculate work minutes (total - breaks + adjustments)
  for (const entry of entries.values()) {
    entry.workMinutes = entry.totalMinutes - entry.breakMinutes + entry.adjustedMinutes
  }

  return Array.from(entries.values()).sort((a, b) => 
    a.date.localeCompare(b.date)
  )
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60)
  const mins = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${hours}:${mins.toString().padStart(2, '0')}`
}

