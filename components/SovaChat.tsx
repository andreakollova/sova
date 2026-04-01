'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2 } from 'lucide-react'
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
    <div className="flex flex-col h-full sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-white/[0.07] border-gray-100"
        style={{ background: 'linear-gradient(135deg, rgba(8,47,93,0.6) 0%, rgba(11,17,78,0.4) 100%)' }}
      >
        <div
          className="w-9 h-9 rounded-full overflow-hidden shrink-0"
          style={{ boxShadow: '0 0 20px rgba(255,127,0,0.35)' }}
        >
          <Image src="/robutka.png" alt="Sona" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="font-semibold text-sm text-white">Sona</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-[10px] text-white/60">AI asistentka · vzdy k dispozicii</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-full overflow-hidden mr-2 mt-0.5 shrink-0"
                style={{ boxShadow: '0 0 10px rgba(255,127,0,0.3)' }}
              >
                <Image src="/robutka.png" alt="Sona" width={24} height={24} className="w-full h-full object-cover" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user' ? 'chat-message-user rounded-br-md' : 'chat-message-sova rounded-bl-md'}`}
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
            <div className="chat-message-sova px-4 py-3 rounded-2xl rounded-bl-md">
              <Loader2 size={16} className="animate-spin text-orange-500" />
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
              className="shrink-0 px-3 py-1.5 rounded-full border text-xs transition-colors
                dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-300 dark:hover:bg-orange-500/20
                bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex items-end gap-2 rounded-2xl px-4 py-3 border transition-colors
          dark:bg-white/5 dark:border-white/10 dark:focus-within:border-orange-500/40
          bg-gray-50 border-gray-200 focus-within:border-orange-400"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Napís Sone..."
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-muted-foreground max-h-32 leading-relaxed"
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
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF7F00, #e06000)' }}
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
