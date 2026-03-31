import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  verifyDiscordSignature,
  sendMessageWithButtons,
  TASK_BUTTONS,
} from '@/lib/discord-buttons'
import { sendDiscordMessage } from '@/lib/discord'
import {
  getTaskSession,
  setTaskSession,
  getTasks,
  type TaskSession,
} from '@/lib/kv'
import { updateTask } from '@/lib/tasks'
import { getSettings } from '@/lib/kv'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''

  const valid = await verifyDiscordSignature(signature, timestamp, body)
  if (!valid) return new NextResponse('Invalid signature', { status: 401 })

  const interaction = JSON.parse(body)

  // Discord PING verification
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  // Button click (MESSAGE_COMPONENT = type 3)
  if (interaction.type === 3) {
    const customId: string = interaction.data?.custom_id ?? ''
    const channelId: string = interaction.channel_id ?? ''

    // Defer the response immediately (3s limit)
    // We'll follow up via webhook
    const deferredResponse = { type: 6 } // DEFERRED_UPDATE_MESSAGE

    handleButtonClick(customId, channelId, interaction).catch(console.error)

    return NextResponse.json(deferredResponse)
  }

  return NextResponse.json({ type: 1 })
}

async function handleButtonClick(
  customId: string,
  channelId: string,
  interaction: any
) {
  const settings = await getSettings()
  const kamoskaChannel = process.env.DISCORD_KAMOSKA_CHANNEL_ID ?? channelId
  const userName = settings.userName

  if (customId === 'start_session') {
    await startTaskSession(kamoskaChannel, userName)
    return
  }

  const session = await getTaskSession()
  if (!session || !session.active) {
    await sendDiscordMessage(
      `_Žiadna aktívna session. Napíš "úlohy" pre spustenie._`,
      kamoskaChannel
    )
    return
  }

  const tasks = await getTasks()
  const currentTaskId = session.taskIds[session.currentIndex]
  const currentTask = tasks.find((t) => t.id === currentTaskId)
  if (!currentTask) {
    await finishSession(session, kamoskaChannel, userName)
    return
  }

  if (customId === 'task_done') {
    // Generate celebration
    const celebRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Napíš KONKRÉTNU, OSOBNÚ gratuláciu (2-3 vety) pre ${userName} v slovenčine za splnenie úlohy: "${currentTask.title}". Buď teplá, autentická, nič generické. 1 emoji max.`,
        },
      ],
    })
    const celebration = celebRes.content[0].type === 'text' ? celebRes.content[0].text : '🎉 Skvelá práca!'

    await updateTask(currentTask.id, { status: 'done' })
    await sendDiscordMessage(`✅ **Hotovo!**\n\n${celebration}`, kamoskaChannel)

  } else if (customId === 'task_tomorrow') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    await updateTask(currentTask.id, { deadline: tomorrowStr, status: 'todo' })
    await sendDiscordMessage(
      `📅 Presunula som to na zajtra. Budeš na to pripravená! 💪`,
      kamoskaChannel
    )

  } else if (customId === 'task_other_day') {
    // Mark session as waiting for date input
    session.waitingForDate = currentTask.id
    await setTaskSession(session)
    await sendDiscordMessage(
      `📅 Na kedy chceš presunúť "_${currentTask.title}_"? (napr. "5. apríla" alebo "piatok")`,
      kamoskaChannel
    )
    return // Don't advance to next task yet

  } else if (customId === 'task_archive') {
    await updateTask(currentTask.id, { status: 'done', notes: '[archivované – nie je aktuálne]' })
    await sendDiscordMessage(`Okay, ideme ďalej! 👍`, kamoskaChannel)
  }

  // Advance to next task
  await advanceSession(session, tasks, kamoskaChannel, userName)
}

async function startTaskSession(channelId: string, userName: string) {
  const tasks = await getTasks()
  const openTasks = tasks.filter((t) => t.status !== 'done').slice(0, 10)

  if (openTasks.length === 0) {
    await sendDiscordMessage(
      `🎉 ${userName}, nemáš žiadne otvorené úlohy! Úžasné. Daj si zaslúžený oddych.`,
      channelId
    )
    return
  }

  const session: TaskSession = {
    active: true,
    taskIds: openTasks.map((t) => t.id),
    currentIndex: 0,
    dateKey: new Date().toISOString().split('T')[0],
    startedAt: new Date().toISOString(),
  }
  await setTaskSession(session)

  // Send first task
  const first = openTasks[0]
  const priorityEmoji = first.priority === 'high' ? '🔴' : first.priority === 'medium' ? '🟡' : '🔵'

  await sendMessageWithButtons(
    channelId,
    `📋 **Úloha ${1}/${openTasks.length}**\n\n${priorityEmoji} **${first.title}**${first.deadline ? `\n📅 Deadline: ${new Date(first.deadline).toLocaleDateString('sk-SK')}` : ''}\n\nČo s tým robíme?`,
    TASK_BUTTONS
  )
}

async function advanceSession(
  session: TaskSession,
  tasks: any[],
  channelId: string,
  userName: string
) {
  session.currentIndex++

  if (session.currentIndex >= session.taskIds.length) {
    await finishSession(session, channelId, userName)
    return
  }

  await setTaskSession(session)

  const nextTaskId = session.taskIds[session.currentIndex]
  const nextTask = tasks.find((t) => t.id === nextTaskId)
  if (!nextTask) {
    await finishSession(session, channelId, userName)
    return
  }

  // Small delay for natural feel
  await new Promise((r) => setTimeout(r, 2000))

  const priorityEmoji = nextTask.priority === 'high' ? '🔴' : nextTask.priority === 'medium' ? '🟡' : '🔵'
  await sendMessageWithButtons(
    channelId,
    `📋 **Úloha ${session.currentIndex + 1}/${session.taskIds.length}**\n\n${priorityEmoji} **${nextTask.title}**${nextTask.deadline ? `\n📅 Deadline: ${new Date(nextTask.deadline).toLocaleDateString('sk-SK')}` : ''}\n\nČo s tým robíme?`,
    TASK_BUTTONS
  )
}

async function finishSession(session: TaskSession, channelId: string, userName: string) {
  await setTaskSession(null)

  const tasks = await getTasks()
  const today = new Date().toDateString()
  const completed = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today
  )
  const moved = tasks.filter(
    (t) => t.status === 'todo' && t.deadline && t.deadline > new Date().toISOString().split('T')[0]
  )

  const closeRes = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Napíš záverečnú správu session úloh pre ${userName} v slovenčine. Splnené: ${completed.map((t) => t.title).join(', ') || 'žiadne'}. Buď teplá, konkrétna, povzbudzujúca. Max 3 vety.`,
      },
    ],
  })
  const closing = closeRes.content[0].type === 'text' ? closeRes.content[0].text : ''

  const summary = completed.length > 0
    ? `\n\n✅ Dnes si splnila: ${completed.map((t) => `_${t.title}_`).join(', ')}`
    : ''

  await sendDiscordMessage(
    `🌟 **To bolo všetko na dnes!**${summary}\n\n${closing}`,
    channelId
  )
}
