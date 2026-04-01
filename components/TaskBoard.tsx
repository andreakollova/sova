'use client'

import { useState, useEffect } from 'react'
import { Plus, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react'

interface Task {
  id: string
  title: string
  category: 'personal' | 'work'
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  deadline?: string
  notes?: string
  createdAt: string
}

const PRIORITY_COLOR = {
  high: 'text-red-500 border-red-500/30 bg-red-500/10',
  medium: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  low: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
}

const STATUS_ICON = {
  todo: <Circle size={16} className="text-muted-foreground" />,
  in_progress: <Clock size={16} className="text-orange-400" />,
  done: <CheckCircle2 size={16} className="text-green-400" />,
}

export default function TaskBoard({ fullView = false }: { fullView?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<'all' | 'work' | 'personal'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', category: 'work', priority: 'medium', deadline: '' } as any)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((t) => setTasks(Array.isArray(t) ? t : []))
      .finally(() => setLoading(false))
  }, [])

  async function addTask() {
    if (!newTask.title.trim()) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    })
    const created = await res.json()
    setTasks((prev) => [...prev, created])
    setNewTask({ title: '', category: 'work', priority: 'medium', deadline: '' })
    setShowAdd(false)
  }

  async function updateStatus(id: string, status: Task['status']) {
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const updated = await res.json()
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }

  async function deleteTask(id: string) {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const filtered = tasks.filter((t) => {
    if (filter === 'all') return t.status !== 'done'
    return t.category === filter && t.status !== 'done'
  })

  const done = tasks.filter((t) => t.status === 'done').slice(0, 5)

  return (
    <div className="sova-border rounded-2xl overflow-hidden dark:bg-[#0a1050] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-white/[0.07] border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Ulohy</span>
          <div className="flex gap-1">
            {(['all', 'work', 'personal'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                  ${filter === f
                    ? 'text-white'
                    : 'text-muted-foreground dark:hover:text-white hover:text-gray-700'}`}
                style={filter === f ? { background: 'linear-gradient(135deg, #FF7F00, #e06000)' } : {}}
              >
                {f === 'all' ? 'Vsetky' : f === 'work' ? 'Praca' : 'Osobne'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            dark:bg-orange-500/10 dark:border-orange-500/20 dark:text-orange-300 dark:hover:bg-orange-500/20
            bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100"
        >
          <Plus size={13} />
          Pridat
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="px-4 py-3 border-b dark:border-white/[0.07] border-gray-100 dark:bg-white/[0.02] bg-gray-50 space-y-3">
          <input
            value={newTask.title}
            onChange={(e) => setNewTask((p: any) => ({ ...p, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Nazov ulohy..."
            className="input w-full"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={newTask.category}
              onChange={(e) => setNewTask((p: any) => ({ ...p, category: e.target.value }))}
              className="input flex-1"
            >
              <option value="work">Praca</option>
              <option value="personal">Osobne</option>
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((p: any) => ({ ...p, priority: e.target.value }))}
              className="input flex-1"
            >
              <option value="high">Vysoka</option>
              <option value="medium">Stredna</option>
              <option value="low">Nizka</option>
            </select>
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((p: any) => ({ ...p, deadline: e.target.value }))}
              className="input flex-1"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} className="btn-primary text-xs px-4 py-1.5">Pridat</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-4 py-1.5">Zrusit</button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Ziadne otvorene ulohy</p>
        ) : (
          (fullView ? filtered : filtered.slice(0, 5)).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors group
                dark:bg-white/[0.03] dark:border-white/[0.07] dark:hover:border-white/10
                bg-gray-50 border-gray-100 hover:border-gray-200"
            >
              <button
                onClick={() =>
                  updateStatus(
                    task.id,
                    task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
                  )
                }
              >
                {STATUS_ICON[task.status]}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </p>
                {task.deadline && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(task.deadline).toLocaleDateString('sk-SK')}
                  </p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}>
                {task.priority === 'high' ? 'vysoka' : task.priority === 'medium' ? 'stredna' : 'nizka'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {task.category === 'work' ? '💼' : '🏠'}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Completed */}
      {done.length > 0 && fullView && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Dokoncene</p>
          {done.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl opacity-50">
              <CheckCircle2 size={14} className="text-green-400" />
              <p className="text-xs line-through text-muted-foreground">{task.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
