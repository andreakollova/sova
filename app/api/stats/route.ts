import { NextResponse } from 'next/server'
import { getTasks } from '@/lib/kv'
import redis from '@/lib/kv'

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const tasks = await getTasks()
    const completedToday = tasks.filter(
      (t) => t.status === 'done' && t.completedAt?.slice(0, 10) === today
    ).length

    const pomodoroKey = `sova:pomodoro:count:${today}`
    const pomodoroCount = (await redis.get<number>(pomodoroKey)) ?? 0

    return NextResponse.json({ completedToday, pomodoroCount })
  } catch {
    return NextResponse.json({ completedToday: 0, pomodoroCount: 0 })
  }
}
