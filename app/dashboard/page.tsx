'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/CalendarView'
import GmailAlerts from '@/components/GmailAlerts'
import TaskBoard from '@/components/TaskBoard'
import { Calendar, Mail, CheckSquare, Clock, Dumbbell, Zap, TrendingUp } from 'lucide-react'

const SK_DAYS = ['Nedela', 'Pondelok', 'Utorok', 'Streda', 'Stvrtok', 'Piatok', 'Sobota']
const SK_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function getSkDate() {
  const d = new Date()
  return `${SK_DAYS[d.getDay()]}, ${d.getDate()}. ${SK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Mock stats — in future these will come from KV
const STATS = [
  { icon: Clock, label: 'Focus time dnes', value: '0 min', accent: 'text-orange-500', bg: 'bg-orange-500/10' },
  { icon: Dumbbell, label: 'Treningy tento tydzen', value: '0', accent: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: CheckSquare, label: 'Ulohy splnene', value: '0', accent: 'text-green-400', bg: 'bg-green-500/10' },
  { icon: Zap, label: 'Pomodoro rounds', value: '0', accent: 'text-yellow-400', bg: 'bg-yellow-500/10' },
]

export default function DashboardPage() {
  const [skDate, setSkDate] = useState('')
  const [isDark, setIsDark] = useState(true)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
    setSkDate(getSkDate())
    const stored = localStorage.getItem('sova-theme')
    setIsDark(stored !== 'light')
  }, [])

  const videoSrc = isDark ? '/anim-dark.mp4' : '/anim-light.mp4'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="dashboard" />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-6 space-y-8">

          {/* ── Hero section ── */}
          <div className="flex flex-col items-center text-center pt-4 pb-2">
            {/* Animation */}
            <div className="relative w-48 h-48 lg:w-56 lg:h-56 mb-6">
              <video
                key={videoSrc}
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onLoadedData={() => setVideoLoaded(true)}
                className={`w-full h-full object-cover rounded-3xl transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!videoLoaded && (
                <div className="absolute inset-0 rounded-3xl bg-muted animate-pulse" />
              )}
            </div>

            {/* Greeting */}
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-1">
              Ahoj, <span style={{ color: '#FF7F00' }}>Fondula!</span>
            </h1>
            <p className="text-muted-foreground text-sm">{skDate}</p>

            {/* Status pill */}
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-medium">Sona je aktivna a sleduje tvoj den</span>
            </div>
          </div>

          {/* ── Stats ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tvoje statistiky</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {STATS.map(({ icon: Icon, label, value, accent, bg }) => (
                <div
                  key={label}
                  className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-orange-500/30 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon size={15} className={accent} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Calendar – 2 cols */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={15} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dnesny kalendar</h2>
              </div>
              <CalendarView />
            </div>

            {/* Emails */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={15} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dolezite emaily</h2>
              </div>
              <GmailAlerts />
            </div>
          </div>

          {/* ── Tasks ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ulohy</h2>
            </div>
            <TaskBoard />
          </div>

        </div>
      </main>
    </div>
  )
}
