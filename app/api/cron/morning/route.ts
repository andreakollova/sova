import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings, KEYS, isWithinTimeWindow, getPendingInstructions, markInstructionDelivered, getHockeyPlan, getAiSportsResearch, addMessage } from '@/lib/kv'
import redis from '@/lib/kv'
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

    const nowBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    const todayStr = nowBratislava.toISOString().slice(0, 10)

    // Always check "already sent today" first
    const lastRun = await redis.get<string>(KEYS.CRON_MORNING_LAST)
    if (lastRun && lastRun.slice(0, 10) === todayStr) {
      return NextResponse.json({ skipped: true, reason: 'already_sent_today' })
    }

    if (!force) {
      const shouldRun = await isWithinTimeWindow(KEYS.CRON_MORNING_LAST, settings.morningTime)
      if (!shouldRun) return NextResponse.json({ skipped: true })
    } else {
      // Force mode: mark as run now so we don't double-send
      await redis.set(KEYS.CRON_MORNING_LAST, new Date().toISOString())
    }

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

    const top3tasks = topTasks.slice(0, 3)
    const remainingTasks = topTasks.slice(3)

    const prompt = `Si Soňa – osobná AI asistentka Andrejky (Natky, Fonduly). Je ráno (${dateStr}) a posielaš jej ranný check-in do Discordu.

KONTEXT:
Dnešný kalendár: ${calendarContext}
Zajtra: ${tomorrowContext}
Top 3 úlohy (podľa priority): ${top3tasks.map((t) => `${t.title}${t.project ? ` (${t.project})` : ''}${t.deadline ? ` – do ${t.deadline}` : ''}`).join(' | ')}
${remainingTasks.length > 0 ? `Ďalšie otvorené: ${remainingTasks.length} úloh` : ''}
Emaily: ${urgentEmails.length > 0 ? urgentEmails.map(e => e.subject).join(', ') : 'žiadne'}
Tréning dnes: ${workoutToday ? 'áno' : 'nie'}
${hockeyPlan?.hasMatch && hockeyPlan.matchDate === now.toISOString().slice(0, 10) ? `⚠️ DNES HOKEJOVÝ ZÁPAS${hockeyPlan.opponent ? ` proti ${hockeyPlan.opponent}` : ''}!` : ''}
${adminContext}${toneContext}

NAPÍŠ KRÁTKY RANNÝ CHECK-IN (nie dlhý brief!) ktorý obsahuje:
1. Krátky, osobný pozdrav (1 veta) – spomeň deň, niečo konkrétne z kalendára alebo úloh
2. Bleskový prehľad dňa (2-4 odrážky) – len to najdôležitejšie: čo ju čaká, top úlohy s projektmi, tréning ak je
3. Na záver JASNE ODDELENÁ sekcia s 3 check-in otázkami:

---
**Pred začatím – rýchly check-in:**
🔋 Ako sa dnes cítiš? (energia, nálada)
🎯 Čo je dnes tvoja ONE THING – jedna vec ktorú MUSÍŠ spraviť?
🚧 Je niečo čo ťa brzdí alebo by som mala vedieť?

---

TÓN – KRITICKÉ:
- Píš ako milá, teplá priateľka ktorá sa NAOZAJ teší z každého dňa
- NIKDY nepoužívaj slová ako "hustý", "nabitý", "náročný", "ťažký" pri opisovaní dňa
- Namiesto toho: "čaká ťa zaujímavý deň", "máš pred sebou pekný deň", "dnes toho stihneš dosť"
- Žiadne dramatizovanie množstva úloh – len pokojné, milé zhrnutie
- Kratké vety, prirodzený hovorový jazyk
Jazyk: slovenčina, bez diakritiky je OK.
Formát: Discord markdown. Max 900 znakov (bez sekcie otázok).`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const brief = res.choices[0].message.content ?? ''

    // Mark admin instructions delivered
    for (const instr of [...otherInstructions, ...(emotionalInstr ? [emotionalInstr] : [])]) {
      await markInstructionDelivered(instr.id, 'morning_briefing')
    }

    await sendDiscordMessage(brief, settings.discordChannelId)

    // Save brief to conversation history so bot knows what was asked
    await addMessage({ role: 'assistant', content: brief, timestamp: new Date().toISOString() })

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
    const todayStr2 = now.toISOString().slice(0, 10)
    const todayResearch = aiSports.find((r) => r.date === todayStr2)
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
