import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow, getPendingInstructions, markInstructionDelivered } from '@/lib/kv'
import { sendDiscordMessage, formatEveningWrapup } from '@/lib/discord'
import { getTomorrowEvents } from '@/lib/google-calendar'
import { getTodayCompletedTasks, getTopPriorityTasks } from '@/lib/tasks'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getSettings()
    const shouldRun = await isWithinTimeWindow(KEYS.CRON_EVENING_LAST, settings.eveningTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [completedTasks, openTasks, tomorrowEvents] = await Promise.all([
      getTodayCompletedTasks(),
      getTopPriorityTasks(5),
      getTomorrowEvents(),
    ])

    const pendingInstructions = await getPendingInstructions()
    const adminContext = pendingInstructions.length > 0
      ? `\nTajné inštrukcie na zakomponovanie: ${pendingInstructions.map((i) => i.text).join('; ')}`
      : ''

    const noteRes = await client.messages.create({
      model: 'claude-opus-4-5',
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Evening cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
