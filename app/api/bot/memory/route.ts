import { NextRequest, NextResponse } from 'next/server'
import redis from '@/lib/kv'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  const value = await redis.get(key)
  return NextResponse.json({ value })
}

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { key, value } = await req.json()
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  await redis.set(key, value)
  return NextResponse.json({ ok: true })
}
