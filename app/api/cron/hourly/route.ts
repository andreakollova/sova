import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings } from '@/lib/kv'
import redis from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { getTodayEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'
import { MEDIA } from '@/lib/media'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dynamic = 'force-dynamic'

// Only runs between 9:00 and 21:00, once per hour
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    const hour = now.getHours()
    const minutes = now.getMinutes()

    // Only run between 9-21h and only near top of hour (0-14 min)
    if (hour < 9 || hour >= 21) return NextResponse.json({ skipped: true, reason: 'outside hours' })
    if (minutes > 14) return NextResponse.json({ skipped: true, reason: 'not top of hour' })

    // Check if already sent this hour
    const lastKey = `sova:cron:hourly:last:${hour}`
    const lastSent = await redis.get<string>(lastKey)
    const today = now.toISOString().slice(0, 10)
    if (lastSent === today) return NextResponse.json({ skipped: true, reason: 'already sent' })
    await redis.set(lastKey, today, { ex: 60 * 60 * 2 })

    // Skip hours covered by other crons (11, 12, 20)
    if ([11, 12, 20].includes(hour)) return NextResponse.json({ skipped: true, reason: 'covered by other cron' })

    const [settings, events, tasks] = await Promise.all([
      getSettings(),
      getTodayEvents(),
      getTopPriorityTasks(3),
    ])

    // Check if there's a workout coming up in the next 2 hours
    const upcomingWorkout = events.find(e => {
      const eventHour = parseInt(e.start.split(':')[0])
      const workoutKw = ['beh', 'run', 'fitness', 'gym', 'trening', 'workout', 'hokej', 'zapas']
      return eventHour >= hour && eventHour <= hour + 2 &&
        workoutKw.some(kw => e.summary.toLowerCase().includes(kw))
    })

    if (upcomingWorkout) {
      const isRunning = ['beh', 'run'].some(kw => upcomingWorkout.summary.toLowerCase().includes(kw))
      const isFitness = ['fitness', 'gym', 'silovy', 'workout'].some(kw => upcomingWorkout.summary.toLowerCase().includes(kw))
      const isHockey = ['hokej', 'zapas'].some(kw => upcomingWorkout.summary.toLowerCase().includes(kw))

      const mediaUrl = isRunning ? MEDIA.running : isFitness ? MEDIA.fitness : isHockey ? MEDIA.hockey : null
      const msg = `Pripomienka: o ${upcomingWorkout.start} mas ${upcomingWorkout.summary}! 💪`
      await sendDiscordMessage(msg, settings.discordChannelId)
      if (mediaUrl) await sendDiscordMessage(mediaUrl, settings.discordChannelId)
      return NextResponse.json({ success: true, type: 'workout_reminder' })
    }

    // General hourly nudge
    const nextEvent = events.find(e => parseInt(e.start.split(':')[0]) > hour)
    const msgRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Si Sona, Natkina osobna asistentka. Je ${hour}:00. Napís kратку (1-2 vety) prirodzenu spravу bez diakritiky po slovensky. Natka je zena – pouzivaj zensky rod (mala, robila, prisla...). ${nextEvent ? `Dalsia udalost: ${nextEvent.summary} o ${nextEvent.start}.` : `Otvorene ulohy: ${tasks.map(t => t.title).join(', ') || 'ziadne'}.`} Bud milа, konkretna, nie genericka. Ziadna azbuka.`,
      }],
    })

    const msg = msgRes.content[0].type === 'text' ? msgRes.content[0].text : ''
    if (msg) await sendDiscordMessage(msg, settings.discordChannelId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Hourly cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
