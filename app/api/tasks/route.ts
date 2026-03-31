import { NextRequest, NextResponse } from 'next/server'
import { getTasks } from '@/lib/kv'
import { createTask, updateTask, deleteTask } from '@/lib/tasks'
import { sendDiscordMessage } from '@/lib/discord'
import { getSettings } from '@/lib/kv'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const task = await createTask({
    title: data.title,
    category: data.category ?? 'work',
    priority: data.priority ?? 'medium',
    status: 'todo',
    deadline: data.deadline,
    notes: data.notes,
  })
  return NextResponse.json(task)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  const task = await updateTask(id, updates)

  // Celebrate task completion via Discord
  if (updates.status === 'done' && task) {
    const settings = await getSettings()
    try {
      const celebRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Napíš krátku (2-3 vety), OSOBNÚ a ÚPRIMNÚ gratuláciu pre Natku (Fondulu) v slovenčine, že splnila úlohu: "${task.title}". Buď konkrétna, teplá a autentická. Použij 1 emoji.`,
          },
        ],
      })
      const msg = celebRes.content[0].type === 'text' ? celebRes.content[0].text : ''
      if (msg && settings.discordChannelId) {
        await sendDiscordMessage(`✅ ${msg}`, settings.discordChannelId)
      }
    } catch (err) {
      console.error('Celebration error:', err)
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const ok = await deleteTask(id)
  return NextResponse.json({ success: ok })
}
