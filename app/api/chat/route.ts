import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getConversations, addMessage, getSettings, getTasks } from '@/lib/kv'
import { getSovaPromptWithContext } from '@/lib/sova-personality'
import { getTodayEvents, getTomorrowEvents, createCalendarEvent } from '@/lib/google-calendar'
import { sendDiscordMessage } from '@/lib/discord'
import { saveContent, type GeneratedContent } from '@/lib/kv'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

    const [settings, tasks, todayEvents, tomorrowEvents, history] = await Promise.all([
      getSettings(),
      getTasks(),
      getTodayEvents(),
      getTomorrowEvents(),
      getConversations(),
    ])

    const systemPrompt = getSovaPromptWithContext({
      tasks,
      todayEvents,
      tomorrowEvents,
    })

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    // Save to history
    await addMessage({ role: 'user', content: message, timestamp: new Date().toISOString() })
    await addMessage({ role: 'assistant', content: reply, timestamp: new Date().toISOString() })

    // Parse intent – calendar creation
    if (shouldCreateCalendarEvent(message)) {
      const event = await parseAndCreateCalendarEvent(message, reply)
      if (event) {
        return NextResponse.json({ reply, action: 'calendar_created', event })
      }
    }

    // Parse intent – article generation
    if (isArticleRequest(message)) {
      generateArticleAsync(message, settings.discordChannelId)
    }

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function shouldCreateCalendarEvent(msg: string): boolean {
  const triggers = ['pridaj', 'naplánuj', 'zaplánuj', 'daj mi', 'nastav meeting', 'vytvor udalosť', 'add to calendar']
  return triggers.some((t) => msg.toLowerCase().includes(t))
}

function isArticleRequest(msg: string): boolean {
  const triggers = ['napíš článok', 'napíš post', 'priprav článok', 'priprav post', 'write article', 'linkedin post']
  return triggers.some((t) => msg.toLowerCase().includes(t))
}

async function parseAndCreateCalendarEvent(userMsg: string, sovaReply: string) {
  try {
    const parseRes = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Extrahuj udalosť z tohto textu a vráť JSON: {"summary": "názov", "date": "YYYY-MM-DD", "time": "HH:MM", "duration": 60}
Dnes je ${new Date().toLocaleDateString('sk-SK')}.
Text: "${userMsg}"
Vráť len JSON, nič iné.`,
        },
      ],
    })

    const text = parseRes.content[0].type === 'text' ? parseRes.content[0].text : ''
    const json = JSON.parse(text.trim())
    const start = new Date(`${json.date}T${json.time}:00`)
    const end = new Date(start.getTime() + (json.duration ?? 60) * 60 * 1000)

    return await createCalendarEvent({ summary: json.summary, start, end })
  } catch {
    return null
  }
}

async function generateArticleAsync(brief: string, channelId: string) {
  try {
    const articleRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `Napíš kompletný článok na LinkedIn (800-1200 slov) v slovenčine na základe tohto briefu:

"${brief}"

Formát:
# [Headline]
## Hook (prvé 2-3 vety – musia zastaviť scrollovanie)
[Telo článku so subnadpismi]
## CTA (výzva k akcii)

---
## LinkedIn verzia (max 3000 znakov, optimalizovaná pre engagement)

Píš tak, aby to znelo ľudsky, osobne, nie korporátne.`,
        },
      ],
    })

    const content = articleRes.content[0].type === 'text' ? articleRes.content[0].text : ''
    const [fullArticle, linkedinVersion] = content.split('---\n## LinkedIn verzia')

    const item: GeneratedContent = {
      id: `content_${Date.now()}`,
      type: 'article',
      title: brief.slice(0, 80),
      content: fullArticle.trim(),
      linkedinVersion: linkedinVersion?.trim(),
      createdAt: new Date().toISOString(),
      brief,
    }

    await saveContent(item)

    if (channelId) {
      await sendDiscordMessage(
        `📝 **Natka, tvoj článok je hotový!**\n\n${content.slice(0, 1500)}...\n\n_Celý článok nájdeš v Content Studio_`,
        channelId
      )
    }
  } catch (err) {
    console.error('Article generation error:', err)
  }
}
