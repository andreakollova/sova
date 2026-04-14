import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSettings, getAiSportsResearch } from '@/lib/kv'
import redis from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { getTodayEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'
import { MEDIA } from '@/lib/media'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export const dynamic = 'force-dynamic'

// Only runs between 10:00 and 21:00, once per hour (9:00 covered by morning brief)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    const hour = now.getHours()
    const minutes = now.getMinutes()

    // Only run between 10-21h and only near top of hour (0-14 min)
    if (hour < 10 || hour >= 21) return NextResponse.json({ skipped: true, reason: 'outside hours' })
    if (minutes > 14) return NextResponse.json({ skipped: true, reason: 'not top of hour' })

    // Check if already sent this hour
    const lastKey = `sova:cron:hourly:last:${hour}`
    const lastSent = await redis.get<string>(lastKey)
    const today = now.toISOString().slice(0, 10)
    if (lastSent === today) return NextResponse.json({ skipped: true, reason: 'already sent' })
    await redis.set(lastKey, today)

    // Skip hour covered by evening cron
    if (hour === 20) return NextResponse.json({ skipped: true, reason: 'covered by other cron' })

    const [settings, events, tasks, aiSports] = await Promise.all([
      getSettings(),
      getTodayEvents(),
      getTopPriorityTasks(10),
      getAiSportsResearch(),
    ])

    // LinkedIn posts at 15:00
    if (hour === 15) {
      const todayResearch = aiSports.find((r) => r.date === today)
      if (todayResearch && todayResearch.articles.length > 0) {
        for (const a of todayResearch.articles) {
          await sendDiscordMessage(
            `📲 **LinkedIn post – ${a.title}**\n_Zdroj: ${a.source} — ${a.url}_${a.imageUrl ? `\n🖼️ Odporúčaný obrázok: ${a.imageUrl}` : ''}\n\n${a.linkedinPost}`,
            settings.discordChannelId
          )
        }
        return NextResponse.json({ success: true, type: 'linkedin_reminder' })
      }
    }

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

    // Remaining events today
    const upcomingEvents = events.filter(e => parseInt(e.start.split(':')[0]) >= hour)
    const calendarStr = upcomingEvents.length > 0
      ? upcomingEvents.map(e => `${e.start} – ${e.summary}`).join('\n')
      : 'ziadne dalsie udalosti'

    const tasksStr = tasks.length > 0
      ? tasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]${t.project ? ` (${t.project})` : ''}${t.deadline ? ` – deadline: ${t.deadline}` : ''}`).join('\n')
      : 'ziadne otvorene ulohy'

    // Hourly work plan using GPT-4o
    const prompt = `Si Soňa – osobna AI asistentka Andrejky (Natky, Fonduly). Teraz je ${hour}:00.

Udalosti dnes (zostatok):
${calendarStr}

Otvorene ulohy (podla priority):
${tasksStr}

NAPÍŠ hodinovy plan na najblizsie 2 hodiny v tomto formate:
🕐 **${hour}:00 – ${hour + 1}:00** – [konkretna uloha alebo projekt, max 8 slov]
🕑 **${hour + 1}:00 – ${hour + 2}:00** – [konkretna uloha alebo projekt, max 8 slov]

Potom 1 kratka motivacna veta (max 12 slov). Vyber ulohy podla priority, projektu a deadlinu. Ak je v kalendari udalost v tomto case okne, zohladni ju (napr. skrati blok pred trenigom). Max 220 znakov. Slovenčina.`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 160,
      messages: [{ role: 'user', content: prompt }],
    })

    const msg = res.choices[0].message.content ?? ''
    if (msg) await sendDiscordMessage(msg, settings.discordChannelId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Hourly cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
