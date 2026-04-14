import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getLinkedInResearch, saveLinkedInResearch, type GeneratedContent } from '@/lib/kv'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function GET() {
  const research = await getLinkedInResearch()
  return NextResponse.json(research)
}

export async function POST() {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
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

    const content = res.choices[0].message.content ?? ''

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
