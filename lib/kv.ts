import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export default redis

// Keys
export const KEYS = {
  SETTINGS: 'sova:settings',
  TASKS: 'sova:tasks',
  CONVERSATIONS: 'sova:conversations',
  CONTENT: 'sova:content',
  GMAIL_LAST_CHECK: 'sova:gmail_last_check',
  CRON_MORNING_LAST: 'sova:cron:morning:last',
  CRON_EVENING_LAST: 'sova:cron:evening:last',
  CRON_WEEKLY_LAST: 'sova:cron:weekly:last',
  LINKEDIN_RESEARCH: 'sova:linkedin_research',
  ARTICLE_DRAFTS: 'sova:article_drafts',
  // Admin layer
  ADMIN_PENDING: 'admin:pending_instructions',
  ADMIN_DELIVERED: 'admin:delivered_instructions',
  ADMIN_LAST_MSG: 'discord:last_message:admin',
  KAMOSKA_LAST_MSG: 'discord:last_message:kamoska',
  // Task sessions
  TASK_SESSION: 'session:current',
}

export interface Settings {
  morningTime: string
  eveningTime: string
  watchedEmails: string[]
  discordChannelId: string
  userName: string
  timezone: string
}

export interface Task {
  id: string
  title: string
  category: 'personal' | 'work'
  priority: 'low' | 'medium' | 'high'
  status: 'todo' | 'in_progress' | 'done'
  deadline?: string
  notes?: string
  createdAt: string
  completedAt?: string
  postponedCount?: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface GeneratedContent {
  id: string
  type: 'article' | 'linkedin_post' | 'research'
  title: string
  content: string
  linkedinVersion?: string
  createdAt: string
  brief?: string
}

export async function getSettings(): Promise<Settings> {
  const stored = await redis.get<Settings>(KEYS.SETTINGS)
  return stored ?? {
    morningTime: process.env.MORNING_BRIEFING_TIME ?? '08:30',
    eveningTime: process.env.EVENING_BRIEFING_TIME ?? '20:00',
    watchedEmails: (process.env.WATCHED_EMAIL_ADDRESSES ?? 'andreakollova1@gmail.com').split(',').map(e => e.trim()),
    discordChannelId: process.env.DISCORD_CHANNEL_ID ?? '',
    userName: process.env.USER_NAME ?? 'Natka',
    timezone: 'Europe/Bratislava',
  }
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const updated = { ...current, ...settings }
  await redis.set(KEYS.SETTINGS, updated)
  return updated
}

export async function getTasks(): Promise<Task[]> {
  return (await redis.get<Task[]>(KEYS.TASKS)) ?? []
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await redis.set(KEYS.TASKS, tasks)
}

export async function getConversations(): Promise<Message[]> {
  const msgs = (await redis.get<Message[]>(KEYS.CONVERSATIONS)) ?? []
  return msgs.slice(-50) // keep last 50 messages
}

export async function addMessage(message: Message): Promise<void> {
  const msgs = await getConversations()
  msgs.push(message)
  await redis.set(KEYS.CONVERSATIONS, msgs.slice(-50))
}

export async function getContent(): Promise<GeneratedContent[]> {
  return (await redis.get<GeneratedContent[]>(KEYS.CONTENT)) ?? []
}

export async function saveContent(content: GeneratedContent): Promise<void> {
  const all = await getContent()
  all.unshift(content)
  await redis.set(KEYS.CONTENT, all.slice(0, 50))
}

export async function getLinkedInResearch(): Promise<GeneratedContent[]> {
  return (await redis.get<GeneratedContent[]>(KEYS.LINKEDIN_RESEARCH)) ?? []
}

export async function saveLinkedInResearch(item: GeneratedContent): Promise<void> {
  const all = await getLinkedInResearch()
  all.unshift(item)
  await redis.set(KEYS.LINKEDIN_RESEARCH, all.slice(0, 20))
}

// ─── Admin Layer ───────────────────────────────────────────────────────────

export interface AdminInstruction {
  id: string
  text: string          // raw admin message
  receivedAt: string
  timeSensitive: boolean  // contains "teraz", "hneď", "ihneď"
  emotionalTone: boolean  // "ťažký deň", "smutná", "extra milá"
  deliveredAt?: string
  deliveredIn?: string    // which message it was woven into
}

export async function getPendingInstructions(): Promise<AdminInstruction[]> {
  return (await redis.get<AdminInstruction[]>(KEYS.ADMIN_PENDING)) ?? []
}

export async function addPendingInstruction(instr: AdminInstruction): Promise<void> {
  const pending = await getPendingInstructions()
  pending.push(instr)
  await redis.set(KEYS.ADMIN_PENDING, pending)
}

export async function markInstructionDelivered(id: string, deliveredIn: string): Promise<void> {
  const pending = await getPendingInstructions()
  const instr = pending.find((i) => i.id === id)
  if (instr) {
    instr.deliveredAt = new Date().toISOString()
    instr.deliveredIn = deliveredIn
    const delivered = (await redis.get<AdminInstruction[]>(KEYS.ADMIN_DELIVERED)) ?? []
    delivered.unshift(instr)
    await redis.set(KEYS.ADMIN_DELIVERED, delivered.slice(0, 100))
    await redis.set(KEYS.ADMIN_PENDING, pending.filter((i) => i.id !== id))
  }
}

export async function getDeliveredInstructions(): Promise<AdminInstruction[]> {
  return (await redis.get<AdminInstruction[]>(KEYS.ADMIN_DELIVERED)) ?? []
}

// ─── Task Session ──────────────────────────────────────────────────────────

export interface TaskSession {
  active: boolean
  taskIds: string[]       // ordered list of task IDs in this session
  currentIndex: number
  dateKey: string         // YYYY-MM-DD
  startedAt: string
  waitingForDate?: string // task ID waiting for custom date input
}

export async function getTaskSession(): Promise<TaskSession | null> {
  return redis.get<TaskSession>(KEYS.TASK_SESSION)
}

export async function setTaskSession(session: TaskSession | null): Promise<void> {
  if (session === null) {
    await redis.del(KEYS.TASK_SESSION)
  } else {
    await redis.set(KEYS.TASK_SESSION, session, { ex: 60 * 60 * 12 }) // 12h TTL
  }
}

// ─── Time window ───────────────────────────────────────────────────────────

export async function isWithinTimeWindow(key: string, targetTime: string, windowMinutes = 14): Promise<boolean> {
  const last = await redis.get<string>(key)
  const now = new Date()
  const [hours, minutes] = targetTime.split(':').map(Number)
  const target = new Date()
  target.setHours(hours, minutes, 0, 0)

  const diffMs = Math.abs(now.getTime() - target.getTime())
  const diffMin = diffMs / 60000

  if (diffMin > windowMinutes) return false
  if (last) {
    const lastDate = new Date(last)
    const todayStr = now.toDateString()
    if (lastDate.toDateString() === todayStr) return false
  }

  await redis.set(key, now.toISOString())
  return true
}
