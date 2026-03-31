const DISCORD_API = 'https://discord.com/api/v10'

// ─── Send message with buttons ────────────────────────────────────────────

export interface ButtonDef {
  label: string
  customId: string
  style: 1 | 2 | 3 | 4  // Primary=1, Secondary=2, Success=3, Danger=4
  emoji?: string
}

export async function sendMessageWithButtons(
  channelId: string,
  content: string,
  buttons: ButtonDef[]
): Promise<string | null> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token || !channelId) return null

  const components = [
    {
      type: 1, // Action Row
      components: buttons.map((b) => ({
        type: 2, // Button
        style: b.style,
        label: b.label,
        custom_id: b.customId,
        emoji: b.emoji ? { name: b.emoji } : undefined,
      })),
    },
  ]

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, components }),
  })

  if (!res.ok) {
    console.error('Discord button message error:', await res.text())
    return null
  }
  const data = await res.json()
  return data.id ?? null
}

export async function updateMessage(
  channelId: string,
  messageId: string,
  content: string,
  removeButtons = true
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) return

  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      components: removeButtons ? [] : undefined,
    }),
  })
}

// ─── Read channel messages ─────────────────────────────────────────────────

export interface DiscordMessage {
  id: string
  content: string
  author: { id: string; username: string; bot?: boolean }
  timestamp: string
}

export async function getChannelMessages(
  channelId: string,
  afterMessageId?: string,
  limit = 10
): Promise<DiscordMessage[]> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token || !channelId) return []

  const url = new URL(`${DISCORD_API}/channels/${channelId}/messages`)
  url.searchParams.set('limit', String(limit))
  if (afterMessageId) url.searchParams.set('after', afterMessageId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bot ${token}` },
  })

  if (!res.ok) return []
  const msgs: DiscordMessage[] = await res.json()
  // Discord returns newest first when using 'after', reverse for chronological
  return msgs.reverse()
}

// ─── Ed25519 signature verification for Discord interactions ──────────────

export async function verifyDiscordSignature(
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) return false

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKey),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    )
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body)
    )
  } catch {
    return false
  }
}

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer as ArrayBuffer
}

// ─── Task session button definitions ──────────────────────────────────────

export const TASK_BUTTONS: ButtonDef[] = [
  { label: 'Hotovo!', customId: 'task_done', style: 3, emoji: '✅' },
  { label: 'Presuň na zajtra', customId: 'task_tomorrow', style: 2, emoji: '📅' },
  { label: 'Iný deň', customId: 'task_other_day', style: 2, emoji: '🗓️' },
  { label: 'Už nie je aktuálne', customId: 'task_archive', style: 4, emoji: '🚫' },
]

export const START_SESSION_BUTTON: ButtonDef[] = [
  { label: 'Áno, poďme na to!', customId: 'start_session', style: 1, emoji: '🚀' },
]
