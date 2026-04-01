'use client'

import { useState, useEffect } from 'react'
import { Mail, RefreshCw } from 'lucide-react'

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
    <div className="sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-orange-500" />
          <span className="text-sm font-medium">Emaily</span>
        </div>
        <button
          onClick={refresh}
          className="text-muted-foreground hover:text-orange-500 transition-colors"
          title="Obnovit"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-3 space-y-2 min-h-[80px]">
        {emails.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {loading ? 'Nacitavam...' : 'Ziadne nove emaily'}
          </p>
        ) : (
          emails.slice(0, 3).map((em) => (
            <div
              key={em.id}
              className="px-3 py-2.5 rounded-xl dark:bg-white/[0.03] dark:border-white/[0.07] bg-gray-50 border border-gray-100"
            >
              <p className="text-xs font-semibold truncate">{em.subject}</p>
              <p className="text-[10px] text-orange-500 truncate mt-0.5">{em.from}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-relaxed">{em.snippet}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
