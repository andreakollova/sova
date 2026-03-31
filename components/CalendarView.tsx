'use client'

import { useState, useEffect } from 'react'
import { Calendar, ChevronRight, Dumbbell } from 'lucide-react'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
}

const WORKOUT_KW = ['tréning', 'trening', 'workout', 'gym', 'beh', 'plávanie', 'jóga', 'yoga']

export default function CalendarView() {
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([])
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/calendar?range=today').then((r) => r.json()),
      fetch('/api/calendar?range=tomorrow').then((r) => r.json()),
    ])
      .then(([today, tomorrow]) => {
        setTodayEvents(Array.isArray(today) ? today : [])
        setTomorrowEvents(Array.isArray(tomorrow) ? tomorrow : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const events = tab === 'today' ? todayEvents : tomorrowEvents

  return (
    <div className="sova-border rounded-2xl bg-[#0D0920] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-purple-400" />
          <span className="text-sm font-medium">Kalendár</span>
        </div>
        <div className="flex gap-1">
          {(['today', 'tomorrow'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors
                ${tab === t ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'today' ? 'Dnes' : 'Zajtra'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2 min-h-[120px]">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Žiadne udalosti</p>
        ) : (
          events.map((ev) => {
            const isWorkout = WORKOUT_KW.some((kw) => ev.summary.toLowerCase().includes(kw))
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm
                  ${isWorkout
                    ? 'bg-orange-500/10 border-orange-500/20'
                    : 'bg-white/[0.03] border-white/[0.06]'}`}
              >
                <span className={`text-[11px] font-mono shrink-0 ${isWorkout ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {ev.start}
                </span>
                <span className="flex-1 truncate">{ev.summary}</span>
                {isWorkout && <Dumbbell size={12} className="text-orange-400 shrink-0" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
