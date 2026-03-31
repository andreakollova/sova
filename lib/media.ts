export const MEDIA = {
  running: '🏃‍♀️',
  fitness: '💪',
  hockey: '🏒',
  celebration: '🎉',
  motivation: '🔥',
  goodnight: '🌙',
  lunch: '🍽️',
  focus: '⏱️',
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
