'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/CalendarView'
import GmailAlerts from '@/components/GmailAlerts'
import TaskBoard from '@/components/TaskBoard'
import { Clock, Dumbbell, CheckSquare, Zap } from 'lucide-react'

const SK_DAYS = ['Nedela', 'Pondelok', 'Utorok', 'Streda', 'Stvrtok', 'Piatok', 'Sobota']
const SK_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function getSkDate() {
  const d = new Date()
  return `${SK_DAYS[d.getDay()]}, ${d.getDate()}. ${SK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const STATS = [
  { icon: Clock, label: 'Focus time dnes', value: '0 min' },
  { icon: Dumbbell, label: 'Treningy tento tydzen', value: '0' },
  { icon: CheckSquare, label: 'Ulohy splnene', value: '0' },
  { icon: Zap, label: 'Pomodoro rounds', value: '0' },
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
        <div className="max-w-[900px] mx-auto px-8 py-8 space-y-8">

          {/* ── Hero ── */}
          <div className="flex flex-col items-center text-center pt-2 pb-2">
            <div className="relative w-[120px] h-[120px] mb-5 rounded-2xl overflow-hidden">
              <video
                key={videoSrc}
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onLoadedData={() => setVideoLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!videoLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse rounded-2xl" />
              )}
            </div>

            <h1 className="text-[28px] font-normal text-foreground mb-1">
              Ahoj, Fondula
            </h1>
            <p className="text-[12px] font-light" style={{ color: '#555555' }}>{skDate}</p>
          </div>

          {/* ── Stats ── */}
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
              Statistiky
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {STATS.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
                >
                  <Icon size={15} className="text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-[22px] font-normal text-foreground leading-none">{value}</p>
                    <p className="text-[11px] font-light text-muted-foreground mt-1">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Calendar – 2 cols */}
            <div className="lg:col-span-2">
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Dnesny kalendar
              </p>
              <CalendarView />
            </div>

            {/* Emails */}
            <div>
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Dolezite emaily
              </p>
              <GmailAlerts />
            </div>
          </div>

          {/* ── Tasks ── */}
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
              Ulohy
            </p>
            <TaskBoard />
          </div>

        </div>
      </main>
    </div>
  )
}
