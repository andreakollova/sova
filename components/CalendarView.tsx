'use client'

import { useState, useEffect } from 'react'
import { Calendar, Dumbbell } from 'lucide-react'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
}

const WORKOUT_KW = ['trening', 'tréning', 'workout', 'gym', 'beh', 'plavanie', 'joga', 'yoga']

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
    <div className="sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-orange-500" />
          <span className="text-sm font-medium">Kalendar</span>
        </div>
        <div className="flex gap-1">
          {(['today', 'tomorrow'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                ${tab === t
                  ? 'text-white'
                  : 'text-muted-foreground dark:hover:text-white hover:text-gray-700'}`}
              style={tab === t ? { background: 'linear-gradient(135deg, #FF7F00, #e06000)' } : {}}
            >
              {t === 'today' ? 'Dnes' : 'Zajtra'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2 min-h-[120px]">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Ziadne udalosti</p>
        ) : (
          events.map((ev) => {
            const isWorkout = WORKOUT_KW.some((kw) => ev.summary.toLowerCase().includes(kw))
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm
                  ${isWorkout
                    ? 'bg-orange-500/10 border-orange-500/20'
                    : 'dark:bg-white/[0.03] dark:border-white/[0.07] bg-gray-50 border-gray-100'}`}
              >
                <span className={`text-[11px] font-mono shrink-0 ${isWorkout ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {ev.start}
                </span>
                <span className="flex-1 truncate text-sm">{ev.summary}</span>
                {isWorkout && <Dumbbell size={12} className="text-orange-500 shrink-0" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
