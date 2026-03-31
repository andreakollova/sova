const DISCORD_API = 'https://discord.com/api/v10'

export async function sendDiscordMessage(
  content: string,
  channelId?: string
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN
  const channel = channelId ?? process.env.DISCORD_CHANNEL_ID

  if (!token || !channel) {
    console.error('Discord bot token or channel ID missing')
    return false
  }

  // Discord has a 2000 char limit per message – split if needed
  const chunks = splitMessage(content, 1900)

  for (const chunk of chunks) {
    const res = await fetch(`${DISCORD_API}/channels/${channel}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: chunk }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Discord send error:', err)
      return false
    }
  }

  return true
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]
  const chunks: string[] = []
  let current = ''
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLength) {
      chunks.push(current.trim())
      current = line
    } else {
      current += (current ? '\n' : '') + line
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

export function formatMorningBriefing(params: {
  userName: string
  dayString: string
  todayEvents: Array<{ summary: string; start: string }>
  topTasks: Array<{ title: string }>
  urgentEmails: Array<{ from: string; subject: string; snippet: string }>
  personalNote: string
  tomorrowPreview: Array<{ summary: string; start: string }>
  hasWorkout: boolean
  workoutEvent?: string
}): string {
  const name = Math.random() > 0.5 ? params.userName : 'Fondula'

  let msg = `🌅 **Dobré ráno, ${name}!** Je ${params.dayString}\n\n`

  if (params.todayEvents.length > 0) {
    msg += `📅 **DNES ŤA ČAKÁ:**\n`
    for (const ev of params.todayEvents) {
      const isWorkout = hasWorkoutKeyword(ev.summary)
      msg += `> ${ev.start} – ${ev.summary}${isWorkout ? ' 💪' : ''}\n`
    }
    msg += '\n'
  }

  if (params.hasWorkout && params.workoutEvent) {
    msg += `💪 **Dnes máš tréning – ${params.workoutEvent}! Ideš za svojimi snami, ${name}. Nič ťa nezastaví.**\n\n`
  }

  if (params.urgentEmails.length > 0) {
    msg += `✉️ **DÔLEŽITÉ SPRÁVY:**\n`
    for (const em of params.urgentEmails) {
      msg += `> **${em.from}** – ${em.subject}\n> _${em.snippet}_\n`
    }
    msg += '\n'
  }

  if (params.topTasks.length > 0) {
    msg += `🎯 **TVOJE TOP 3 NA DNES:**\n`
    params.topTasks.slice(0, 3).forEach((t, i) => {
      msg += `> ${i + 1}. ${t.title}\n`
    })
    msg += '\n'
  }

  if (params.tomorrowPreview.length > 0) {
    msg += `👀 **ZAJTRA ŤA ČAKÁ:**\n`
    params.tomorrowPreview.slice(0, 3).forEach((e) => {
      msg += `> ${e.start} – ${e.summary}\n`
    })
    msg += '\n'
  }

  msg += `💭 ${params.personalNote}`

  return msg
}

export function formatEveningWrapup(params: {
  userName: string
  completedTasks: Array<{ title: string }>
  openTasks: Array<{ title: string }>
  tomorrowEvents: Array<{ summary: string; start: string }>
  closingNote: string
}): string {
  const name = Math.random() > 0.6 ? 'Fondula' : params.userName

  let msg = `🌙 **Dobrý večer, ${name}!** Poďme uzavrieť deň.\n\n`

  if (params.completedTasks.length > 0) {
    msg += `✅ **SPLNENÉ DNES:**\n`
    params.completedTasks.forEach((t) => {
      msg += `> ✓ ${t.title}\n`
    })
    msg += '\n'
  } else {
    msg += `📋 Dnes si to zvládla inak – zajtrajšok je nový štart.\n\n`
  }

  if (params.openTasks.length > 0) {
    msg += `📋 **OSTALO OTVORENÉ:**\n`
    params.openTasks.slice(0, 5).forEach((t) => {
      msg += `> · ${t.title}\n`
    })
    msg += '\n'
  }

  if (params.tomorrowEvents.length > 0) {
    msg += `📅 **ZAJTRA ŤA ČAKÁ:**\n`
    params.tomorrowEvents.slice(0, 4).forEach((e) => {
      msg += `> ${e.start} – ${e.summary}\n`
    })
    msg += '\n'
  }

  msg += `🦉 Pracujem pre teba ďalej – ráno budeš mať všetko pripravené.\n\n`
  msg += `💜 ${params.closingNote}`

  return msg
}

export function formatWeeklyMeeting(params: {
  userName: string
  weekEvents: Array<{ day: string; events: Array<{ summary: string; start: string }> }>
  weeklyNote: string
  linkedinIdeas: string[]
}): string {
  const name = params.userName

  let msg = `☀️ **Pondelok – Týždenný prehľad, ${name}!**\n\n`
  msg += `📆 **TENTO TÝŽDEŇ ŤA ČAKÁ:**\n`

  for (const day of params.weekEvents) {
    if (day.events.length > 0) {
      msg += `\n**${day.day}**\n`
      day.events.forEach((e) => {
        msg += `> ${e.start} – ${e.summary}\n`
      })
    }
  }

  if (params.linkedinIdeas.length > 0) {
    msg += `\n💡 **LINKEDIN NÁPADY NA TENTO TÝŽDEŇ:**\n`
    params.linkedinIdeas.forEach((idea, i) => {
      msg += `> ${i + 1}. ${idea}\n`
    })
  }

  msg += `\n🎯 ${params.weeklyNote}`

  return msg
}

function hasWorkoutKeyword(text: string): boolean {
  const kw = ['tréning', 'trening', 'workout', 'gym', 'beh', 'plávanie', 'jóga', 'yoga', 'šport', 'fit']
  return kw.some((k) => text.toLowerCase().includes(k))
}
