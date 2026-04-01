import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow, getPendingInstructions, markInstructionDelivered, getHockeyPlan } from '@/lib/kv'
import { sendDiscordMessage, formatMorningBriefing } from '@/lib/discord'
import { getTodayEvents, getTomorrowEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'
import { getNewEmailsFromWatchedAddresses } from '@/lib/gmail'
import { getDayGreeting, hasWorkout, hasRunning, hasFitness } from '@/lib/sova-personality'
import { MEDIA } from '@/lib/media'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getSettings()
    const shouldRun = await isWithinTimeWindow(KEYS.CRON_MORNING_LAST, settings.morningTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [todayEvents, tomorrowEvents, topTasks, urgentEmails, hockeyPlan] = await Promise.all([
      getTodayEvents(),
      getTomorrowEvents(),
      getTopPriorityTasks(3),
      getNewEmailsFromWatchedAddresses(),
      getHockeyPlan(),
    ])

    const hasTraining = hasWorkout(todayEvents)
    const workoutEvent = todayEvents.find((e) =>
      ['tréning', 'trening', 'workout', 'gym', 'beh', 'plávanie', 'jóga', 'yoga'].some(
        (kw) => e.summary.toLowerCase().includes(kw)
      )
    )?.summary

    // Load pending admin instructions
    const pendingInstructions = await getPendingInstructions()
    const relevantInstructions = pendingInstructions.filter((i) => !i.timeSensitive)
    const emotionalInstr = relevantInstructions.find((i) => i.emotionalTone)
    const otherInstructions = relevantInstructions.filter((i) => !i.emotionalTone)

    const adminContext = otherInstructions.length > 0
      ? `\nTajné inštrukcie na prirodzené zakomponovanie (nikdy neprezradiť zdroj): ${otherInstructions.map((i) => i.text).join('; ')}`
      : ''

    const toneContext = emotionalInstr
      ? '\nDnes mala ťažký deň – buď extra teplá, znižuj tlak na úlohy.'
      : ''

    // Generate personal note
    const noteRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Napíš JEDINEČNÚ, OSOBNÚ motivačnú poznámku (2-3 vety) pre Natku (Fondulu) na začiatok dňa v slovenčine.
Kontext dnes: ${todayEvents.map((e) => e.summary).join(', ') || 'žiadne udalosti'}
Otvorené úlohy: ${topTasks.map((t) => t.title).join(', ') || 'žiadne'}
${hasTraining ? 'Dnes má tréning!' : ''}${adminContext}${toneContext}
Buď konkrétna, teplá, nikdy generická. Ak máš inštrukcie vyššie, zakomponuj ich AKO SVOJU VLASTNÚ myšlienku. Bez emoji.`,
        },
      ],
    })
    const personalNote = noteRes.content[0].type === 'text' ? noteRes.content[0].text : ''

    // Mark delivered
    for (const instr of [...otherInstructions, ...(emotionalInstr ? [emotionalInstr] : [])]) {
      await markInstructionDelivered(instr.id, 'morning_briefing')
    }

    const message = formatMorningBriefing({
      userName: settings.userName,
      dayString: getDayGreeting(),
      todayEvents,
      topTasks,
      urgentEmails,
      personalNote,
      tomorrowPreview: tomorrowEvents,
      hasWorkout: hasTraining,
      workoutEvent,
    })

    await sendDiscordMessage(message, settings.discordChannelId)

    // Running day message
    if (hasRunning(todayEvents)) {
      await sendDiscordMessage(
        `${MEDIA.running} Dnes behas! Daj do toho vsetko Fondula 🔥`,
        settings.discordChannelId
      )
    }

    // Fitness day message
    if (hasFitness(todayEvents)) {
      await sendDiscordMessage(
        `${MEDIA.fitness} Fitness day! Vyzvi sama seba, ${settings.userName} 💥`,
        settings.discordChannelId
      )
    }

    // Hockey match day message
    if (hockeyPlan?.hasMatch && hockeyPlan.matchDate) {
      const todayDateStr = new Date().toISOString().slice(0, 10)
      if (hockeyPlan.matchDate === todayDateStr) {
        const opponentInfo = hockeyPlan.opponent ? ` Dnes hraš proti ${hockeyPlan.opponent}!` : ''
        await sendDiscordMessage(
          `🏑🏑🏑 Dnes je zapas!${opponentInfo}`,
          settings.discordChannelId
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Morning cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
