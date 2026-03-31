'use client'

import Link from 'next/link'
import { LayoutDashboard, CheckSquare, Feather, Settings, Sparkles, ShieldAlert } from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/tasks', icon: CheckSquare, label: 'Úlohy', id: 'tasks' },
  { href: '/dashboard/content', icon: Feather, label: 'Content', id: 'content' },
  { href: '/dashboard/settings', icon: Settings, label: 'Nastavenia', id: 'settings' },
  { href: '/admin', icon: ShieldAlert, label: 'Admin', id: 'admin' },
]

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside className="w-16 lg:w-56 flex flex-col h-screen bg-[#0D0920] border-r border-white/[0.06] shrink-0">
      {/* Logo */}
      <div className="p-4 lg:p-5 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 sova-glow">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="hidden lg:block">
          <p className="font-bold text-sm leading-tight">SOVA</p>
          <p className="text-[10px] text-muted-foreground">Soňa • AI Asistentka</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 lg:p-3 space-y-1">
        {nav.map(({ href, icon: Icon, label, id }) => (
          <Link
            key={id}
            href={href}
            className={`flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group
              ${active === id
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
          >
            <Icon size={18} className={active === id ? 'text-purple-400' : 'text-muted-foreground group-hover:text-foreground'} />
            <span className="hidden lg:block">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="p-3 lg:p-4 border-t border-white/[0.06]">
        <div className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded-lg bg-green-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400">Soňa aktívna</span>
        </div>
        <div className="flex lg:hidden justify-center">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>
    </aside>
  )
}
