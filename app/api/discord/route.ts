import { NextRequest, NextResponse } from 'next/server'
import { sendDiscordMessage } from '@/lib/discord'
import { getSettings } from '@/lib/kv'

export async function POST(req: NextRequest) {
  const { message, channelId } = await req.json()
  if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const settings = await getSettings()
  const ok = await sendDiscordMessage(message, channelId ?? settings.discordChannelId)
  return NextResponse.json({ success: ok })
}
