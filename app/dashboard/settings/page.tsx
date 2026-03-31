'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { Settings, Bell, Mail, User, Clock, Plus, X, Save } from 'lucide-react'

interface UserSettings {
  morningTime: string
  eveningTime: string
  watchedEmails: string[]
  discordChannelId: string
  userName: string
  timezone: string
}

export default function SettingsPage() {
  const [adminChannelId, setAdminChannelId] = useState('')
  const [kamoskaChannelId, setKamoskaChannelId] = useState('')
  const [settings, setSettings] = useState<UserSettings>({
    morningTime: '08:30',
    eveningTime: '20:00',
    watchedEmails: [],
    discordChannelId: '',
    userName: 'Natka',
    timezone: 'Europe/Bratislava',
  })
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
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
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  function addEmail() {
    if (newEmail && !settings.watchedEmails.includes(newEmail)) {
      setSettings((s) => ({ ...s, watchedEmails: [...s.watchedEmails, newEmail.trim()] }))
      setNewEmail('')
    }
  }

  function removeEmail(email: string) {
    setSettings((s) => ({ ...s, watchedEmails: s.watchedEmails.filter((e) => e !== email) }))
  }

  return (
    <div className="flex h-screen bg-[#0A0614] overflow-hidden">
      <Sidebar active="settings" />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Nastavenia</h1>
            <p className="text-muted-foreground text-sm mt-1">Prispôsob si Soňu podľa seba</p>
          </div>

          {/* Personal */}
          <Card title="Osobné" icon={<User size={16} className="text-purple-400" />}>
            <Field label="Tvoje meno">
              <input
                value={settings.userName}
                onChange={(e) => setSettings((s) => ({ ...s, userName: e.target.value }))}
                className="input"
              />
            </Field>
          </Card>

          {/* Notifications */}
          <Card title="Notifikácie" icon={<Bell size={16} className="text-purple-400" />}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ranné zhrnutie">
                <input
                  type="time"
                  value={settings.morningTime}
                  onChange={(e) => setSettings((s) => ({ ...s, morningTime: e.target.value }))}
                  className="input"
                />
              </Field>
              <Field label="Večerné zhrnutie">
                <input
                  type="time"
                  value={settings.eveningTime}
                  onChange={(e) => setSettings((s) => ({ ...s, eveningTime: e.target.value }))}
                  className="input"
                />
              </Field>
            </div>
          </Card>

          {/* Discord */}
          <Card title="Discord Kanály" icon={<Bell size={16} className="text-indigo-400" />}>
            <Field label="Hlavný kanál (kde Soňa píše tebe)">
              <input
                value={settings.discordChannelId}
                onChange={(e) => setSettings((s) => ({ ...s, discordChannelId: e.target.value }))}
                placeholder="#sova-main channel ID"
                className="input"
              />
            </Field>
            <Field label="#sova-kamoska – kanál kamoškky">
              <input
                value={kamoskaChannelId}
                onChange={(e) => setKamoskaChannelId(e.target.value)}
                placeholder="Channel ID"
                className="input"
              />
            </Field>
            <Field label="#admin-sona – súkromný admin kanál">
              <input
                value={adminChannelId}
                onChange={(e) => setAdminChannelId(e.target.value)}
                placeholder="Channel ID"
                className="input"
              />
            </Field>
            <p className="text-xs text-muted-foreground mt-1">
              Pravý klik na kanál v Discorde → Copy Channel ID (zapni Developer Mode)
            </p>
          </Card>

          {/* Watched emails */}
          <Card title="Sledované emailové adresy" icon={<Mail size={16} className="text-purple-400" />}>
            <div className="space-y-2 mb-3">
              {settings.watchedEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="text-sm">{email}</span>
                  <button onClick={() => removeEmail(email)} className="text-muted-foreground hover:text-red-400 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                placeholder="nový@email.com"
                className="input flex-1"
              />
              <button onClick={addEmail} className="btn-secondary px-3">
                <Plus size={16} />
              </button>
            </div>
          </Card>

          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={16} />
            {saving ? 'Ukladám...' : saved ? 'Uložené!' : 'Uložiť nastavenia'}
          </button>
        </div>
      </main>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sova-border rounded-2xl p-5 bg-white/[0.03] space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
