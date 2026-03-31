import { google } from 'googleapis'

function getOAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

export interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  description?: string
  location?: string
}

export async function getTodayEvents(): Promise<CalendarEvent[]> {
  return getEventsForDay(new Date())
}

export async function getTomorrowEvents(): Promise<CalendarEvent[]> {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return getEventsForDay(tomorrow)
}

export async function getWeekEvents(): Promise<{ day: string; events: CalendarEvent[] }[]> {
  const auth = getOAuthClient()
  const calendar = google.calendar({ version: 'v3', auth })
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  })

  const events = (res.data.items ?? []).map(mapEvent).filter(Boolean) as CalendarEvent[]

  const days: { day: string; events: CalendarEvent[] }[] = []
  const dayNames = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    const dayEvents = events.filter((e) => {
      const evDate = new Date(e.start)
      return evDate.toDateString() === d.toDateString()
    })
    if (dayEvents.length > 0) {
      days.push({
        day: `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`,
        events: dayEvents,
      })
    }
  }

  return days
}

export async function getEventsForDay(date: Date): Promise<CalendarEvent[]> {
  try {
    const auth = getOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    })

    return (res.data.items ?? []).map(mapEvent).filter(Boolean) as CalendarEvent[]
  } catch (err) {
    console.error('Calendar error:', err)
    return []
  }
}

export async function createCalendarEvent(params: {
  summary: string
  start: Date
  end?: Date
  description?: string
}): Promise<CalendarEvent | null> {
  try {
    const auth = getOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    const endDate = params.end ?? new Date(params.start.getTime() + 60 * 60 * 1000)

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.start.toISOString(), timeZone: 'Europe/Bratislava' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Europe/Bratislava' },
      },
    })

    return mapEvent(res.data)
  } catch (err) {
    console.error('Create event error:', err)
    return null
  }
}

function mapEvent(item: any): CalendarEvent | null {
  if (!item?.summary) return null
  const start = item.start?.dateTime ?? item.start?.date ?? ''
  const end = item.end?.dateTime ?? item.end?.date ?? ''
  return {
    id: item.id ?? '',
    summary: item.summary,
    start: formatEventTime(start),
    end: formatEventTime(end),
    description: item.description,
    location: item.location,
  }
}

function formatEventTime(isoString: string): string {
  if (!isoString) return ''
  if (isoString.length === 10) return isoString // date only
  const d = new Date(isoString)
  return d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}
