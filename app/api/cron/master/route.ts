import { NextRequest, NextResponse } from 'next/server'

const CRON_ENDPOINTS = [
  '/api/cron/morning',
  '/api/cron/midday',
  '/api/cron/evening',
  '/api/cron/gmail-check',
  '/api/cron/pre-task-reminder',
  '/api/cron/weekly-meeting',
  '/api/cron/admin-listener',
  '/api/cron/hourly',
]

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reqUrl = new URL(req.url)
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`
  const secret = process.env.CRON_SECRET

  const results = await Promise.allSettled(
    CRON_ENDPOINTS.map((path) =>
      fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${secret}` },
      }).then((r) => r.json())
    )
  )

  const summary = Object.fromEntries(
    CRON_ENDPOINTS.map((path, i) => [
      path,
      results[i].status === 'fulfilled' ? results[i].value : { error: String((results[i] as PromiseRejectedResult).reason) },
    ])
  )

  return NextResponse.json({ success: true, summary })
}
