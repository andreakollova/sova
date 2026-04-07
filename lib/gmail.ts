import { google } from 'googleapis'
import redis, { KEYS, getSettings } from './kv'

function getOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

export interface EmailMessage {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
  body?: string
}

export async function getNewEmailsFromWatchedAddresses(): Promise<EmailMessage[]> {
  try {
    const auth = getOAuthClient()
    const gmail = google.gmail({ version: 'v1', auth })
    const settings = await getSettings()

    const lastCheck = (await redis.get<string>(KEYS.GMAIL_LAST_CHECK)) ?? new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const lastCheckDate = new Date(lastCheck)
    const afterTimestamp = Math.floor(lastCheckDate.getTime() / 1000)

    await redis.set(KEYS.GMAIL_LAST_CHECK, new Date().toISOString())

    const emails: EmailMessage[] = []

    for (const address of settings.watchedEmails) {
      const query = `from:${address} after:${afterTimestamp}`
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 5,
      })

      const messages = listRes.data.messages ?? []
      for (const msg of messages) {
        if (!msg.id) continue
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })

        const headers = detail.data.payload?.headers ?? []
        const get = (name: string) => headers.find((h) => h.name === name)?.value ?? ''

        emails.push({
          id: msg.id,
          from: get('From'),
          subject: get('Subject'),
          snippet: detail.data.snippet ?? '',
          date: get('Date'),
        })
      }
    }

    return emails
  } catch (err) {
    console.error('Gmail error:', err)
    return []
  }
}

export async function getDraftReply(email: EmailMessage, context: string = ''): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Napíš krátky draft odpovede na tento email v slovenčine. Buď profesionálna a priateľská.

Od: ${email.from}
Predmet: ${email.subject}
Obsah: ${email.snippet}

${context ? `Kontext: ${context}` : ''}

Napíš len samotný text odpovede, bez hlavičky.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
