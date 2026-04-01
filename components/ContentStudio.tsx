'use client'

import { useState, useEffect } from 'react'
import { Feather, RefreshCw, Copy, Check, BookOpen, Linkedin } from 'lucide-react'

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
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex gap-1">
            {(['articles', 'research'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="px-2.5 py-1 rounded-lg text-[12px] font-normal transition-colors"
                style={
                  activeTab === t
                    ? { background: 'rgba(255,255,255,0.08)', color: '#e8e8e8' }
                    : { color: '#666666' }
                }
              >
                {t === 'articles' ? 'Clanky' : 'Research'}
              </button>
            ))}
          </div>
          {activeTab === 'research' && (
            <button
              onClick={generateResearch}
              disabled={generating}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Generovat novy research"
            >
              <RefreshCw size={13} strokeWidth={1.5} className={generating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <Feather size={22} strokeWidth={1.5} className="text-muted-foreground/40" />
              <p className="text-[12px] font-light text-muted-foreground">
                {activeTab === 'articles'
                  ? 'Poziadaj Sonu v chate o napisanie clanku'
                  : 'Klikni na obnovit pre novy LinkedIn research'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full text-left px-3 py-2.5 rounded-lg border transition-all"
                style={
                  selected?.id === item.id
                    ? { background: 'rgba(201,106,78,0.08)', borderColor: 'rgba(201,106,78,0.2)' }
                    : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }
                }
              >
                <p className="text-[12px] font-normal truncate text-foreground">{item.title}</p>
                <p className="text-[10px] font-light text-muted-foreground mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString('sk-SK')}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-[13px] font-normal truncate text-foreground">{selected.title}</p>
              <button
                onClick={() => copy(selected.linkedinVersion ?? selected.content)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-normal text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                {copied ? <Check size={12} strokeWidth={1.5} className="text-green-400" /> : <Copy size={12} strokeWidth={1.5} />}
                {copied ? 'Skopirovane' : 'Kopirovat'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-[13px] font-light leading-relaxed font-sans text-foreground">
                  {selected.content}
                </pre>
                {selected.linkedinVersion && (
                  <>
                    <div className="my-4 border-t border-border" />
                    <div className="flex items-center gap-2 mb-2">
                      <Linkedin size={13} strokeWidth={1.5} className="text-blue-400" />
                      <p className="text-[12px] font-normal text-blue-400">LinkedIn verzia</p>
                    </div>
                    <pre className="whitespace-pre-wrap text-[13px] font-light leading-relaxed font-sans text-foreground">
                      {selected.linkedinVersion}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <BookOpen size={28} strokeWidth={1.5} className="text-muted-foreground/30" />
            <p className="text-[13px] font-normal text-muted-foreground">Vyber obsah zo zoznamu</p>
            <p className="text-[12px] font-light text-muted-foreground">
              Alebo povedz Sone v chate: &quot;Napíš LinkedIn post o [tema]&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
