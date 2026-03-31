import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getLinkedInResearch, saveLinkedInResearch, type GeneratedContent } from '@/lib/kv'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET() {
  const research = await getLinkedInResearch()
  return NextResponse.json(research)
}

export async function POST() {
  try {
    const res = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Si expert na LinkedIn obsah v oblasti marketingu, športového biznisu a podnikania.
Natka pracuje na firmách Sportqo a Drixton (marketing, fitness/šport) a chce pravidelne publikovať na LinkedIn.

Vygeneruj 5 aktuálnych, zaujímavých tém pre LinkedIn posty. Pre každú téme napíš:
1. Názov témy
2. Prečo je to teraz relevantné (2-3 vety)
3. Navrhovaný hook (prvá veta postu)

Formát každej témy:
---
TÉMA: [názov]
PREČO: [dôvod relevantnosti]
HOOK: [úvodná veta]
---

Témy musia byť v slovenčine ale môžu byť o globálnych trendoch.`,
        },
      ],
    })

    const content = res.content[0].type === 'text' ? res.content[0].text : ''

    const item: GeneratedContent = {
      id: `research_${Date.now()}`,
      type: 'research',
      title: `LinkedIn Research – ${new Date().toLocaleDateString('sk-SK')}`,
      content,
      createdAt: new Date().toISOString(),
    }

    await saveLinkedInResearch(item)
    return NextResponse.json(item)
  } catch (err) {
    console.error('LinkedIn research error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
