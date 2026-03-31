const BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'

export const MEDIA = {
  running: `${BASE}/media/beh.mp4`,
  fitness: `${BASE}/media/fitness.mp4`,
  hockey: `${BASE}/media/hockey.png`,
  celebration: `${BASE}/media/celebration.mp4`,
  motivation: `${BASE}/media/motivation.png`,
  goodnight: `${BASE}/media/laska.mp4`,
  lunch: `${BASE}/media/jedlo.mp4`,
  focus: `${BASE}/media/focus.png`,
  happy: `${BASE}/media/happy.mp4`,
  pomodoroBreak: '🌿',
  pomodoroStart: '🎯',
}

export function getWorkoutEmoji(events: Array<{ summary: string }>): string | null {
  const runningKeywords = ['beh', 'run', 'running', 'bezat', 'behat']
  const fitnessKeywords = ['fitness', 'gym', 'silovy', 'silove', 'fit', 'workout']
  const hockeyKeywords = ['hokej', 'zapas', 'hockey', 'zápas']

  for (const event of events) {
    const summary = event.summary.toLowerCase()
    if (runningKeywords.some((kw) => summary.includes(kw))) return MEDIA.running
    if (fitnessKeywords.some((kw) => summary.includes(kw))) return MEDIA.fitness
    if (hockeyKeywords.some((kw) => summary.includes(kw))) return MEDIA.hockey
  }

  return null
}
