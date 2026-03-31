import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSettings } from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'
import { getNewEmailsFromWatchedAddresses } from '@/lib/gmail'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [settings, emails] = await Promise.all([getSettings(), getNewEmailsFromWatchedAddresses()])

    if (emails.length === 0) return NextResponse.json({ skipped: true, reason: 'no_new_emails' })

    for (const email of emails.slice(0, 5)) {
      const analysisRes = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Analyzuj email a vráť JSON: {"urgency": "low|medium|high", "summary": "krátke zhrnutie v slovenčine", "action": "odporúčaná akcia"}
Od: ${email.from}
Predmet: ${email.subject}
Obsah: ${email.snippet}`,
          },
        ],
      })

      const analysisText = analysisRes.content[0].type === 'text' ? analysisRes.content[0].text : '{}'
      let analysis = { urgency: 'low', summary: email.snippet, action: 'Prečítaj si' }
      try {
        analysis = JSON.parse(analysisText)
      } catch {}

      if (analysis.urgency === 'high' || analysis.urgency === 'medium') {
        const urgencyEmoji = analysis.urgency === 'high' ? '🔴' : '🟡'
        const name = settings.userName
        await sendDiscordMessage(
          `${urgencyEmoji} **Nový email, ${name}!**\n> **Od:** ${email.from}\n> **Predmet:** ${email.subject}\n\n📋 ${analysis.summary}\n\n💡 _${analysis.action}_`,
          settings.discordChannelId
        )
      }
    }

    return NextResponse.json({ success: true, processed: emails.length })
  } catch (err) {
    console.error('Gmail check cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
