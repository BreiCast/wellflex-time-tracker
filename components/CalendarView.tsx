'use client'

import { useState } from 'react'
import { formatMinutes } from '@/lib/utils/timesheet'
import { toColombiaDateKey } from '@/lib/utils/date'

interface CalendarViewProps {
  entries: any[]
  currentDate: Date
  onDateClick?: (date: string) => void
  periodView?: 'month' | 'week'
  weekStart?: Date
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function CalendarView({ entries, currentDate, onDateClick, periodView = 'month', weekStart }: CalendarViewProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)

  // "Today" in Colombia time, so the highlight doesn't shift to tomorrow in the
  // evening (when UTC has already rolled over).
  const todayKey = toColombiaDateKey(new Date().toISOString())

  const getEntryByDate = (dateStr: string) => entries.find((e: any) => e.date === dateStr)

  const isWeekMode = periodView === 'week' && weekStart

  const weekDays = isWeekMode ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (isWeekMode && weekStart) {
    const weekDates: { dateStr: string; dayNum: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      weekDates.push({
        dateStr: toDateStr(d),
        dayNum: d.getDate()
      })
    }

    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weekDates.map(({ dateStr, dayNum }) => {
            const entry = getEntryByDate(dateStr)
            const isToday = todayKey === dateStr
            const dayOfWeek = new Date(dateStr).getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            return (
              <div
                key={dateStr}
                className={`h-32 border-b border-r border-slate-100 p-2 transition-all duration-200 relative group cursor-pointer
                  ${isWeekend ? 'bg-slate-50/30' : 'bg-white'}
                  ${isToday ? 'ring-2 ring-indigo-500 ring-inset z-10' : 'hover:bg-slate-50'}
                `}
                onMouseEnter={() => setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => onDateClick?.(dateStr)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {dayNum}
                  </span>
                  {entry && entry.workMinutes > 0 && (
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">
                      {formatMinutes(entry.workMinutes)}
                    </span>
                  )}
                </div>
                {entry ? (
                  <div className="space-y-1 overflow-hidden">
                    {entry.clockIn && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                        {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {entry.clockOut && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-rose-400"></div>
                        {new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {entry.breakMinutes > 0 && (
                      <div className="text-[10px] text-amber-600 font-medium">
                        Break: {formatMinutes(entry.breakMinutes)}
                      </div>
                    )}
                    {entry.adjustments.length > 0 && (
                      <div className="text-[10px] text-indigo-600 font-medium truncate">
                        Adj: {entry.adjustments.length}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Month view
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const getEntryForDay = (day: number) => {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    return getEntryByDate(dateStr)
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-32 border-b border-r border-slate-100 bg-slate-50/30" />
          }

          const entry = getEntryForDay(day)
          const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
          const isToday = todayKey === dateStr
          const isWeekend = (firstDayOfMonth + day - 1) % 7 === 0 || (firstDayOfMonth + day - 1) % 7 === 6

          return (
            <div
              key={day}
              className={`h-32 border-b border-r border-slate-100 p-2 transition-all duration-200 relative group cursor-pointer
                ${isWeekend ? 'bg-slate-50/30' : 'bg-white'}
                ${isToday ? 'ring-2 ring-indigo-500 ring-inset z-10' : 'hover:bg-slate-50'}
              `}
              onMouseEnter={() => setHoveredDate(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => onDateClick?.(dateStr)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {day}
                </span>
                {entry && entry.workMinutes > 0 && (
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase">
                    {formatMinutes(entry.workMinutes)}
                  </span>
                )}
              </div>

              {entry ? (
                <div className="space-y-1 overflow-hidden">
                  {entry.clockIn && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                      {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {entry.clockOut && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-rose-400"></div>
                      {new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {entry.breakMinutes > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium">
                      Break: {formatMinutes(entry.breakMinutes)}
                    </div>
                  )}
                  {entry.adjustments.length > 0 && (
                    <div className="text-[10px] text-indigo-600 font-medium truncate">
                      Adj: {entry.adjustments.length}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="p-1 rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                   </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

