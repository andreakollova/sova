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
      <div className="sova-border rounded-2xl dark:bg-[#0a1050] bg-white overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
          <div className="flex gap-1">
            {(['articles', 'research'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                  ${activeTab === t
                    ? 'text-white'
                    : 'text-muted-foreground dark:hover:text-white hover:text-gray-700'}`}
                style={activeTab === t ? { background: 'linear-gradient(135deg, #FF7F00, #e06000)' } : {}}
              >
                {t === 'articles' ? 'Clanky' : 'Research'}
              </button>
            ))}
          </div>
          {activeTab === 'research' && (
            <button
              onClick={generateResearch}
              disabled={generating}
              className="text-muted-foreground hover:text-orange-500 transition-colors"
              title="Generovat novy research"
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
                  ? 'Poziadaj Sonu v chate o napisanie clanku'
                  : 'Klikni na obnovit pre novy LinkedIn research'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all
                  ${selected?.id === item.id
                    ? 'border-orange-500/30'
                    : 'dark:bg-white/[0.03] dark:border-white/[0.07] dark:hover:border-white/10 bg-gray-50 border-gray-100 hover:border-gray-200'}`}
                style={selected?.id === item.id ? { background: 'rgba(255,127,0,0.08)' } : {}}
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
      <div className="lg:col-span-2 sova-border rounded-2xl dark:bg-[#0a1050] bg-white overflow-hidden flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
              <p className="text-sm font-medium truncate">{selected.title}</p>
              <button
                onClick={() => copy(selected.linkedinVersion ?? selected.content)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg dark:bg-white/5 dark:hover:bg-white/10 bg-gray-100 hover:bg-gray-200 text-xs transition-colors"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Skopirovane' : 'Kopirovat'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans dark:text-white/90 text-gray-800">
                  {selected.content}
                </pre>
                {selected.linkedinVersion && (
                  <>
                    <div className="my-4 border-t dark:border-white/10 border-gray-200" />
                    <div className="flex items-center gap-2 mb-2">
                      <Linkedin size={14} className="text-blue-500" />
                      <p className="text-xs font-medium text-blue-500">LinkedIn verzia</p>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans dark:text-white/90 text-gray-800">
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
              Alebo povedz Sone v chate: &quot;Napís LinkedIn post o [tema]&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
