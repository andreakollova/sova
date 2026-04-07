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

    // 10:00 work check-in
    const shouldWork = await isWithinTimeWindow('sova:cron:work:last', '10:00')
    if (shouldWork) {
      const openTasks = await getTopPriorityTasks(3)
      const tasksLine = openTasks.length > 0
        ? `Otvorene ulohy: ${openTasks.map((t) => t.title).join(', ')}.`
        : 'Nema ziadne otvorene ulohy.'
      const workRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Si Sona. Napís kratku spravu (2-3 vety) bez diakritiky po slovensky. Opytaj sa Natky ci zacina pracovat a co ju dnes caka. ${tasksLine} Ponukni ze mozes zapnut Pomodoro timer ked bude pripravena (nech napise "zapni pomodoro"). Zensky rod. Bud prirodzena.`,
        }],
      })
      const workMsg = workRes.content[0].type === 'text' ? workRes.content[0].text : ''
      if (workMsg) await sendDiscordMessage(workMsg, settings.discordChannelId)
      return NextResponse.json({ success: true, type: 'work_checkin' })
    }

    // 11:00 check-in
    const shouldCheckin = await isWithinTimeWindow('sova:cron:checkin:last', '11:00')
    if (shouldCheckin) {
      const openTasks = await getTopPriorityTasks(3)
      const tasksLine = openTasks.length > 0
        ? `Otvorene ulohy: ${openTasks.map((t) => t.title).join(', ')}.`
        : 'Nema ziadne otvorene ulohy.'
      const checkinRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Si Sona, Natkina osobna asistentka a priatelka. Napís kratky dopoludajsi check-in (2-3 vety) bez diakritiky, 100% po slovensky. Opytaj sa ako sa ma. ${tasksLine} Ak ma otvorene ulohy, prirodzene sa opytaj ci uz nieco z toho spravila alebo ako to ide. Vzdy "Natka" nie "Natko". Zensky rod vzdy. Bud spontanna.`,
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
