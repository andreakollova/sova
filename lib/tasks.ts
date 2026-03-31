import { getTasks, saveTasks, type Task } from './kv'

export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'postponedCount'>): Promise<Task> {
  const tasks = await getTasks()
  const task: Task = {
    ...data,
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    postponedCount: 0,
  }
  tasks.push(task)
  await saveTasks(tasks)
  return task
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const tasks = await getTasks()
  const idx = tasks.findIndex((t) => t.id === id)
  if (idx === -1) return null
  tasks[idx] = { ...tasks[idx], ...updates }
  if (updates.status === 'done' && !tasks[idx].completedAt) {
    tasks[idx].completedAt = new Date().toISOString()
  }
  await saveTasks(tasks)
  return tasks[idx]
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await getTasks()
  const filtered = tasks.filter((t) => t.id !== id)
  if (filtered.length === tasks.length) return false
  await saveTasks(filtered)
  return true
}

export async function getPostponedTasks(): Promise<Task[]> {
  const tasks = await getTasks()
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
  return tasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.deadline &&
      new Date(t.deadline).getTime() < threeDaysAgo
  )
}

export async function getTasksDueToday(): Promise<Task[]> {
  const tasks = await getTasks()
  const today = new Date().toDateString()
  return tasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.deadline &&
      new Date(t.deadline).toDateString() === today
  )
}

export async function getTopPriorityTasks(limit = 3): Promise<Task[]> {
  const tasks = await getTasks()
  return tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    .slice(0, limit)
}

export async function getTodayCompletedTasks(): Promise<Task[]> {
  const tasks = await getTasks()
  const today = new Date().toDateString()
  return tasks.filter(
    (t) =>
      t.status === 'done' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === today
  )
}
