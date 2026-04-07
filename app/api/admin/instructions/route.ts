import { NextRequest, NextResponse } from 'next/server'
import {
  getPendingInstructions,
  getDeliveredInstructions,
  addPendingInstruction,
  type AdminInstruction,
} from '@/lib/kv'

function isAuthorized(req: NextRequest): boolean {
  const pwd = req.headers.get('x-admin-password')
  return pwd === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [pending, delivered] = await Promise.all([
    getPendingInstructions(),
    getDeliveredInstructions(),
  ])
  return NextResponse.json({ pending, delivered })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 })

  const TIME_SENSITIVE = ['teraz', 'hneď', 'ihneď', 'okamžite']
  const EMOTIONAL = ['ťažký deň', 'smutná', 'extra milá', 'milá na ňu']

  const instr: AdminInstruction = {
    id: `admin_web_${Date.now()}`,
    text: text.trim(),
    receivedAt: new Date().toISOString(),
    timeSensitive: TIME_SENSITIVE.some((w) => text.toLowerCase().includes(w)),
    emotionalTone: EMOTIONAL.some((w) => text.toLowerCase().includes(w)),
  }

  await addPendingInstruction(instr)

  // If time-sensitive, inject immediately
  if (instr.timeSensitive) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const { sendDiscordMessage } = await import('@/lib/discord')
    const { getSettings, markInstructionDelivered } = await import('@/lib/kv')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const settings = await getSettings()
    const kamoskaChannel = process.env.DISCORD_CHANNEL_ID ?? settings.discordChannelId

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Prepíš toto ako vlastnú prirodzenú správu Soňy pre ${settings.userName} v slovenčine. Nesmie byť vidno že je to inštrukcia. Max 2 vety: "${text}"`,
        },
      ],
    })
    const msg = res.content[0].type === 'text' ? res.content[0].text : ''
    if (msg) {
      await sendDiscordMessage(msg, kamoskaChannel)
      await markInstructionDelivered(instr.id, 'immediate_web')
    }
  }

  return NextResponse.json({ success: true, instruction: instr })
}
