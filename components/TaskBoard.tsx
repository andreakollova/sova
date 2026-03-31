'use client'

import { useState, useEffect } from 'react'
import { Plus, CheckCircle2, Circle, Clock, AlertCircle, Trash2, ChevronDown } from 'lucide-react'

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
  high: 'text-red-400 border-red-500/30 bg-red-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  low: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
}

const STATUS_ICON = {
  todo: <Circle size={16} className="text-muted-foreground" />,
  in_progress: <Clock size={16} className="text-yellow-400" />,
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
    <div className="sova-border rounded-2xl bg-[#0D0920] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Úlohy</span>
          <div className="flex gap-1">
            {(['all', 'work', 'personal'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors
                  ${filter === f ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? 'Všetky' : f === 'work' ? 'Práca' : 'Osobné'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20 text-xs text-purple-300 hover:bg-purple-500/25 transition-colors"
        >
          <Plus size={13} />
          Pridať
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] space-y-3">
          <input
            value={newTask.title}
            onChange={(e) => setNewTask((p: any) => ({ ...p, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Názov úlohy..."
            className="input w-full"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={newTask.category}
              onChange={(e) => setNewTask((p: any) => ({ ...p, category: e.target.value }))}
              className="input flex-1"
            >
              <option value="work">Práca</option>
              <option value="personal">Osobné</option>
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask((p: any) => ({ ...p, priority: e.target.value }))}
              className="input flex-1"
            >
              <option value="high">Vysoká</option>
              <option value="medium">Stredná</option>
              <option value="low">Nízka</option>
            </select>
            <input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask((p: any) => ({ ...p, deadline: e.target.value }))}
              className="input flex-1"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} className="btn-primary text-xs px-4 py-1.5">Pridať</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-4 py-1.5">Zrušiť</button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      <div className="p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Žiadne otvorené úlohy</p>
        ) : (
          (fullView ? filtered : filtered.slice(0, 5)).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 group transition-colors"
            >
              <button onClick={() => updateStatus(task.id, task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo')}>
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
                {task.priority === 'high' ? 'vysoká' : task.priority === 'medium' ? 'stredná' : 'nízka'}
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
          <p className="text-xs text-muted-foreground mb-2">Dokončené</p>
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
