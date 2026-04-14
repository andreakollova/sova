'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/CalendarView'
import GmailAlerts from '@/components/GmailAlerts'
import TaskBoard from '@/components/TaskBoard'
import { Clock, Dumbbell, CheckSquare, Zap, Plus, X, ExternalLink } from 'lucide-react'

interface Project {
  name: string
  url: string
  logoUrl: string
}

const DEFAULT_PROJECTS: Project[] = [
  { name: 'Hockey Refresh', url: 'https://www.hockeyrefresh.com/', logoUrl: 'https://www.hockeyrefresh.com/logo-light.png' },
  { name: 'Sportqo', url: 'https://sportqo.com/', logoUrl: 'https://sportqo.com/assets/brand_logo-93a425fd.png' },
  { name: 'Drilzz', url: 'https://drilzz.com/', logoUrl: 'https://drilzz.com/assets/drilzz-logo-CRlAcJ5G.png' },
  { name: 'SZPH', url: 'https://szph.sk/', logoUrl: 'https://szph.sk/wp-content/uploads/2024/11/SZPH-logo-v3.png' },
]

const SK_DAYS = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']
const SK_MONTHS = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec']

function getSkDate() {
  const d = new Date()
  return `${SK_DAYS[d.getDay()]}, ${d.getDate()}. ${SK_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function DashboardPage() {
  const [skDate, setSkDate] = useState('')
  const [isDark, setIsDark] = useState(true)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [completedToday, setCompletedToday] = useState(0)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', url: '', logoUrl: '' })

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => {
      setCompletedToday(d.completedToday ?? 0)
      setPomodoroCount(d.pomodoroCount ?? 0)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setSkDate(getSkDate())

    const checkTheme = () => {
      const stored = localStorage.getItem('sova-theme')
      setIsDark(stored !== 'light')
      setVideoLoaded(false)
    }

    checkTheme()

    // Watch for theme changes from Sidebar
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributeFilter: ['class'] })

    // Load custom projects from localStorage
    try {
      const saved = localStorage.getItem('sova-projects')
      if (saved) setProjects([...DEFAULT_PROJECTS, ...JSON.parse(saved)])
    } catch {}

    return () => observer.disconnect()
  }, [])

  function addProject() {
    if (!newProject.url.trim() || !newProject.logoUrl.trim()) return
    const name = newProject.name.trim() || new URL(newProject.url).hostname.replace('www.', '')
    const project = { name, url: newProject.url.trim(), logoUrl: newProject.logoUrl.trim() }
    const custom = projects.slice(DEFAULT_PROJECTS.length)
    const updated = [...custom, project]
    localStorage.setItem('sova-projects', JSON.stringify(updated))
    setProjects([...DEFAULT_PROJECTS, ...updated])
    setNewProject({ name: '', url: '', logoUrl: '' })
    setShowAddProject(false)
  }

  function removeProject(index: number) {
    if (index < DEFAULT_PROJECTS.length) return
    const custom = projects.slice(DEFAULT_PROJECTS.length).filter((_, i) => i !== index - DEFAULT_PROJECTS.length)
    localStorage.setItem('sova-projects', JSON.stringify(custom))
    setProjects([...DEFAULT_PROJECTS, ...custom])
  }

  const videoSrc = isDark ? '/media/anim-dark.mp4' : '/media/anim-light.mp4'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="dashboard" />

      <main className="flex-1 overflow-auto">
        <div className="max-w-[900px] mx-auto px-8 py-8 space-y-8">

          {/* ── Hero ── */}
          <div className="flex flex-col items-center text-center pt-2 pb-2">
            <div className="relative w-[120px] h-[120px] mb-5 rounded-2xl overflow-hidden">
              <video
                key={videoSrc}
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onLoadedData={() => setVideoLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!videoLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse rounded-2xl" />
              )}
            </div>

            <h1 className="text-[28px] font-normal text-foreground mb-1">
              Ahoj, Fondula
            </h1>
            <p className="text-[12px] font-light" style={{ color: '#555555' }}>{skDate}</p>
          </div>

          {/* ── Stats ── */}
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
              Štatistiky
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Clock, label: 'Focus time dnes', value: '0 min' },
                { icon: Dumbbell, label: 'Tréningy tento týždeň', value: '0' },
                { icon: CheckSquare, label: 'Úlohy splnené', value: String(completedToday) },
                { icon: Zap, label: 'Pomodoro cykly', value: String(pomodoroCount) },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
                >
                  <Icon size={15} className="text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-[22px] font-normal text-foreground leading-none">{value}</p>
                    <p className="text-[11px] font-light text-muted-foreground mt-1">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Calendar – 2 cols */}
            <div className="lg:col-span-2">
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Dnešný kalendár
              </p>
              <CalendarView />
            </div>

            {/* Emails */}
            <div>
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
                Dôležité emaily
              </p>
              <GmailAlerts />
            </div>
          </div>

          {/* ── Tasks ── */}
          <div>
            <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444] mb-3">
              Úlohy
            </p>
            <TaskBoard />
          </div>

          {/* ── Projects ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-[#555] dark:text-[#444]">
                Moje projekty
              </p>
              <button
                onClick={() => setShowAddProject(!showAddProject)}
                className="flex items-center gap-1 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={12} strokeWidth={1.5} />
                Pridať
              </button>
            </div>

            {showAddProject && (
              <div
                className="mb-3 p-4 rounded-xl border space-y-3"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={newProject.name}
                    onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Názov (voliteľné)"
                    className="input text-[12px]"
                  />
                  <input
                    value={newProject.url}
                    onChange={(e) => setNewProject((p) => ({ ...p, url: e.target.value }))}
                    placeholder="https://projekt.sk"
                    className="input text-[12px]"
                  />
                  <input
                    value={newProject.logoUrl}
                    onChange={(e) => setNewProject((p) => ({ ...p, logoUrl: e.target.value }))}
                    placeholder="https://.../logo.png"
                    className="input text-[12px]"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={addProject} className="btn-primary text-[12px] px-4 py-1.5">Pridať</button>
                  <button onClick={() => setShowAddProject(false)} className="btn-secondary text-[12px] px-4 py-1.5">Zrušiť</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {projects.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative group flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all hover:border-white/15"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <img
                    src={p.logoUrl}
                    alt={p.name}
                    className="h-8 w-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <span className="text-[11px] font-light text-muted-foreground group-hover:text-foreground transition-colors">{p.name}</span>
                  <ExternalLink size={10} strokeWidth={1.5} className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-40 transition-opacity text-muted-foreground" />
                  {i >= DEFAULT_PROJECTS.length && (
                    <button
                      onClick={(e) => { e.preventDefault(); removeProject(i) }}
                      className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                    >
                      <X size={11} strokeWidth={1.5} />
                    </button>
                  )}
                </a>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
