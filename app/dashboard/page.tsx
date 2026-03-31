'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import SovaChat from '@/components/SovaChat'
import CalendarView from '@/components/CalendarView'
import TaskBoard from '@/components/TaskBoard'
import GmailAlerts from '@/components/GmailAlerts'

export default function DashboardPage() {
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Dobré ráno')
    else if (hour < 18) setGreeting('Dobrý deň')
    else setGreeting('Dobrý večer')
  }, [])

  return (
    <div className="flex h-screen bg-[#0A0614] overflow-hidden">
      <Sidebar active="dashboard" />

      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold gradient-text">{greeting}, Natka!</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {new Date().toLocaleDateString('sk-SK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-purple-300">Soňa je online</span>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat – takes 2 cols */}
            <div className="lg:col-span-2 h-[580px]">
              <SovaChat />
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <GmailAlerts />
              <CalendarView />
            </div>
          </div>

          {/* Tasks */}
          <TaskBoard />
        </div>
      </main>
    </div>
  )
}
