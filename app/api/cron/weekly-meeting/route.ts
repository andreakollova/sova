import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, isWithinTimeWindow, KEYS, saveLinkedInResearch, type GeneratedContent } from '@/lib/kv'
import { sendDiscordMessage, formatWeeklyMeeting } from '@/lib/discord'
import { getWeekEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'
import { getDayGreeting } from '@/lib/sova-personality'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Only run on Mondays
    const dayOfWeek = new Date().getDay()
    if (dayOfWeek !== 1) return NextResponse.json({ skipped: true, reason: 'not_monday' })

    const settings = await getSettings()
    const shouldRun = await isWithinTimeWindow(KEYS.CRON_WEEKLY_LAST, settings.morningTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [weekEvents, topTasks] = await Promise.all([
      getWeekEvents(),
      getTopPriorityTasks(5),
    ])

    // Generate LinkedIn ideas for the week
    const linkedinRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `Vygeneruj 3 konkrétne LinkedIn témy pre Natku na tento týždeň. Oblasti: marketing, Sportqo, Drixton, podnikanie, osobný rozvoj.
Formát: len zoznam, každá téma na 1 riadku, začína čislom. Píš v slovenčine. Buď konkrétna, nie generická.`,
        },
      ],
    })

    const linkedinText = linkedinRes.content[0].type === 'text' ? linkedinRes.content[0].text : ''
    const linkedinIdeas = linkedinText.split('\n').filter((l) => l.trim()).slice(0, 3)

    // Save research
    const researchItem: GeneratedContent = {
      id: `research_${Date.now()}`,
      type: 'research',
      title: `Týždenné LinkedIn návrhy – ${getDayGreeting()}`,
      content: linkedinText,
      createdAt: new Date().toISOString(),
    }
    await saveLinkedInResearch(researchItem)

    // Generate weekly strategic note
    const noteRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Napíš STRATEGICKÚ, OSOBNÚ týždennú motiváciu (3-4 vety) pre Natku na tento týždeň v slovenčine.
Tento týždeň: ${weekEvents.flatMap((d) => d.events.map((e) => e.summary)).join(', ') || 'flexibilný týždeň'}
Otvorené priority: ${topTasks.map((t) => t.title).join(', ') || 'žiadne'}
Buď konkrétna, povzbudzujúca a priamo ku veci. Žiadne klišé.`,
        },
      ],
    })

    const weeklyNote = noteRes.content[0].type === 'text' ? noteRes.content[0].text : ''

    const message = formatWeeklyMeeting({
      userName: settings.userName,
      weekEvents,
      weeklyNote,
      linkedinIdeas,
    })

    await sendDiscordMessage(message, settings.discordChannelId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Weekly meeting cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
