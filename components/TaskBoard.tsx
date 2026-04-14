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
  project?: string
  createdAt: string
}

const PRIORITY_LABEL = {
  high: 'vysoká',
  medium: 'stredná',
  low: 'nízka',
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'rgba(239,68,68,0.15)',
  medium: 'rgba(234,179,8,0.12)',
  low: 'rgba(96,165,250,0.12)',
}

const PRIORITY_TEXT: Record<string, string> = {
  high: '#f87171',
  medium: '#ca8a04',
  low: '#60a5fa',
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

  const statusIcon = (status: Task['status']) => {
    if (status === 'done') return <CheckCircle2 size={15} strokeWidth={1.5} className="text-green-500" />
    if (status === 'in_progress') return <Clock size={15} strokeWidth={1.5} className="text-muted-foreground" />
    return <Circle size={15} strokeWidth={1.5} className="text-muted-foreground" />
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-normal text-foreground">Úlohy</span>
          <div className="flex gap-1">
            {(['all', 'work', 'personal'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-lg text-[12px] font-normal transition-colors"
                style={
                  filter === f
                    ? { background: 'rgba(255,255,255,0.08)', color: '#e8e8e8' }
                    : { color: '#666666' }
                }
              >
                {f === 'all' ? 'Všetky' : f === 'work' ? 'Práca' : 'Osobné'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-normal transition-colors border"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#aaaaaa' }}
        >
          <Plus size={13} strokeWidth={1.5} />
          Pridat
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div
          className="px-4 py-3 border-b border-border space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
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
            <button onClick={addTask} className="btn-primary text-[12px] px-4 py-1.5">Pridať</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-[12px] px-4 py-1.5">Zrušiť</button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      <div className="p-3 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-4 h-4 border border-border border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[12px] font-light text-muted-foreground text-center py-6">Žiadne otvorené úlohy</p>
        ) : (
          (fullView ? filtered : filtered.slice(0, 5)).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <button
                onClick={() =>
                  updateStatus(
                    task.id,
                    task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
                  )
                }
                className="shrink-0"
              >
                {statusIcon(task.status)}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-normal truncate ${
                    task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {task.title}
                </p>
                {task.deadline && (
                  <p className="text-[11px] font-light text-muted-foreground mt-0.5">
                    {new Date(task.deadline).toLocaleDateString('sk-SK')}
                  </p>
                )}
              </div>
              <span
                className="text-[10px] font-normal px-2 py-0.5 rounded-full"
                style={{
                  background: PRIORITY_COLOR[task.priority],
                  color: PRIORITY_TEXT[task.priority],
                }}
              >
                {PRIORITY_LABEL[task.priority]}
              </span>
              {task.project && (
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                  {task.project}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground font-light">
                {task.category === 'work' ? 'práca' : 'osobné'}
              </span>
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
              >
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Completed */}
      {done.length > 0 && fullView && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground mb-2">
            Dokončené
          </p>
          {done.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg opacity-40">
              <CheckCircle2 size={13} strokeWidth={1.5} className="text-green-500" />
              <p className="text-[12px] font-light line-through text-muted-foreground">{task.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
