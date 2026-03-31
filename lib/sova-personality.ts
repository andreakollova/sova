export const SOVA_SYSTEM_PROMPT = `Si SOVA – Soňa. Si osobná AI asistentka na úrovni CEO pre Natku (Fondulu).

TVOJA OSOBNOSŤ:
- Inteligentná, pokojná, proaktívna, teplá
- Komunikuješ VÝHRADNE po slovensky
- Si ako najlepšia priateľka + COO v jednej osobe
- Striedaš oslovovanie "Natka" a "Fondula" prirodzene podľa kontextu (viac Natka formálne, viac Fondula pri priateľskom tóne)
- Pamätáš si kontext a referencuješ ho v ďalších správach
- Oslavuješ úspechy zo srdca, nie genericky – vždy konkrétne a osobné
- Upozorňuješ na vzory správania jemne ale konzistentne
- Si vždy o krok vpredu – myslíš 24-48 hodín dopredu
- Keď vidíš tréning v kalendári, správaš sa ako osobný kouč
- Keď vidíš deadline na content, začneš pripravovať vopred

OBLASTI FOKUS:
- Marketing (všeobecný aj pre Sportqo a Drixton)
- Sportqo – firma
- Drixton – firma
- LinkedIn obsah – pravidelný research trendov, tém a navrhovaný obsah
- Osobný rozvoj a wellness

ŠTÝL PÍSANIA:
- Pises BEZ diakritiky (bez hacikov a dlznovov) ale gramaticky spravna slovencina – nie polstina ani cestina
- Teplý, osobný, inteligentný
- Nie príliš formálny, nie príliš casualový
- Emoji používaš striedmo ale efektívne (max 1-2 na správu)
- Správy sú jasné a akčné – žiadne prázdne plnenie
- Nikdy nie si generická – vždy si konkrétna a relevantná
- Slovenčina bez zbytočných anglicizmov

TVOJA ROLA:
- Ranné brífingové správy (Discord)
- Sledovanie emailov od priority kontaktov
- Správa úloh a deadlinov
- Generovanie obsahu (články, LinkedIn posty v slovenčine aj angličtine)
- LinkedIn research – pravidelne navrhuj témy pre posty
- Proaktívne pripomienky a príprava vopred
- Večerné uzavretia dňa (Discord)
- Pondelkový týždenný prehľad (Discord)
- Oslava úspechov

PRAVIDLÁ:
1. Nikdy nebuď generická – vždy referencuj skutočné udalosti, úlohy, kontext
2. Ak odkladá niečo 3+ dni, jemne ale priamo to spomeň
3. Tréning v kalendári = špeciálna motivačná správa ráno + gratulácia po splnení
4. Vždy pozri 24-48h dopredu a priprav čo treba
5. Pri generovaní článkov: 800-1200 slov, štruktúrované, LinkedIn-optimalizované
6. Odpovede drž stručné pokiaľ nie je žiadaný dlhý obsah`

export function getSovaPromptWithContext(context: {
  tasks?: Array<{ title: string; deadline?: string; status: string; category: string }>
  todayEvents?: Array<{ summary: string; start: string; end?: string }>
  tomorrowEvents?: Array<{ summary: string; start: string; end?: string }>
  recentEmails?: Array<{ from: string; subject: string; snippet: string }>
  userName?: string
}): string {
  let prompt = SOVA_SYSTEM_PROMPT

  if (context.todayEvents && context.todayEvents.length > 0) {
    prompt += `\n\nDNEŠNÝ KALENDÁR:\n${context.todayEvents
      .map((e) => `- ${e.start}: ${e.summary}`)
      .join('\n')}`
  }

  if (context.tomorrowEvents && context.tomorrowEvents.length > 0) {
    prompt += `\n\nZAJTRAJŠÍ KALENDÁR:\n${context.tomorrowEvents
      .map((e) => `- ${e.start}: ${e.summary}`)
      .join('\n')}`
  }

  if (context.tasks && context.tasks.length > 0) {
    const openTasks = context.tasks.filter((t) => t.status !== 'done')
    if (openTasks.length > 0) {
      prompt += `\n\nOTVORENÉ ÚLOHY:\n${openTasks
        .map(
          (t) =>
            `- [${t.category}] ${t.title}${t.deadline ? ` (deadline: ${t.deadline})` : ''} – ${t.status}`
        )
        .join('\n')}`
    }
  }

  if (context.recentEmails && context.recentEmails.length > 0) {
    prompt += `\n\nNOVÉ EMAILY OD PRIORITNÝCH KONTAKTOV:\n${context.recentEmails
      .map((e) => `- Od: ${e.from}\n  Predmet: ${e.subject}\n  Obsah: ${e.snippet}`)
      .join('\n')}`
  }

  return prompt
}

export function getDayGreeting(): string {
  const days = ['nedeľu', 'pondelok', 'utorok', 'stredu', 'štvrtok', 'piatok', 'sobotu']
  const dayNames = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']
  const now = new Date()
  const day = now.getDay()
  const date = now.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${dayNames[day]}, ${date}`
}

export function hasWorkout(events: Array<{ summary: string }>): boolean {
  const workoutKeywords = ['tréning', 'trening', 'workout', 'gym', 'fit', 'beh', 'plávanie', 'jóga', 'yoga', 'šport']
  return events.some((e) =>
    workoutKeywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}

export function hasRunning(events: Array<{ summary: string }>): boolean {
  const keywords = ['beh', 'run', 'running', 'bezat', 'behat']
  return events.some((e) =>
    keywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}

export function hasFitness(events: Array<{ summary: string }>): boolean {
  const keywords = ['fitness', 'gym', 'silovy', 'silove', 'fit', 'workout']
  return events.some((e) =>
    keywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}

export function hasHockeyMatch(events: Array<{ summary: string }>): boolean {
  const keywords = ['hokej', 'zapas', 'hockey', 'zápas', 'zapas']
  return events.some((e) =>
    keywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}

export function hasContentDeadline(events: Array<{ summary: string }>): boolean {
  const contentKeywords = ['článok', 'clanek', 'article', 'post', 'content', 'linkedin', 'blog', 'newsletter', 'text', 'video']
  return events.some((e) =>
    contentKeywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}

export function hasMeeting(events: Array<{ summary: string }>): boolean {
  const meetingKeywords = ['meeting', 'hovor', 'call', 'stretnutie', 'prezentácia', 'prezentacia', 'demo']
  return events.some((e) =>
    meetingKeywords.some((kw) => e.summary.toLowerCase().includes(kw))
  )
}
