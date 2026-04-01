'use client'

import { useState, useEffect } from 'react'
import { Lock, Send, Clock, CheckCircle, Heart } from 'lucide-react'

interface AdminInstruction {
  id: string
  text: string
  receivedAt: string
  timeSensitive: boolean
  emotionalTone: boolean
  deliveredAt?: string
  deliveredIn?: string
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<AdminInstruction[]>([])
  const [delivered, setDelivered] = useState<AdminInstruction[]>([])
  const [newInstruction, setNewInstruction] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'pending' | 'delivered'>('pending')

  function login() {
    fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setAuthed(true)
          sessionStorage.setItem('sova_admin', password)
          loadData()
        } else {
          setError('Nespravne heslo')
        }
      })
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('sova_admin')
    if (saved) {
      setPassword(saved)
      setAuthed(true)
      loadData()
    }
  }, [])

  function loadData() {
    const pwd = sessionStorage.getItem('sova_admin') || password
    const headers = { 'x-admin-password': pwd }
    fetch('/api/admin/instructions', { headers })
      .then((r) => r.json())
      .then((d) => {
        setPending(d.pending ?? [])
        setDelivered(d.delivered ?? [])
      })
  }

  async function sendInstruction() {
    if (!newInstruction.trim()) return
    setSending(true)
    try {
      const pwd = sessionStorage.getItem('sova_admin') || password
      await fetch('/api/admin/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pwd },
        body: JSON.stringify({ text: newInstruction }),
      })
      setNewInstruction('')
      loadData()
    } finally {
      setSending(false)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen dark:bg-[#0b114e] bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-sm p-6 sova-border rounded-2xl dark:bg-[#0a1050] bg-white space-y-4 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={18} className="text-orange-500" />
            <h1 className="font-bold">Admin Panel</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Heslo..."
            className="input w-full"
            autoFocus
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={login} className="btn-primary w-full py-2.5">
            Vstupid
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen dark:bg-[#0b114e] bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold gradient-text">Admin Panel</h1>
            <p className="text-xs text-muted-foreground mt-1">Instrukcie pre Sonu – kamoska ich nevidi</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('sova_admin'); setAuthed(false) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Odhlasit
          </button>
        </div>

        {/* New instruction */}
        <div className="sova-border rounded-2xl dark:bg-[#0a1050] bg-white p-4 space-y-3 shadow-sm">
          <p className="text-sm font-semibold">Nova instrukcia pre Sonu</p>
          <textarea
            value={newInstruction}
            onChange={(e) => setNewInstruction(e.target.value)}
            placeholder="napr. dnes ma zavolat Zuzke, mala tazky den bud extra mila..."
            className="input w-full h-20 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={sendInstruction}
              disabled={sending || !newInstruction.trim()}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Send size={14} />
              {sending ? 'Posielam...' : 'Odoslat Sone'}
            </button>
            <p className="text-xs text-muted-foreground">
              Sona to zakomponuje do dalsej spravy ako svoju vlastnu myslienko
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['pending', 'delivered'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${tab === t
                  ? 'text-white'
                  : 'text-muted-foreground dark:hover:text-white hover:text-gray-700'}`}
              style={tab === t ? { background: 'linear-gradient(135deg, #FF7F00, #e06000)' } : {}}
            >
              {t === 'pending' ? `Cakajuce (${pending.length})` : `Dorucene (${delivered.length})`}
            </button>
          ))}
        </div>

        {/* Instructions list */}
        <div className="space-y-3">
          {(tab === 'pending' ? pending : delivered).map((instr) => (
            <div
              key={instr.id}
              className="sova-border rounded-xl p-4 dark:bg-[#0a1050] bg-white space-y-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">{instr.text}</p>
                <div className="flex gap-1.5 shrink-0">
                  {instr.timeSensitive && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] border border-red-500/20">
                      TERAZ
                    </span>
                  )}
                  {instr.emotionalTone && (
                    <Heart size={14} className="text-orange-400 mt-0.5" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(instr.receivedAt).toLocaleString('sk-SK')}
                </span>
                {instr.deliveredAt && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle size={10} />
                    Dorucene v: {instr.deliveredIn}
                  </span>
                )}
              </div>
            </div>
          ))}

          {(tab === 'pending' ? pending : delivered).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {tab === 'pending' ? 'Ziadne cakajuce instrukcie' : 'Ziadne dorucene instrukcie'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
