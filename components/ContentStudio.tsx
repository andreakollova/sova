'use client'

import { useState, useEffect } from 'react'
import { Feather, Lightbulb, RefreshCw, Copy, Check, BookOpen, Linkedin } from 'lucide-react'

interface Content {
  id: string
  type: 'article' | 'linkedin_post' | 'research'
  title: string
  content: string
  linkedinVersion?: string
  createdAt: string
  brief?: string
}

export default function ContentStudio() {
  const [content, setContent] = useState<Content[]>([])
  const [research, setResearch] = useState<Content[]>([])
  const [activeTab, setActiveTab] = useState<'articles' | 'research'>('articles')
  const [selected, setSelected] = useState<Content | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/linkedin-research').then((r) => r.json()).then((d) => setResearch(Array.isArray(d) ? d : []))
    // Content is saved by the chat, fetch from KV via a simple endpoint
    fetchContent()
  }, [])

  async function fetchContent() {
    try {
      const res = await fetch('/api/content')
      if (res.ok) setContent(await res.json())
    } catch {}
  }

  async function generateResearch() {
    setGenerating(true)
    try {
      const res = await fetch('/api/linkedin-research', { method: 'POST' })
      const item = await res.json()
      setResearch((prev) => [item, ...prev])
      setSelected(item)
    } finally {
      setGenerating(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const items = activeTab === 'articles' ? content : research

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* List */}
      <div className="sova-border rounded-2xl bg-[#0D0920] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1">
            {(['articles', 'research'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors
                  ${activeTab === t ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'articles' ? 'Články' : 'Research'}
              </button>
            ))}
          </div>
          {activeTab === 'research' && (
            <button
              onClick={generateResearch}
              disabled={generating}
              className="text-muted-foreground hover:text-purple-300 transition-colors"
              title="Generovať nový research"
            >
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <Feather size={24} className="text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {activeTab === 'articles'
                  ? 'Požiadaj Soňu v chate o napísanie článku'
                  : 'Klikni na obnoviť pre nový LinkedIn research'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors
                  ${selected?.id === item.id
                    ? 'bg-purple-500/15 border-purple-500/30'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/10'}`}
              >
                <p className="text-xs font-medium truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString('sk-SK')}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="lg:col-span-2 sova-border rounded-2xl bg-[#0D0920] overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-medium truncate">{selected.title}</p>
              <button
                onClick={() => copy(selected.linkedinVersion ?? selected.content)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition-colors"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Skopírované' : 'Kopírovať'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-sm prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                  {selected.content}
                </pre>
                {selected.linkedinVersion && (
                  <>
                    <div className="my-4 border-t border-white/10" />
                    <div className="flex items-center gap-2 mb-2">
                      <Linkedin size={14} className="text-blue-400" />
                      <p className="text-xs font-medium text-blue-400">LinkedIn verzia</p>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                      {selected.linkedinVersion}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <BookOpen size={32} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Vyber obsah zo zoznamu</p>
            <p className="text-xs text-muted-foreground">
              Alebo povedz Soňe v chate: &quot;Napíš LinkedIn post o [téma]&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
