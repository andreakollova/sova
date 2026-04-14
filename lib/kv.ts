import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseKey = process.env.SUPABASE_ANON_KEY ?? ''
const hasDB = !!(supabaseUrl && supabaseKey)

const supabase = hasDB
  ? createClient(supabaseUrl, supabaseKey)
  : null

async function kvGet<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('kv_store')
    .select('value')
    .eq('key', key)
    .single()
  return data ? (data.value as T) : null
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (!supabase) return
  await supabase
    .from('kv_store')
    .upsert({ key, value, updated_at: new Date().toISOString() })
}

async function kvDel(key: string): Promise<void> {
  if (!supabase) return
  await supabase.from('kv_store').delete().eq('key', key)
}

// Legacy redis-compatible export for /api/bot/memory proxy
const redis = { get: kvGet, set: kvSet, del: kvDel }
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
  CRON_MIDDAY_LAST: 'sova:cron:midday:last',
  CRON_GOODNIGHT_LAST: 'sova:cron:goodnight:last',
  LINKEDIN_RESEARCH: 'sova:linkedin_research',
  AI_SPORTS_RESEARCH: 'sova:ai_sports_research',
  CRON_AI_SPORTS_LAST: 'sova:cron:ai_sports:last',
  ARTICLE_DRAFTS: 'sova:article_drafts',
  ADMIN_PENDING: 'admin:pending_instructions',
  ADMIN_DELIVERED: 'admin:delivered_instructions',
  ADMIN_LAST_MSG: 'discord:last_message:admin',
  KAMOSKA_LAST_MSG: 'discord:last_message:kamoska',
  TASK_SESSION: 'session:current',
  HOCKEY_PLAN: 'sova:hockey_plan',
  WORKOUT_PLAN: 'sova:workout_plan',
  MONDAY_QUESTIONS_SENT: 'sova:monday_questions_sent',
  WORKOUT_CHECK_SENT: 'sova:workout_check_sent',
  POMODORO: 'sova:pomodoro',
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
  const stored = await kvGet<Settings>(KEYS.SETTINGS)
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
  await kvSet(KEYS.SETTINGS, updated)
  return updated
}

export async function getTasks(): Promise<Task[]> {
  return (await kvGet<Task[]>(KEYS.TASKS)) ?? []
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await kvSet(KEYS.TASKS, tasks)
}

export async function getConversations(): Promise<Message[]> {
  const msgs = (await kvGet<Message[]>(KEYS.CONVERSATIONS)) ?? []
  return msgs.slice(-50)
}

export async function addMessage(message: Message): Promise<void> {
  const msgs = await getConversations()
  msgs.push(message)
  await kvSet(KEYS.CONVERSATIONS, msgs.slice(-50))
}

export async function getContent(): Promise<GeneratedContent[]> {
  return (await kvGet<GeneratedContent[]>(KEYS.CONTENT)) ?? []
}

export async function saveContent(content: GeneratedContent): Promise<void> {
  const all = await getContent()
  all.unshift(content)
  await kvSet(KEYS.CONTENT, all.slice(0, 50))
}

export async function getLinkedInResearch(): Promise<GeneratedContent[]> {
  return (await kvGet<GeneratedContent[]>(KEYS.LINKEDIN_RESEARCH)) ?? []
}

export async function saveLinkedInResearch(item: GeneratedContent): Promise<void> {
  const all = await getLinkedInResearch()
  all.unshift(item)
  await kvSet(KEYS.LINKEDIN_RESEARCH, all.slice(0, 20))
}

// ─── AI Sports Research ─────────────────────────────────────────────────────

export interface AiSportsArticle {
  title: string
  description: string
  url: string
  imageUrl: string | null
  source: string
  linkedinPost: string
}

export interface AiSportsResearch {
  date: string
  fetchedAt: string
  articles: AiSportsArticle[]
}

export async function getAiSportsResearch(): Promise<AiSportsResearch[]> {
  return (await kvGet<AiSportsResearch[]>(KEYS.AI_SPORTS_RESEARCH)) ?? []
}

export async function saveAiSportsResearch(item: AiSportsResearch): Promise<void> {
  const all = await getAiSportsResearch()
  const filtered = all.filter((r) => r.date !== item.date)
  filtered.unshift(item)
  await kvSet(KEYS.AI_SPORTS_RESEARCH, filtered.slice(0, 14))
}

// ─── Admin Layer ────────────────────────────────────────────────────────────

export interface AdminInstruction {
  id: string
  text: string
  receivedAt: string
  timeSensitive: boolean
  emotionalTone: boolean
  deliveredAt?: string
  deliveredIn?: string
}

export async function getPendingInstructions(): Promise<AdminInstruction[]> {
  return (await kvGet<AdminInstruction[]>(KEYS.ADMIN_PENDING)) ?? []
}

export async function addPendingInstruction(instr: AdminInstruction): Promise<void> {
  const pending = await getPendingInstructions()
  pending.push(instr)
  await kvSet(KEYS.ADMIN_PENDING, pending)
}

export async function markInstructionDelivered(id: string, deliveredIn: string): Promise<void> {
  const pending = await getPendingInstructions()
  const instr = pending.find((i) => i.id === id)
  if (instr) {
    instr.deliveredAt = new Date().toISOString()
    instr.deliveredIn = deliveredIn
    const delivered = (await kvGet<AdminInstruction[]>(KEYS.ADMIN_DELIVERED)) ?? []
    delivered.unshift(instr)
    await kvSet(KEYS.ADMIN_DELIVERED, delivered.slice(0, 100))
    await kvSet(KEYS.ADMIN_PENDING, pending.filter((i) => i.id !== id))
  }
}

export async function getDeliveredInstructions(): Promise<AdminInstruction[]> {
  return (await kvGet<AdminInstruction[]>(KEYS.ADMIN_DELIVERED)) ?? []
}

// ─── Task Session ───────────────────────────────────────────────────────────

export interface TaskSession {
  active: boolean
  taskIds: string[]
  currentIndex: number
  dateKey: string
  startedAt: string
  waitingForDate?: string
}

export async function getTaskSession(): Promise<TaskSession | null> {
  return kvGet<TaskSession>(KEYS.TASK_SESSION)
}

export async function setTaskSession(session: TaskSession | null): Promise<void> {
  if (session === null) {
    await kvDel(KEYS.TASK_SESSION)
  } else {
    await kvSet(KEYS.TASK_SESSION, session)
  }
}

// ─── Hockey & Workout Plans ─────────────────────────────────────────────────

export interface HockeyPlan {
  hasMatch: boolean
  opponent?: string
  matchDate?: string
  matchTime?: string
}

export interface WorkoutPlan {
  plan: string
  weekStart: string
}

export async function getHockeyPlan(): Promise<HockeyPlan | null> {
  return kvGet<HockeyPlan>(KEYS.HOCKEY_PLAN)
}

export async function saveHockeyPlan(plan: HockeyPlan): Promise<void> {
  await kvSet(KEYS.HOCKEY_PLAN, plan)
}

export async function getWorkoutPlan(): Promise<WorkoutPlan | null> {
  return kvGet<WorkoutPlan>(KEYS.WORKOUT_PLAN)
}

export async function saveWorkoutPlan(plan: WorkoutPlan): Promise<void> {
  await kvSet(KEYS.WORKOUT_PLAN, plan)
}

export async function getMondayQuestionsSent(): Promise<string | null> {
  return kvGet<string>(KEYS.MONDAY_QUESTIONS_SENT)
}

export async function setMondayQuestionsSent(date: string): Promise<void> {
  await kvSet(KEYS.MONDAY_QUESTIONS_SENT, date)
}

// ─── Pomodoro ───────────────────────────────────────────────────────────────

export interface PomodoroSession {
  phase: 'work' | 'break'
  startedAt: string
  round: number
}

export async function getPomodoro(): Promise<PomodoroSession | null> {
  return kvGet<PomodoroSession>(KEYS.POMODORO)
}

export async function setPomodoro(session: PomodoroSession | null): Promise<void> {
  if (session === null) {
    await kvDel(KEYS.POMODORO)
  } else {
    await kvSet(KEYS.POMODORO, session)
  }
}

// ─── Time window ────────────────────────────────────────────────────────────

export async function isWithinTimeWindow(key: string, targetTime: string, windowMinutes = 14): Promise<boolean> {
  const last = await kvGet<string>(key)

  // Use Bratislava local time for comparison
  const nowBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
  const [hours, minutes] = targetTime.split(':').map(Number)
  const target = new Date(nowBratislava)
  target.setHours(hours, minutes, 0, 0)

  const diffMs = Math.abs(nowBratislava.getTime() - target.getTime())
  const diffMin = diffMs / 60000

  if (diffMin > windowMinutes) return false
  if (last) {
    const lastDate = new Date(last)
    const lastBratislava = new Date(lastDate.toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    if (lastBratislava.toDateString() === nowBratislava.toDateString()) return false
  }

  await kvSet(key, new Date().toISOString())
  return true
}
