'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface Email {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
}

export default function GmailAlerts() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/gmail')
      const data = await res.json()
      setEmails(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[13px] font-normal text-foreground">Emaily</span>
        <button
          onClick={refresh}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Obnovit"
        >
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-1.5 min-h-[80px]">
        {emails.length === 0 ? (
          <p className="text-[12px] font-light text-muted-foreground text-center py-4">
            {loading ? 'Nacitavam...' : 'Ziadne nove emaily'}
          </p>
        ) : (
          emails.slice(0, 3).map((em) => (
            <div
              key={em.id}
              className="px-3 py-2.5 rounded-lg border"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <p className="text-[12px] font-normal truncate text-foreground">{em.subject}</p>
              <p className="text-[11px] font-light truncate mt-0.5" style={{ color: '#c96a4e' }}>{em.from}</p>
              <p className="text-[11px] font-light text-muted-foreground truncate mt-0.5 leading-relaxed">{em.snippet}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
