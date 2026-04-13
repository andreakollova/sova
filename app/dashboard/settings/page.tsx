'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { Bell, Mail, User, Clock, Plus, X, Save, Dumbbell, Hash } from 'lucide-react'

interface UserSettings {
  morningTime: string
  eveningTime: string
  watchedEmails: string[]
  discordChannelId: string
  userName: string
  userEmail: string
  timezone: string
  morningBriefingTime: string
  eveningBriefingTime: string
  workoutTypes: string[]
  workoutDays: string[]
  discordKamoskaId: string
  discordAdminId: string
}

const WORKOUT_OPTIONS = [
  { id: 'beh', label: 'Beh' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'hokej', label: 'Hokej' },
  { id: 'plavanie', label: 'Plávanie' },
  { id: 'joga', label: 'Jóga' },
  { id: 'inne', label: 'Iné' },
]

const DAY_LABELS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa']
const DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DEFAULT_SETTINGS: UserSettings = {
  morningTime: '08:30',
  eveningTime: '20:00',
  watchedEmails: [],
  discordChannelId: '',
  userName: 'Natka',
  userEmail: '',
  timezone: 'Europe/Bratislava',
  morningBriefingTime: '08:00',
  eveningBriefingTime: '20:00',
  workoutTypes: [],
  workoutDays: [],
  discordKamoskaId: '',
  discordAdminId: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(console.error)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  function addEmail() {
    if (newEmail && !settings.watchedEmails.includes(newEmail.trim())) {
      setSettings((s) => ({ ...s, watchedEmails: [...s.watchedEmails, newEmail.trim()] }))
      setNewEmail('')
    }
  }

  function removeEmail(email: string) {
    setSettings((s) => ({ ...s, watchedEmails: s.watchedEmails.filter((e) => e !== email) }))
  }

  function toggleWorkoutType(type: string) {
    setSettings((s) => ({
      ...s,
      workoutTypes: s.workoutTypes.includes(type)
        ? s.workoutTypes.filter((t) => t !== type)
        : [...s.workoutTypes, type],
    }))
  }

  function toggleWorkoutDay(day: string) {
    setSettings((s) => ({
      ...s,
      workoutDays: s.workoutDays.includes(day)
        ? s.workoutDays.filter((d) => d !== day)
        : [...s.workoutDays, day],
    }))
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="settings" />

      <main className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-[680px] mx-auto space-y-5">

          {/* Header */}
          <div>
            <h1 className="text-[22px] font-normal text-foreground">Nastavenia</h1>
            <p className="text-[13px] font-light text-muted-foreground mt-1">
              Prispôsob si Soňu podľa seba
            </p>
          </div>

          {/* ── Profil ── */}
          <Section title="Profil" icon={<User size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Meno">
                <input
                  value={settings.userName}
                  onChange={(e) => setSettings((s) => ({ ...s, userName: e.target.value }))}
                  placeholder="Tvoje meno"
                  className="input"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={settings.userEmail || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, userEmail: e.target.value }))}
                  placeholder="tvoj@email.com"
                  className="input"
                />
              </Field>
            </div>
          </Section>

          {/* ── Moj rezim ── */}
          <Section title="Môj režim" icon={<Clock size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Ráno vstávam">
                <input
                  type="time"
                  value={settings.morningTime}
                  onChange={(e) => setSettings((s) => ({ ...s, morningTime: e.target.value }))}
                  className="input"
                />
              </Field>
              <Field label="Večer chodím spať">
                <input
                  type="time"
                  value={settings.eveningTime}
                  onChange={(e) => setSettings((s) => ({ ...s, eveningTime: e.target.value }))}
                  className="input"
                />
              </Field>
              <Field label="Časová zóna">
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                  className="input"
                >
                  <option value="Europe/Bratislava">Europe/Bratislava</option>
                  <option value="Europe/Prague">Europe/Prague</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="UTC">UTC</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Cvicenie ── */}
          <Section title="Cvičenie" icon={<Dumbbell size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <Field label="Typy cvičenia">
              <div className="flex flex-wrap gap-2 mt-1">
                {WORKOUT_OPTIONS.map(({ id, label }) => {
                  const isActive = settings.workoutTypes.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleWorkoutType(id)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-normal border transition-all"
                      style={
                        isActive
                          ? { background: '#c96a4e', color: '#ffffff', borderColor: 'transparent' }
                          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#aaaaaa' }
                      }
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Typické dni cvičenia">
              <div className="flex flex-wrap gap-2 mt-1">
                {DAY_IDS.map((id, idx) => {
                  const isActive = settings.workoutDays.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleWorkoutDay(id)}
                      className="w-10 h-10 rounded-lg text-[12px] font-normal border transition-all"
                      style={
                        isActive
                          ? { background: '#c96a4e', color: '#ffffff', borderColor: 'transparent' }
                          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#aaaaaa' }
                      }
                    >
                      {DAY_LABELS[idx].slice(0, 2)}
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          {/* ── Sledovane emaily ── */}
          <Section title="Sledované emailové adresy" icon={<Mail size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <div className="space-y-1.5 mb-3">
              {settings.watchedEmails.length === 0 && (
                <p className="text-[12px] font-light text-muted-foreground">Zatiaľ žiadne sledované adresy</p>
              )}
              {settings.watchedEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="text-[13px] font-light text-foreground">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                placeholder="novy@email.com"
                className="input flex-1"
              />
              <button
                onClick={addEmail}
                className="btn-primary px-3 py-2 flex items-center justify-center"
              >
                <Plus size={14} strokeWidth={1.5} />
              </button>
            </div>
          </Section>

          {/* ── Discord ── */}
          <Section title="Discord kanály" icon={<Hash size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <div className="space-y-3">
              <Field label="Hlavný kanál (kde Soňa píše tebe)">
                <input
                  value={settings.discordChannelId}
                  onChange={(e) => setSettings((s) => ({ ...s, discordChannelId: e.target.value }))}
                  placeholder="#sova-main – Channel ID"
                  className="input"
                />
              </Field>
              <Field label="#sova-kamoska – kanál kamosky">
                <input
                  value={settings.discordKamoskaId || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, discordKamoskaId: e.target.value }))}
                  placeholder="Channel ID"
                  className="input"
                />
              </Field>
              <Field label="#admin-sona – súkromný admin kanál">
                <input
                  value={settings.discordAdminId || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, discordAdminId: e.target.value }))}
                  placeholder="Channel ID"
                  className="input"
                />
              </Field>
            </div>
            <p className="text-[11px] font-light text-muted-foreground mt-2">
              Pravý klik na kanál v Discorde → Copy Channel ID (zapni Developer Mode)
            </p>
          </Section>

          {/* ── Notifikacie ── */}
          <Section title="Notifikácie" icon={<Bell size={14} strokeWidth={1.5} className="text-muted-foreground" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ranné zhrnutie">
                <input
                  type="time"
                  value={settings.morningBriefingTime}
                  onChange={(e) => setSettings((s) => ({ ...s, morningBriefingTime: e.target.value }))}
                  className="input"
                />
              </Field>
              <Field label="Večerné zhrnutie">
                <input
                  type="time"
                  value={settings.eveningBriefingTime}
                  onChange={(e) => setSettings((s) => ({ ...s, eveningBriefingTime: e.target.value }))}
                  className="input"
                />
              </Field>
            </div>
          </Section>

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            <Save size={14} strokeWidth={1.5} />
            {saving ? 'Ukladám...' : saved ? 'Uložené!' : 'Uložiť nastavenia'}
          </button>

        </div>
      </main>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5 space-y-4 border"
      style={{
        background: 'hsl(var(--card))',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <div
        className="flex items-center gap-2 pb-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {icon}
        <h2 className="text-[13px] font-normal text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-light text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
