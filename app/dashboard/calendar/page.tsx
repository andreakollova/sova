'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/CalendarView'
import { CalendarDays, Plus, Loader2, Info } from 'lucide-react'

interface NewEvent {
  title: string
  date: string
  time: string
  duration: string
}

export default function CalendarPage() {
  const [form, setForm] = useState<NewEvent>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: '60',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    setMsg('')
    try {
      // NOTE: /api/calendar currently only supports GET.
      // POST support is planned – form is ready for when it becomes available.
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: form.title,
          date: form.date,
          time: form.time,
          durationMinutes: parseInt(form.duration),
        }),
      })
      if (res.ok) {
        setMsg('Udalost bola pridana do kalendara!')
        setForm({ title: '', date: new Date().toISOString().split('T')[0], time: '09:00', duration: '60' })
      } else {
        setMsg('Pridanie zatial nie je aktivne – API nepodporuje POST.')
      }
    } catch {
      setMsg('Pridanie zatial nie je aktivne – API nepodporuje POST.')
    } finally {
      setLoading(false)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  return (
    <div className="flex h-screen dark:bg-[#0b114e] bg-gray-50 overflow-hidden">
      <Sidebar active="calendar" />

      <main className="flex-1 overflow-auto p-5 lg:p-7">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold gradient-text">Kalendar</h1>
            <p className="text-muted-foreground text-sm mt-1">Prehlad udalosti a pridavanie novych</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Calendar view – 2 cols */}
            <div className="lg:col-span-2">
              <CalendarView />
            </div>

            {/* Add event form */}
            <div>
              <div className="sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-white/[0.07] border-gray-100"
                  style={{ background: 'linear-gradient(135deg, rgba(8,47,93,0.5), rgba(11,17,78,0.3))' }}
                >
                  <CalendarDays size={15} className="text-orange-500" />
                  <span className="text-sm font-semibold">Nova udalost</span>
                </div>

                <form onSubmit={submit} className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Nazov udalosti *</label>
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="napr. Meetup s timom"
                      className="input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Datum</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Cas</label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Trvanie (min)</label>
                      <select
                        value={form.duration}
                        onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                        className="input"
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">1 hodina</option>
                        <option value="90">1.5 hod</option>
                        <option value="120">2 hodiny</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !form.title.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Pridat do kalendara
                  </button>

                  {/* Status message */}
                  {msg && (
                    <div className={`flex items-start gap-2 p-3 rounded-xl text-xs
                      ${msg.includes('nie je') || msg.includes('nepodporuje')
                        ? 'dark:bg-blue-500/10 bg-blue-50 dark:text-blue-300 text-blue-600 dark:border-blue-500/20 border border-blue-200'
                        : 'dark:bg-green-500/10 bg-green-50 text-green-600 dark:text-green-400 dark:border-green-500/20 border border-green-200'
                      }`}
                    >
                      <Info size={12} className="mt-0.5 shrink-0" />
                      {msg}
                    </div>
                  )}
                </form>

                {/* Note */}
                <div className="px-4 pb-4">
                  <div className="flex items-start gap-2 p-3 rounded-xl dark:bg-white/[0.02] bg-gray-50 dark:border-white/[0.05] border border-gray-100">
                    <Info size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Udalosti mozete pridavat aj cez Sonu v chate – napisat: „pridaj tréning v piatok o 18:00"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
