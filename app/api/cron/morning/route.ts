import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow, getPendingInstructions, markInstructionDelivered, getHockeyPlan, getAiSportsResearch } from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { getTodayEvents, getTomorrowEvents } from '@/lib/google-calendar'
import { getTopPriorityTasks } from '@/lib/tasks'
import { getNewEmailsFromWatchedAddresses } from '@/lib/gmail'
import { hasRunning, hasFitness } from '@/lib/sova-personality'
import { MEDIA } from '@/lib/media'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PROJECTS = ['HockeyRefresh', 'Sportqo', 'Drilzz', 'SZPH', 'EuroHockey']
const SK_DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota']
const SK_MONTHS = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra']

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const force = new URL(req.url).searchParams.get('force') === '1'
    const settings = await getSettings()
    const shouldRun = force || await isWithinTimeWindow(KEYS.CRON_MORNING_LAST, settings.morningTime)
    if (!shouldRun) return NextResponse.json({ skipped: true })

    const [todayEvents, tomorrowEvents, topTasks, urgentEmails, hockeyPlan, aiSports] = await Promise.all([
      getTodayEvents(),
      getTomorrowEvents(),
      getTopPriorityTasks(10),
      getNewEmailsFromWatchedAddresses(),
      getHockeyPlan(),
      getAiSportsResearch(),
    ])

    // Load pending admin instructions
    const pendingInstructions = await getPendingInstructions()
    const relevantInstructions = pendingInstructions.filter((i) => !i.timeSensitive)
    const emotionalInstr = relevantInstructions.find((i) => i.emotionalTone)
    const otherInstructions = relevantInstructions.filter((i) => !i.emotionalTone)
    const adminContext = otherInstructions.length > 0
      ? `\nŠpeciálne inštrukcie (zakomponuj prirodzene): ${otherInstructions.map((i) => i.text).join('; ')}`
      : ''
    const toneContext = emotionalInstr ? '\nDnes mala náročný deň – buď extra teplá, netlač na výkon.' : ''

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    const dateStr = `${SK_DAYS[now.getDay()]}, ${now.getDate()}. ${SK_MONTHS[now.getMonth()]} ${now.getFullYear()}`

    const tasksContext = topTasks.length > 0
      ? topTasks.map((t, i) => `${i + 1}. ${t.title} [${t.priority}]${t.project ? ` (${t.project})` : ''}${t.deadline ? ` – deadline: ${t.deadline}` : ''}`).join('\n')
      : 'žiadne otvorené úlohy'

    const calendarContext = todayEvents.length > 0
      ? todayEvents.map((e) => `${e.start} – ${e.summary}`).join('\n')
      : 'žiadne udalosti'

    const tomorrowContext = tomorrowEvents.length > 0
      ? tomorrowEvents.slice(0, 3).map((e) => `${e.start} – ${e.summary}`).join('\n')
      : 'nič naplánované'

    const emailContext = urgentEmails.length > 0
      ? urgentEmails.map((e) => `od: ${e.from} | ${e.subject}`).join('\n')
      : 'žiadne dôležité emaily'

    const workoutToday = todayEvents.some((e) =>
      ['tréning', 'trening', 'workout', 'gym', 'beh', 'plávanie', 'hokej'].some((kw) => e.summary.toLowerCase().includes(kw))
    )

    const prompt = `Si Soňa – osobná AI asistentka Andrejky (Natky, Fonduly). Je ráno (${dateStr}) a posielaš jej ranný brief do Discordu.

KONTEXT:
Dnešný kalendár:\n${calendarContext}
Zajtra:\n${tomorrowContext}
Otvorené úlohy:\n${tasksContext}
Dôležité emaily:\n${emailContext}
Dnes má tréning: ${workoutToday ? 'áno' : 'nie'}
Jej projekty: ${PROJECTS.join(', ')}
${hockeyPlan?.hasMatch && hockeyPlan.matchDate === now.toISOString().slice(0, 10) ? `Dnes má hokejový zápas${hockeyPlan.opponent ? ` proti ${hockeyPlan.opponent}` : ''}!` : ''}
${adminContext}${toneContext}

NAPÍŠ RANNÝ BRIEF ktorý obsahuje:
1. Teplý, osobný pozdrav (1-2 vety) – nie generický
2. Prehľad dňa – čo ju dnes čaká
3. Úlohy – zhrň priority, navrhni poradie, ku každej úlohe s projektom spomeň projekt
4. Focus time – navrhni kedy sa sústrediť na čo (napr. "9-11 Sportqo, po tréningu EuroHockey materiály")
5. Tréning – ak ho má dnes, povzbuď; spomeň aj ďalší v týždni ak vieš
6. Pomodoro tip – navrhni koľko pomodoros a na čo
7. Otázka na projekty – prirodzene sa opýtaj na jeden konkrétny projekt (vyber podľa úloh)

Tón: priateľský, teplý, konkrétny – ako by ti písala kamarátka ktorá ťa dobre pozná. Nie korporátne, nie generické.
Jazyk: slovenčina, bez diakritiky je OK
Formát: Discord markdown (tučné, odrážky). Max 1800 znakov celkovo.`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const brief = res.choices[0].message.content ?? ''

    // Mark admin instructions delivered
    for (const instr of [...otherInstructions, ...(emotionalInstr ? [emotionalInstr] : [])]) {
      await markInstructionDelivered(instr.id, 'morning_briefing')
    }

    await sendDiscordMessage(brief, settings.discordChannelId)

    // Running / fitness media
    if (hasRunning(todayEvents)) {
      await sendDiscordMessage(`${MEDIA.running} Dnes behas! Daj do toho vsetko Fondula 🔥`, settings.discordChannelId)
    }
    if (hasFitness(todayEvents)) {
      await sendDiscordMessage(`${MEDIA.fitness} Fitness day! Vyzvi sama seba 💥`, settings.discordChannelId)
    }

    // Hockey match
    if (hockeyPlan?.hasMatch && hockeyPlan.matchDate === now.toISOString().slice(0, 10)) {
      const opponentInfo = hockeyPlan.opponent ? ` Dnes hras proti ${hockeyPlan.opponent}!` : ''
      await sendDiscordMessage(`🏑🏑🏑 Dnes je zapas!${opponentInfo}`, settings.discordChannelId)
    }

    // AI sports research teaser
    const todayStr = now.toISOString().slice(0, 10)
    const todayResearch = aiSports.find((r) => r.date === todayStr)
    if (todayResearch && todayResearch.articles.length > 0) {
      const titles = todayResearch.articles.map((a, i) => `${i + 1}. **${a.title}** _(${a.source})_`).join('\n')
      await sendDiscordMessage(
        `🤖 **AI v sporte dnes:**\n${titles}\n\n_LinkedIn posty ti poslem o 15:00_ 📲`,
        settings.discordChannelId
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Morning cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
