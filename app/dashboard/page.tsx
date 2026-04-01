'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import SovaChat from '@/components/SovaChat'
import CalendarView from '@/components/CalendarView'
import TaskBoard from '@/components/TaskBoard'
import GmailAlerts from '@/components/GmailAlerts'
import { Calendar, Plus, Loader2 } from 'lucide-react'

const SK_DAYS = ['nedela', 'pondelok', 'utorok', 'streda', 'stvrtok', 'piatok', 'sobota']
const SK_MONTHS = [
  'januara', 'februara', 'marca', 'aprila', 'maja', 'juna',
  'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra',
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Dobru noc'
  if (h < 12) return 'Dobre rano'
  if (h < 18) return 'Dobry den'
  return 'Dobry vecer'
}

function getSkDate() {
  const d = new Date()
  const day = SK_DAYS[d.getDay()]
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${d.getDate()}. ${SK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface QuickEventForm {
  title: string
  date: string
  time: string
}

export default function DashboardPage() {
  const [greeting, setGreeting] = useState('')
  const [skDate, setSkDate] = useState('')
  const [quickEvent, setQuickEvent] = useState<QuickEventForm>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
  })
  const [addingEvent, setAddingEvent] = useState(false)
  const [eventMsg, setEventMsg] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
    setSkDate(getSkDate())
  }, [])

  async function addToCalendar() {
    if (!quickEvent.title.trim()) return
    setAddingEvent(true)
    setEventMsg('')
    try {
      // NOTE: /api/calendar currently only supports GET.
      // When POST is implemented, this will send the event.
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: quickEvent.title,
          date: quickEvent.date,
          time: quickEvent.time,
        }),
      })
      if (res.ok) {
        setEventMsg('Udalost pridana!')
        setQuickEvent({ title: '', date: new Date().toISOString().split('T')[0], time: '09:00' })
      } else {
        setEventMsg('Pridanie zatial nie je aktivne (API GET only)')
      }
    } catch {
      setEventMsg('Pridanie zatial nie je aktivne (API GET only)')
    } finally {
      setAddingEvent(false)
      setTimeout(() => setEventMsg(''), 3000)
    }
  }

  return (
    <div className="flex h-screen dark:bg-[#0b114e] bg-gray-50 overflow-hidden">
      <Sidebar active="dashboard" />

      <main className="flex-1 overflow-auto">
        <div className="p-5 lg:p-7 space-y-6 max-w-7xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold gradient-text">
                {greeting}, Natka!
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{skDate}</p>
            </div>
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,127,0,0.1)', border: '1px solid rgba(255,127,0,0.2)' }}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">Sona aktivna</span>
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Chat – 2 cols */}
            <div className="lg:col-span-2 h-[560px]">
              <SovaChat />
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <GmailAlerts />
              <CalendarView />
            </div>
          </div>

          {/* ── Second row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Tasks – 2 cols */}
            <div className="lg:col-span-2">
              <TaskBoard />
            </div>

            {/* Quick add to calendar */}
            <div className="sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
              <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
                <Calendar size={15} className="text-orange-500" />
                <span className="text-sm font-semibold">Pridat do kalendara</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nazov udalosti</label>
                  <input
                    value={quickEvent.title}
                    onChange={(e) => setQuickEvent((q) => ({ ...q, title: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addToCalendar()}
                    placeholder="napr. Stretnutie s klientom"
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Datum</label>
                    <input
                      type="date"
                      value={quickEvent.date}
                      onChange={(e) => setQuickEvent((q) => ({ ...q, date: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Cas</label>
                    <input
                      type="time"
                      value={quickEvent.time}
                      onChange={(e) => setQuickEvent((q) => ({ ...q, time: e.target.value }))}
                      className="input"
                    />
                  </div>
                </div>
                <button
                  onClick={addToCalendar}
                  disabled={addingEvent || !quickEvent.title.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
                >
                  {addingEvent ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Pridat do kalendara
                </button>
                {eventMsg && (
                  <p className={`text-xs text-center ${eventMsg.includes('nie') ? 'text-muted-foreground' : 'text-green-500'}`}>
                    {eventMsg}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
