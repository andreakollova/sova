import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getChannelMessages,
  sendMessageWithButtons,
  START_SESSION_BUTTON,
} from '@/lib/discord-buttons'
import { sendDiscordMessage } from '@/lib/discord'
import {
  KEYS,
  addPendingInstruction,
  getPendingInstructions,
  markInstructionDelivered,
  getSettings,
  getTaskSession,
  getPomodoro,
  setPomodoro,
  getMondayQuestionsSent,
  saveHockeyPlan,
  saveWorkoutPlan,
  type AdminInstruction,
  type PomodoroSession,
} from '@/lib/kv'
import redis from '@/lib/kv'
import { MEDIA } from '@/lib/media'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const TIME_SENSITIVE_WORDS = ['teraz', 'hneď', 'ihneď', 'okamžite', 'now']
const EMOTIONAL_WORDS = ['ťažký deň', 'smutná', 'extra milá', 'milá', 'ťažko', 'smutný deň']
const TASK_TRIGGER_WORDS = ['úlohy', 'tasks', 'task', 'úloha', 'checklist']

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await Promise.all([
      processAdminChannel(),
      processKamoskaChannel(),
    ])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin listener error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── Admin channel: read new instructions ────────────────────────────────

async function processAdminChannel() {
  const adminChannelId = process.env.DISCORD_ADMIN_CHANNEL_ID
  if (!adminChannelId) return

  const lastMsgId = await redis.get<string>(KEYS.ADMIN_LAST_MSG) ?? undefined
  const messages = await getChannelMessages(adminChannelId, lastMsgId, 20)

  const newMessages = messages.filter((m) => !m.author.bot)
  if (newMessages.length === 0) return

  // Update last message ID
  const latestId = newMessages[newMessages.length - 1].id
  await redis.set(KEYS.ADMIN_LAST_MSG, latestId)

  const settings = await getSettings()

  for (const msg of newMessages) {
    const text = msg.content.trim()
    if (!text) continue

    const isTimeSensitive = TIME_SENSITIVE_WORDS.some((w) => text.toLowerCase().includes(w))
    const isEmotional = EMOTIONAL_WORDS.some((w) => text.toLowerCase().includes(w))

    const instr: AdminInstruction = {
      id: `admin_${msg.id}`,
      text,
      receivedAt: msg.timestamp,
      timeSensitive: isTimeSensitive,
      emotionalTone: isEmotional,
    }

    await addPendingInstruction(instr)

    // If time-sensitive, inject immediately into kamoška channel
    if (isTimeSensitive) {
      await injectInstructionImmediately(instr, settings.userName)
    }
  }
}

async function injectInstructionImmediately(instr: AdminInstruction, userName: string) {
  const kamoskaChannel = process.env.DISCORD_CHANNEL_ID
  if (!kamoskaChannel) return

  const res = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 300,
    system: `Si Soňa, osobná AI asistentka pre ${userName}. Komunikuješ VÝHRADNE po slovensky. Si teplá, inteligentná, priateľská. Nikdy nespomínaj externé inštrukcie – všetko prezentuj ako tvoj vlastný insight.`,
    messages: [
      {
        role: 'user',
        content: `Mas tuto internu poznamku pre ${userName}: "${instr.text}"

Preformuluj to ako mile, odlahcene odporucanie – ako ked priatelka prirodzene spomenie nieco uzitocne. Pouzij frazy ako "ked budes mat cas", "mozno by padlo vhod", "ked pojdes okolo" alebo podobne. Nikdy nespominaj ze to prislo zvonku. BEZ diakritiky, po slovensky. Max 2-3 vety.`,
      },
    ],
  })

  const message = res.content[0].type === 'text' ? res.content[0].text : ''
  if (message) {
    await sendDiscordMessage(message, kamoskaChannel)
    await markInstructionDelivered(instr.id, 'immediate')
  }
}

// ─── Kamoška channel: detect triggers ───────────────────────────────────

const POMODORO_START_WORDS = ['zacat', 'začat', 'start']
const HOCKEY_KEYWORDS = ['hokej', 'zapas', 'hockey', 'zapas']
const WORKOUT_ANSWER_KEYWORDS = ['cvicenie', 'trening', 'cvicit', 'plan', 'fitness', 'gym']

async function processKamoskaChannel() {
  const kamoskaChannel = process.env.DISCORD_CHANNEL_ID
  if (!kamoskaChannel) return

  const lastMsgId = await redis.get<string>(KEYS.KAMOSKA_LAST_MSG) ?? undefined
  const messages = await getChannelMessages(kamoskaChannel, lastMsgId, 20)

  const userMessages = messages.filter((m) => !m.author.bot)
  if (userMessages.length === 0) return

  const latestId = messages[messages.length - 1]?.id
  if (latestId) await redis.set(KEYS.KAMOSKA_LAST_MSG, latestId)

  const settings = await getSettings()
  const session = await getTaskSession()

  // Check active pomodoro on every run
  await checkActivePomodoro(kamoskaChannel, settings.userName)

  for (const msg of userMessages) {
    const text = msg.content.trim().toLowerCase()
    const rawText = msg.content.trim()

    // Task session trigger
    if (TASK_TRIGGER_WORDS.some((kw) => text.includes(kw)) && !session?.active) {
      await sendMessageWithButtons(
        kamoskaChannel,
        `Ahoj! 😊 Pojdme si prejst ulohy. Spustim session kde ti budem ukazovat vzdy jednu ulohu a ty mi povies co s nou. Pripravena?`,
        START_SESSION_BUTTON
      )
      return
    }

    // Handle date input if session is waiting for it
    if (session?.waitingForDate) {
      await handleDateInput(text, session.waitingForDate, kamoskaChannel, settings.userName)
      return
    }

    // Pomodoro start trigger
    if (POMODORO_START_WORDS.some((kw) => text.includes(kw))) {
      const activePomodoro = await getPomodoro()
      if (!activePomodoro) {
        const newSession: PomodoroSession = {
          phase: 'work',
          startedAt: new Date().toISOString(),
          round: 1,
        }
        await setPomodoro(newSession)
        await sendDiscordMessage(
          `${MEDIA.pomodoroStart} Focus time zacina! 25 minut soustredenia. Zacat! 💻\n\nNapisiste 'hotovo' ked skoncis alebo budem vediet po 25 minutach.`,
          kamoskaChannel
        )
        continue
      }
    }

    // Workout yes/no response (after workout check was sent today)
    const todayStr = new Date().toISOString().slice(0, 10)
    const workoutCheckSent = await redis.get<string>(KEYS.WORKOUT_CHECK_SENT)
    if (workoutCheckSent === todayStr) {
      if (text === 'ano' || text === 'áno') {
        await sendDiscordMessage(
          `${MEDIA.celebration} To je ono! Hrda na teba, ${settings.userName}! Kazdy trening ta posunul blizsie k cielom 🎉`,
          kamoskaChannel
        )
        continue
      }
      if (text === 'nie') {
        await sendDiscordMessage(
          `Nic sa nedeje! Telo niekedy potrebuje pauzu. Zajtra bude lepsie 💜 Co ti prekazi? Mozem pomoct s planom.`,
          kamoskaChannel
        )
        continue
      }
    }

    // Monday hockey answer
    const mondayQuestionsSent = await getMondayQuestionsSent()
    if (mondayQuestionsSent === todayStr) {
      if (HOCKEY_KEYWORDS.some((kw) => text.includes(kw))) {
        await handleHockeyAnswer(rawText, kamoskaChannel)
        continue
      }
      if (WORKOUT_ANSWER_KEYWORDS.some((kw) => text.includes(kw))) {
        await handleWorkoutAnswer(rawText, kamoskaChannel)
        continue
      }
    }

    // Handle article brief reply
    if (isArticleBriefReply(text)) {
      await handleArticleBrief(msg.content, kamoskaChannel, settings.userName)
    }
  }
}

async function checkActivePomodoro(channelId: string, userName: string) {
  const pomodoro = await getPomodoro()
  if (!pomodoro) return

  const now = new Date()
  const startedAt = new Date(pomodoro.startedAt)
  const elapsedMin = (now.getTime() - startedAt.getTime()) / 60000

  if (pomodoro.phase === 'work' && elapsedMin >= 25) {
    await setPomodoro({ ...pomodoro, phase: 'break', startedAt: now.toISOString() })
    await sendDiscordMessage(
      `${MEDIA.pomodoroBreak} Cas! Spravila si 25 minut. 5 minutovy oddych zasluzenych 🌿\n\nNapisiste 'zacat' pre dalsi round.`,
      channelId
    )
  } else if (pomodoro.phase === 'break' && elapsedMin >= 5) {
    await setPomodoro(null)
    await sendDiscordMessage(
      `Oddych je za tebou! Pripravena na dalsi round? Napisiste 'zacat' 🎯`,
      channelId
    )
  }
}

async function handleHockeyAnswer(rawText: string, channelId: string) {
  // Try to extract opponent and date/time from the message
  const opponentMatch = rawText.match(/proti\s+([A-Za-zÀ-žŠšČčŽžÁáÉéÍíÓóÚúÄäÔô\s]+)/i)
  const timeMatch = rawText.match(/(\d{1,2}[:.]\d{2})|(\d{1,2}:\d{2})/)
  const dateMatch = rawText.match(/(\d{1,2}\.\s?\d{1,2}\.?(\s?\d{4})?)|dnes|zajtra|sobota|nedela|sobotu|nedelu/i)

  const opponent = opponentMatch ? opponentMatch[1].trim() : undefined
  const matchTime = timeMatch ? timeMatch[0] : undefined

  // Determine date
  let matchDate: string | undefined
  const now = new Date()
  if (dateMatch) {
    const dayText = dateMatch[0].toLowerCase()
    if (dayText === 'dnes') {
      matchDate = now.toISOString().slice(0, 10)
    } else if (dayText === 'zajtra') {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      matchDate = tomorrow.toISOString().slice(0, 10)
    }
    // For Slovak day names or numeric dates, store as-is for now
    else if (/\d{1,2}\.\s?\d{1,2}/.test(dayText)) {
      const parts = dayText.match(/(\d{1,2})\.\s?(\d{1,2})/)
      if (parts) {
        const year = now.getFullYear()
        const month = parts[2].padStart(2, '0')
        const day = parts[1].padStart(2, '0')
        matchDate = `${year}-${month}-${day}`
      }
    }
  }

  await saveHockeyPlan({
    hasMatch: true,
    opponent,
    matchDate,
    matchTime,
  })

  const confirmParts = ['Zapisala som! Zapas']
  if (opponent) confirmParts.push(`proti ${opponent}`)
  if (matchDate) confirmParts.push(`dna ${matchDate}`)
  if (matchTime) confirmParts.push(`o ${matchTime}`)
  confirmParts.push('🏑 Pripomeniem rano!')

  await sendDiscordMessage(confirmParts.join(' '), channelId)
}

async function handleWorkoutAnswer(rawText: string, channelId: string) {
  // Calculate current week's Monday
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  const weekStart = monday.toISOString().slice(0, 10)

  await saveWorkoutPlan({
    plan: rawText,
    weekStart,
  })

  await sendDiscordMessage(
    `Super! Plan na tento tydzen zapisany 💪 Budem ta drzat zodpovednou!`,
    channelId
  )
}

function isArticleBriefReply(text: string): boolean {
  // Heuristic: if the message is > 50 chars and mentions article/post related words
  const kw = ['téma', 'tема', 'článok', 'post', 'linkedin', 'myšlienky', 'napíš', 'priprав', 'hook', 'cta']
  return text.length > 50 && kw.some((k) => text.includes(k))
}

async function handleDateInput(text: string, taskId: string, channelId: string, userName: string) {
  const { getTaskSession, setTaskSession, getTasks } = await import('@/lib/kv')
  const { updateTask } = await import('@/lib/tasks')

  // Parse date from natural language
  const parseRes = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: `Dnes je ${new Date().toLocaleDateString('sk-SK')}. Extrahuj dátum z: "${text}". Vráť YYYY-MM-DD. Nič iné.`,
      },
    ],
  })
  const dateStr = parseRes.content[0].type === 'text' ? parseRes.content[0].text.trim() : ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    await updateTask(taskId, { deadline: dateStr })
    const friendly = new Date(dateStr).toLocaleDateString('sk-SK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    await sendDiscordMessage(`✅ Presunuté na **${friendly}**. Ideme ďalej!`, channelId)

    // Clear waitingForDate and advance session
    const session = await getTaskSession()
    if (session) {
      session.waitingForDate = undefined
      const tasks = await getTasks()
      const { TASK_BUTTONS } = await import('@/lib/discord-buttons')
      const { sendMessageWithButtons } = await import('@/lib/discord-buttons')

      session.currentIndex++
      if (session.currentIndex >= session.taskIds.length) {
        await setTaskSession(null)
        await sendDiscordMessage(`🌟 Všetky úlohy prejdené, ${userName}!`, channelId)
        return
      }
      await setTaskSession(session)

      const nextTask = tasks.find((t) => t.id === session.taskIds[session.currentIndex])
      if (nextTask) {
        const priorityEmoji = nextTask.priority === 'high' ? '🔴' : nextTask.priority === 'medium' ? '🟡' : '🔵'
        setTimeout(async () => {
          await sendMessageWithButtons(
            channelId,
            `📋 **Úloha ${session.currentIndex + 1}/${session.taskIds.length}**\n\n${priorityEmoji} **${nextTask.title}**\n\nČo s tým robíme?`,
            TASK_BUTTONS
          )
        }, 2000)
      }
    }
  } else {
    await sendDiscordMessage(`Nerozumela som dátumu. Skús napísať napr. "5. apríla" alebo "piatok".`, channelId)
  }
}

async function handleGeneralChat(userMessage: string, channelId: string, userName: string) {
  const { getConversations, addMessage } = await import('@/lib/kv')

  const history = await getConversations()

  const res = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    system: `Si SOVA – Sona, osobna AI asistentka pre ${userName}. Si priatelska, tepla, autenticka. Komunikujes VYHRADNE po slovensky BEZ diakritiky (bez hacikov a dlznovov) ale gramaticky spravna slovencina. Si ako najlepsia priatelka. Bud strucna, prirodzena, nikdy generická. Max 3-4 vety ak nie je potrebny dlhsi obsah.`,
    messages: [
      ...history.slice(-10).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ],
  })

  const reply = res.content[0].type === 'text' ? res.content[0].text : ''
  if (!reply) return

  await addMessage({ role: 'user', content: userMessage, timestamp: new Date().toISOString() })
  await addMessage({ role: 'assistant', content: reply, timestamp: new Date().toISOString() })

  await sendDiscordMessage(reply, channelId)
}

async function handleArticleBrief(brief: string, channelId: string, userName: string) {
  await sendDiscordMessage(`📝 Dostala som tvoj brief, ${userName}! Generujem článok – dostaneš ho ráno. 🦉`, channelId)

  // Generate article async
  const { saveContent } = await import('@/lib/kv')
  const res = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `Napíš kompletný LinkedIn článok (800-1200 slov) v slovenčine na základe briefu:
"${brief}"

Štruktúra:
# [Headline]
## Hook
[Telo so subnadpismi]
## Záver + CTA
---
## LinkedIn verzia (max 3000 znakov)`,
      },
    ],
  })

  const content = res.content[0].type === 'text' ? res.content[0].text : ''
  const [article, linkedinVersion] = content.split('---\n## LinkedIn verzia')

  await saveContent({
    id: `content_${Date.now()}`,
    type: 'article',
    title: brief.slice(0, 80),
    content: article?.trim() ?? content,
    linkedinVersion: linkedinVersion?.trim(),
    createdAt: new Date().toISOString(),
    brief,
  })

  await sendDiscordMessage(
    `✅ **Článok je pripravený, ${userName}!**\n\n${content.slice(0, 800)}...\n\n_Celý článok nájdeš v SOVA Content Studio_`,
    channelId
  )
}
