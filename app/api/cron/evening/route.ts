import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow, getPendingInstructions, markInstructionDelivered } from '@/lib/kv'
import redis from '@/lib/kv'
import { sendDiscordMessage, formatEveningWrapup } from '@/lib/discord'
import { getTodayEvents, getTomorrowEvents } from '@/lib/google-calendar'
import { getTodayCompletedTasks, getTopPriorityTasks } from '@/lib/tasks'
import { hasWorkout } from '@/lib/sova-personality'
import { MEDIA } from '@/lib/media'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const force = new URL(req.url).searchParams.get('force') === '1'
    const settings = await getSettings()

    // Check goodnight window (21:20)
    const shouldSendGoodnight = await isWithinTimeWindow(KEYS.CRON_GOODNIGHT_LAST, '21:20')
    if (shouldSendGoodnight) {
      await sendDiscordMessage(
        `${MEDIA.goodnight} Laska, ${settings.userName} 💜 Zasluzis si odpocnok. Dobru noc.`,
        settings.discordChannelId
      )
      return NextResponse.json({ success: true, type: 'goodnight' })
    }

    const shouldRun = force || await isWithinTimeWindow(KEYS.CRON_EVENING_LAST, settings.eveningTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [completedTasks, openTasks, tomorrowEvents, todayEvents] = await Promise.all([
      getTodayCompletedTasks(),
      getTopPriorityTasks(5),
      getTomorrowEvents(),
      getTodayEvents(),
    ])

    const pendingInstructions = await getPendingInstructions()
    const adminContext = pendingInstructions.length > 0
      ? `\nTajné inštrukcie na zakomponovanie: ${pendingInstructions.map((i) => i.text).join('; ')}`
      : ''

    const noteRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `Napíš TEPLÚ, OSOBNÚ záverečnú poznámku večera (2-3 vety) pre Natku v slovenčine.
Dnes splnila: ${completedTasks.map((t) => t.title).join(', ') || 'nič nešpeciálne'}
Zajtra ju čaká: ${tomorrowEvents.map((e) => e.summary).join(', ') || 'voľný deň'}${adminContext}
Buď autentická a povzbudivá. Ak máš inštrukcie, zakomponuj ich ako svoju vlastnú myšlienku.`,
        },
      ],
    })
    const closingNote = noteRes.content[0].type === 'text' ? noteRes.content[0].text : ''

    for (const instr of pendingInstructions) {
      await markInstructionDelivered(instr.id, 'evening_wrapup')
    }

    const message = formatEveningWrapup({
      userName: settings.userName,
      completedTasks,
      openTasks,
      tomorrowEvents,
      closingNote,
    })

    await sendDiscordMessage(message, settings.discordChannelId)

    // Workout check-in: if today had a workout in calendar and we haven't checked yet
    if (hasWorkout(todayEvents)) {
      const todayStr = new Date().toISOString().slice(0, 10)
      const workoutCheckSent = await redis.get<string>(KEYS.WORKOUT_CHECK_SENT)
      if (workoutCheckSent !== todayStr) {
        await sendDiscordMessage(
          `Dnes si mala trening v plane. Slo to? Odpis mi ano/nie 💪`,
          settings.discordChannelId
        )
        await redis.set(KEYS.WORKOUT_CHECK_SENT, todayStr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Evening cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
