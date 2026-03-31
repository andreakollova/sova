import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, isWithinTimeWindow, KEYS } from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { getTomorrowEvents } from '@/lib/google-calendar'
import { hasWorkout, hasContentDeadline, hasMeeting } from '@/lib/sova-personality'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Pre-task reminder runs 1 hour before evening briefing
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getSettings()

    // Calculate pre-task time = evening time - 60 min
    const [h, m] = settings.eveningTime.split(':').map(Number)
    const preTaskHour = h - 1
    const preTaskTime = `${String(preTaskHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    const shouldRun = await isWithinTimeWindow(`sova:cron:pretask:last`, preTaskTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const tomorrowEvents = await getTomorrowEvents()
    if (tomorrowEvents.length === 0) return NextResponse.json({ skipped: true, reason: 'no_tomorrow_events' })

    const hasTraining = hasWorkout(tomorrowEvents)
    const hasContent = hasContentDeadline(tomorrowEvents)
    const hasMeet = hasMeeting(tomorrowEvents)

    const messages: string[] = []
    const name = settings.userName

    if (hasContent) {
      const contentEvent = tomorrowEvents.find((e) =>
        ['článok', 'post', 'content', 'linkedin', 'blog'].some((kw) =>
          e.summary.toLowerCase().includes(kw)
        )
      )
      messages.push(
        `🦉 **${name}, zajtra máš: ${contentEvent?.summary || 'content task'}**\n\nPovedz mi názov, tému a 3-5 hlavných myšlienok – ja ti to do rána pripravím! Stačí odpovedať sem alebo v chate na SOVA dashboarde.`
      )
    }

    if (hasMeet) {
      const meetEvent = tomorrowEvents.find((e) =>
        ['meeting', 'hovor', 'call', 'stretnutie', 'prezentácia', 'demo'].some((kw) =>
          e.summary.toLowerCase().includes(kw)
        )
      )
      const prepRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Napíš krátku správu pre Natku v slovenčine: zajtra má "${meetEvent?.summary}". Spýtaj sa ju, čo treba pripraviť a ponúkni pomoc. Max 3 vety, teplý tón.`,
          },
        ],
      })
      const prepMsg = prepRes.content[0].type === 'text' ? prepRes.content[0].text : ''
      messages.push(`📋 ${prepMsg}`)
    }

    if (hasTraining) {
      messages.push(`💪 **${name}, zajtra máš tréning!** Priprav si oblečenie, fľašu a mentálne sa nalaď. Ideš za svojimi snami!`)
    }

    if (messages.length > 0) {
      await sendDiscordMessage(messages.join('\n\n'), settings.discordChannelId)
    }

    return NextResponse.json({ success: true, sentMessages: messages.length })
  } catch (err) {
    console.error('Pre-task reminder error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
