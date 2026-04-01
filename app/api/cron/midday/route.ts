import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow } from '@/lib/kv'
import redis from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { MEDIA } from '@/lib/media'
import { getTodayEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getSettings()

    // 11:00 check-in
    const shouldCheckin = await isWithinTimeWindow('sova:cron:checkin:last', '11:00')
    if (shouldCheckin) {
      const checkinRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Si Sona, Natkina osobna asistentka a priatelka. Napís kratky ranný check-in (1-2 vety) bez diakritiky, 100% po slovensky, ziadna azbuka. Prirodzene sa opytaj ako sa ma. Vzdy "Natka" nie "Natko". Natka je zena – zensky rod vzdy. Bud spontanna a uprimna.`,
        }],
      })
      const checkinMsg = checkinRes.content[0].type === 'text' ? checkinRes.content[0].text : ''
      if (checkinMsg) await sendDiscordMessage(checkinMsg, settings.discordChannelId)
      return NextResponse.json({ success: true, type: 'checkin' })
    }

    const shouldRun = await isWithinTimeWindow(KEYS.CRON_MIDDAY_LAST, '12:00')
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [events, tasks] = await Promise.all([
      getTodayEvents(),
      getTopPriorityTasks(3),
    ])

    const afternoonEvents = events.filter((e) => {
      const hour = parseInt(e.start.split(':')[0])
      return hour >= 12
    })

    const hasBackToBack = events.length >= 3

    const msgRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Napíš krátku poludňajšiu správu pre Natku v slovenčine (max 5 viet).
Zahrň: povzbudenie do poobedia, 1-2 priority na odpoludnie, osobnú poznámku.
${hasBackToBack ? 'Má dnes veľa stretnutí – pripomeň jej aby sa najedla a oddýchla.' : ''}
Poobedné udalosti: ${afternoonEvents.map((e) => e.summary).join(', ') || 'voľné'}
Priority: ${tasks.map((t) => t.title).join(', ') || 'žiadne'}
Buď stručná, teplá, konkrétna. Max 1 emoji.`,
        },
      ],
    })

    const msg = msgRes.content[0].type === 'text' ? msgRes.content[0].text : ''
    const name = Math.random() > 0.5 ? settings.userName : 'Fondula'

    await sendDiscordMessage(`☀️ **Poludnie, ${name}!**\n\n${msg}`, settings.discordChannelId)

    await sendDiscordMessage(
      `${MEDIA.lunch} Dobru chut, ${name}! Nezabudni si odochnout.`,
      settings.discordChannelId
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Midday cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
