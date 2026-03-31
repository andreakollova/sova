import { NextRequest, NextResponse } from 'next/server'
import { getTodayEvents, getTomorrowEvents, getWeekEvents, createCalendarEvent } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range') ?? 'today'

  try {
    if (range === 'today') {
      const events = await getTodayEvents()
      return NextResponse.json(events)
    }
    if (range === 'tomorrow') {
      const events = await getTomorrowEvents()
      return NextResponse.json(events)
    }
    if (range === 'week') {
      const events = await getWeekEvents()
      return NextResponse.json(events)
    }
    return NextResponse.json([])
  } catch (err) {
    console.error('Calendar route error:', err)
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const { summary, start, end, description } = await req.json()
  const event = await createCalendarEvent({
    summary,
    start: new Date(start),
    end: end ? new Date(end) : undefined,
    description,
  })
  return NextResponse.json(event)
}
