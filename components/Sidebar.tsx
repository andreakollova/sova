'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  Feather,
  Settings,
  ShieldAlert,
  CalendarDays,
  Sun,
  Moon,
} from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/tasks', icon: CheckSquare, label: 'Úlohy', id: 'tasks' },
  { href: '/dashboard/calendar', icon: CalendarDays, label: 'Kalendár', id: 'calendar' },
  { href: '/dashboard/content', icon: Feather, label: 'Content', id: 'content' },
  { href: '/dashboard/settings', icon: Settings, label: 'Nastavenia', id: 'settings' },
  { href: '/admin', icon: ShieldAlert, label: 'Admin', id: 'admin' },
]

export default function Sidebar({ active }: { active: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sova-theme')
    if (stored === 'dark') {
      setDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('sova-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('sova-theme', 'light')
    }
  }

  return (
    <aside
      className="w-12 lg:w-[220px] flex flex-col h-screen shrink-0 transition-colors duration-200"
      style={{
        background: dark ? '#111111' : '#fafafa',
        borderRight: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Logo */}
      <div className="px-3 py-4 lg:px-4 lg:py-5 flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
          style={{ background: '#0b1050' }}
        >
          <span className="text-white text-[13px] font-normal leading-none">S</span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[13px] font-normal leading-tight" style={{ color: dark ? '#e8e8e8' : '#111111' }}>
            SOŇA
          </p>
          <p className="text-[10px]" style={{ color: dark ? '#555555' : '#999999' }}>
            Sova · AI Asistentka
          </p>
        </div>
      </div>

      {/* Nav section label */}
      <div className="hidden lg:block px-4 mb-1">
        <span
          className="text-[10px] font-normal uppercase tracking-widest"
          style={{ color: dark ? '#444444' : '#bbbbbb' }}
        >
          Navigácia
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 lg:px-2 space-y-0.5">
        {nav.map(({ href, icon: Icon, label, id }) => {
          const isActive = active === id
          return (
            <Link
              key={id}
              href={href}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-normal transition-all duration-150 group"
              style={{
                background: isActive
                  ? 'rgba(255,255,255,0.05)'
                  : undefined,
                color: isActive
                  ? (dark ? '#e8e8e8' : '#111111')
                  : (dark ? '#aaaaaa' : '#666666'),
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                  ;(e.currentTarget as HTMLElement).style.color = dark ? '#e8e8e8' : '#111111'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = ''
                  ;(e.currentTarget as HTMLElement).style.color = dark ? '#aaaaaa' : '#666666'
                }
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                style={{ color: 'inherit', flexShrink: 0 }}
              />
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-1.5 lg:px-2 pb-4 space-y-1">
        {/* Status */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <span className="text-[11px] font-light" style={{ color: dark ? '#555555' : '#999999' }}>
            Soňa aktívna
          </span>
        </div>
        <div className="flex lg:hidden justify-center py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center lg:justify-start gap-2 px-2.5 py-2 rounded-lg transition-colors text-[11px] font-normal"
          style={{ color: dark ? '#555555' : '#999999' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
            ;(e.currentTarget as HTMLElement).style.color = dark ? '#aaaaaa' : '#666666'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = ''
            ;(e.currentTarget as HTMLElement).style.color = dark ? '#555555' : '#999999'
          }}
          title={dark ? 'Prepnúť na svetlý režim' : 'Prepnúť na tmavý režim'}
        >
          {dark
            ? <Sun size={14} strokeWidth={1.5} />
            : <Moon size={14} strokeWidth={1.5} />
          }
          <span className="hidden lg:block">{dark ? 'Svetlý režim' : 'Tmavý režim'}</span>
        </button>
      </div>
    </aside>
  )
}
