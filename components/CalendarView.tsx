'use client'

import { useState, useEffect } from 'react'
import { Dumbbell } from 'lucide-react'

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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[13px] font-normal text-foreground">Kalendar</span>
        <div className="flex gap-1">
          {(['today', 'tomorrow'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-2.5 py-1 rounded-lg text-[12px] font-normal transition-colors"
              style={
                tab === t
                  ? { background: 'rgba(255,255,255,0.08)', color: '#e8e8e8' }
                  : { color: '#666666' }
              }
            >
              {t === 'today' ? 'Dnes' : 'Zajtra'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-1.5 min-h-[120px]">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border border-border border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-[12px] font-light text-muted-foreground text-center py-6">Žiadne udalosti</p>
        ) : (
          events.map((ev) => {
            const isWorkout = WORKOUT_KW.some((kw) => ev.summary.toLowerCase().includes(kw))
            return (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderColor: isWorkout ? 'rgba(201,106,78,0.2)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <span className="text-[11px] font-light font-mono shrink-0 text-muted-foreground">
                  {ev.start}
                </span>
                <span className="flex-1 truncate text-[13px] font-normal text-foreground">{ev.summary}</span>
                {isWorkout && (
                  <Dumbbell size={12} strokeWidth={1.5} style={{ color: '#c96a4e', flexShrink: 0 }} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
