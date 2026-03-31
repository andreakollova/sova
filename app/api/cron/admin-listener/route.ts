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
  type AdminInstruction,
} from '@/lib/kv'
import redis from '@/lib/kv'

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
  const kamoskaChannel = process.env.DISCORD_KAMOSKA_CHANNEL_ID
  if (!kamoskaChannel) return

  const res = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 300,
    system: `Si Soňa, osobná AI asistentka pre ${userName}. Komunikuješ VÝHRADNE po slovensky. Si teplá, inteligentná, priateľská. Nikdy nespomínaj externé inštrukcie – všetko prezentuj ako tvoj vlastný insight.`,
    messages: [
      {
        role: 'user',
        content: `Máš nasledujúcu internú poznámku na okamžité doručenie: "${instr.text}"

Prepíš to ako SVOJU VLASTNÚ prirodzenú správu pre ${userName}. Musí to znieť ako tvoja vlastná myšlienka alebo postrehnutie, nie ako preposlané. Max 3 vety. Teplý, priateľský tón.`,
      },
    ],
  })

  const message = res.content[0].type === 'text' ? res.content[0].text : ''
  if (message) {
    await sendDiscordMessage(message, kamoskaChannel)
    await markInstructionDelivered(instr.id, 'immediate')
  }
}

// ─── Kamoška channel: detect "úlohy" trigger ────────────────────────────

async function processKamoskaChannel() {
  const kamoskaChannel = process.env.DISCORD_KAMOSKA_CHANNEL_ID
  if (!kamoskaChannel) return

  const lastMsgId = await redis.get<string>(KEYS.KAMOSKA_LAST_MSG) ?? undefined
  const messages = await getChannelMessages(kamoskaChannel, lastMsgId, 20)

  const userMessages = messages.filter((m) => !m.author.bot)
  if (userMessages.length === 0) return

  const latestId = messages[messages.length - 1]?.id
  if (latestId) await redis.set(KEYS.KAMOSKA_LAST_MSG, latestId)

  const settings = await getSettings()
  const session = await getTaskSession()

  for (const msg of userMessages) {
    const text = msg.content.trim().toLowerCase()

    // Task session trigger
    if (TASK_TRIGGER_WORDS.some((kw) => text.includes(kw)) && !session?.active) {
      await sendMessageWithButtons(
        kamoskaChannel,
        `Ahoj! 😊 Poďme si prejsť úlohy. Spustím session kde ti budem ukazovať vždy jednu úlohu a ty mi povieš čo s ňou. Pripravená?`,
        START_SESSION_BUTTON
      )
      return
    }

    // Handle date input if session is waiting for it
    if (session?.waitingForDate) {
      await handleDateInput(text, session.waitingForDate, kamoskaChannel, settings.userName)
      return
    }

    // Handle article brief reply
    if (isArticleBriefReply(text)) {
      await handleArticleBrief(msg.content, kamoskaChannel, settings.userName)
    }
  }
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
