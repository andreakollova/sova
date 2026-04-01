'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const SUGGESTIONS = [
  'Co mam dnes v kalendari?',
  'Ake su moje top priority?',
  'Napís LinkedIn post o marketingu',
  'Pridaj trening v piatok o 18:00',
]

export default function SovaChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ahoj, Natka! Som tu pre teba. Co ta dnes caka alebo s cím ti môzem pomôct?',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply ?? 'Nieco sa pokazilo, skus znova.',
          timestamp: new Date().toISOString(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Prepac, momentalne mam vypadok. Skus to znova o chvilku.',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
          <Image src="/robutka.png" alt="Sona" width={32} height={32} className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-[13px] font-normal text-foreground">Sona</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-[11px] font-light text-muted-foreground">AI asistentka · vzdy k dispozicii</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-0.5 shrink-0">
                <Image src="/robutka.png" alt="Sona" width={24} height={24} className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-xl text-[13px] font-light leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-sova'}`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-0.5 shrink-0">
              <Image src="/robutka.png" alt="Sona" width={24} height={24} className="w-full h-full object-cover" />
            </div>
            <div className="chat-message-sova px-4 py-3 rounded-xl">
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-normal transition-colors text-muted-foreground hover:text-foreground"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div
          className="flex items-end gap-2 rounded-xl px-4 py-3 border transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Napís Sone..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-[13px] font-light outline-none placeholder:text-muted-foreground max-h-32 leading-relaxed text-foreground"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 128) + 'px'
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity shrink-0"
            style={{ background: '#c96a4e' }}
          >
            <Send size={13} strokeWidth={1.5} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
