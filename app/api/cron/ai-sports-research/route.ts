import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSettings, saveAiSportsResearch, type AiSportsArticle } from '@/lib/kv'
import redis from '@/lib/kv'
import { sendDiscordMessage } from '@/lib/discord'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = new URL(req.url).searchParams.get('force') === '1'
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    .toISOString().slice(0, 10)
  const lastRun = await redis.get<string>('sova:cron:ai_sports:last')

  if (!force && lastRun === today) {
    return NextResponse.json({ skipped: true, reason: 'already ran today' })
  }
  await redis.set('sova:cron:ai_sports:last', today)

  try {
    // Fetch articles from NewsAPI
    const newsRes = await fetch(
      `https://newsapi.org/v2/everything?q=%22artificial+intelligence%22+%22sports%22&language=en&sortBy=publishedAt&pageSize=10`,
      { headers: { 'X-Api-Key': process.env.NEWS_API_KEY! } }
    )
    const newsData = await newsRes.json()

    if (newsData.status !== 'ok') {
      console.error('NewsAPI error:', newsData)
      return NextResponse.json({ skipped: true, reason: 'newsapi error', detail: newsData.message })
    }

    // Filter out articles with missing description or content
    const rawArticles = (newsData.articles ?? [])
      .filter((a: any) => a.description && a.description.length > 50 && a.url && !a.url.includes('[Removed]'))
      .slice(0, 3)

    if (rawArticles.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no usable articles' })
    }

    // Generate LinkedIn post for each article using GPT-4o
    const articles: AiSportsArticle[] = []
    for (const raw of rawArticles) {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 450,
        messages: [{
          role: 'user',
          content: `Si Andrea Kollová – aktívna športovkyňa a špecialistka na sports marketing. Napíš LinkedIn post v slovenčine o tomto článku.

Článok: "${raw.title}"
Popis: "${raw.description}"
Zdroj: ${raw.source?.name ?? 'neznámy'}

Požiadavky:
- Píš v prvej osobe, znie to ľudsky a osobne – nie korporátne
- Zahrň vlastný pohľad ako aktivna sportovkyna – čo ťa to naučilo, čo si z toho zobrala
- Presne 1-2 emoji prirodzene zakomponované v texte (nie na začiatku ani konci)
- Na samom konci pridaj: "Čítaj viac: ${raw.url}"
- BEZ hashtagov
- Súvislý text, 150-200 slov, nie bullet points`,
        }],
      })

      articles.push({
        title: raw.title,
        description: raw.description,
        url: raw.url,
        imageUrl: raw.urlToImage ?? null,
        source: raw.source?.name ?? 'Unknown',
        linkedinPost: res.choices[0].message.content ?? '',
      })
    }

    await saveAiSportsResearch({ date: today, fetchedAt: new Date().toISOString(), articles })

    // Send to Discord immediately
    const settings = await getSettings()
    const lines = articles.map((a, i) => `**${i + 1}. ${a.title}**\n${a.source} — <${a.url}>`).join('\n\n')
    await sendDiscordMessage(
      `🤖⚽ **AI v športe – dnešné čítanie:**\n\n${lines}\n\n_LinkedIn posty sú pripravené, pripomeniem ti ich o 15:00_ 📲`,
      settings.discordChannelId
    )

    return NextResponse.json({ success: true, articlesCount: articles.length })
  } catch (err) {
    console.error('AI sports research cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
