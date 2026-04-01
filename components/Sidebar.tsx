'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  { href: '/dashboard/tasks', icon: CheckSquare, label: 'Ulohy', id: 'tasks' },
  { href: '/dashboard/calendar', icon: CalendarDays, label: 'Kalendar', id: 'calendar' },
  { href: '/dashboard/content', icon: Feather, label: 'Content', id: 'content' },
  { href: '/dashboard/settings', icon: Settings, label: 'Nastavenia', id: 'settings' },
  { href: '/admin', icon: ShieldAlert, label: 'Admin', id: 'admin' },
]

export default function Sidebar({ active }: { active: string }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('sova-theme')
    if (stored === 'light') {
      setDark(false)
      document.documentElement.classList.remove('dark')
    } else {
      setDark(true)
      document.documentElement.classList.add('dark')
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
    <aside className="w-16 lg:w-56 flex flex-col h-screen shrink-0 border-r transition-colors duration-200
      dark:bg-[#080e42] dark:border-white/[0.07]
      bg-white border-gray-100 shadow-sm"
    >

      {/* Logo */}
      <div className="p-4 lg:p-5 flex items-center gap-3 border-b dark:border-white/[0.07] border-gray-100">
        <div
          className="w-9 h-9 rounded-xl overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, #082f5d, #0b114e)' }}
        >
          <Image src="/robutka.png" alt="SOVA" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        <div className="hidden lg:block">
          <p className="font-bold text-sm leading-tight dark:text-white text-gray-900">SOVA</p>
          <p className="text-[10px] text-muted-foreground">Sona · AI Asistentka</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 lg:p-3 space-y-1">
        {nav.map(({ href, icon: Icon, label, id }) => {
          const isActive = active === id
          return (
            <Link
              key={id}
              href={href}
              className={`flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group
                ${isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground dark:hover:bg-white/5 hover:bg-gray-50'
                }`}
              style={isActive ? { background: 'linear-gradient(135deg, #FF7F00, #e06000)', boxShadow: '0 4px 15px rgba(255,127,0,0.3)' } : {}}
            >
              <Icon
                size={18}
                className={isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}
              />
              <span className="hidden lg:block font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 lg:p-4 border-t dark:border-white/[0.07] border-gray-100 space-y-2">
        {/* Status */}
        <div className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded-lg dark:bg-orange-500/10 bg-orange-50">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium">Sona aktivna</span>
        </div>
        <div className="flex lg:hidden justify-center">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center lg:justify-start gap-2 px-2 py-2 rounded-xl
            text-muted-foreground hover:text-foreground dark:hover:bg-white/5 hover:bg-gray-50 transition-colors text-xs"
          title={dark ? 'Prepnut na svetly rezim' : 'Prepnut na tmary rezim'}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span className="hidden lg:block">{dark ? 'Svetly rezim' : 'Tmavy rezim'}</span>
        </button>
      </div>
    </aside>
  )
}
