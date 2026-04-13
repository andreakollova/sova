'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/CalendarView'
import { Plus, Loader2, Info } from 'lucide-react'

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
        setMsg('Udalosť bola pridaná do kalendára!')
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
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="calendar" />

      <main className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-[900px] mx-auto space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-[22px] font-normal text-foreground">Kalendár</h1>
            <p className="text-[13px] font-light text-muted-foreground mt-1">
              Prehľad udalostí a pridávanie nových
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Calendar view – 2 cols */}
            <div className="lg:col-span-2">
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Udalosti
              </p>
              <CalendarView />
            </div>

            {/* Add event form */}
            <div>
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Nová udalosť
              </p>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <form onSubmit={submit} className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-light text-muted-foreground">Názov udalosti</label>
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="napr. Meetup s tímom"
                      className="input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-light text-muted-foreground">Dátum</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-light text-muted-foreground">Čas</label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-light text-muted-foreground">Trvanie (min)</label>
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
                    {loading ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : <Plus size={14} strokeWidth={1.5} />}
                    Pridat do kalendara
                  </button>

                  {msg && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-lg text-[12px] font-light border"
                      style={{
                        background: msg.includes('nie je') || msg.includes('nepodporuje')
                          ? 'rgba(96,165,250,0.08)'
                          : 'rgba(74,222,128,0.08)',
                        borderColor: msg.includes('nie je') || msg.includes('nepodporuje')
                          ? 'rgba(96,165,250,0.15)'
                          : 'rgba(74,222,128,0.15)',
                        color: msg.includes('nie je') || msg.includes('nepodporuje')
                          ? '#93c5fd'
                          : '#86efac',
                      }}
                    >
                      <Info size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                      {msg}
                    </div>
                  )}
                </form>

                <div className="px-4 pb-4">
                  <div
                    className="flex items-start gap-2 p-3 rounded-lg border"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderColor: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Info size={11} strokeWidth={1.5} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[11px] font-light text-muted-foreground leading-relaxed">
                      Udalosti môžete pridávať aj cez Soňu v chate – napíšte: „pridaj tréning v piatok o 18:00"
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
