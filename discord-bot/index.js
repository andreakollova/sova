const { Client, GatewayIntentBits } = require('discord.js')
const Anthropic = require('@anthropic-ai/sdk')
const OpenAI = require('openai').default

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const SOVA_URL = process.env.SOVA_URL ?? 'https://sova-phi.vercel.app'

const MEDIA = {
  motivation: `${SOVA_URL}/media/motivation.png`,
  celebration: `${SOVA_URL}/media/celebration.mp4`,
  laska: `${SOVA_URL}/media/laska.mp4`,
  happy: `${SOVA_URL}/media/happy.mp4`,
  running: `${SOVA_URL}/media/beh.mp4`,
  fitness: `${SOVA_URL}/media/fitness.mp4`,
  hockey: `${SOVA_URL}/media/hockey.png`,
  lunch: `${SOVA_URL}/media/jedlo.mp4`,
  focus: `${SOVA_URL}/media/focus.png`,
}

function detectMedia(text) {
  const t = text.toLowerCase()
  if (/motivaci|motivuj|motivaciu|motivacia|povzbuď|povzbudenie/.test(t)) return MEDIA.motivation
  if (/oslav|slav(im|me|me)|gratuluj|yay|hurra|podarilo|splnila|vyhral/.test(t)) return MEDIA.celebration
  if (/lask[au]|objat|milujem|chcem lasku|chcem objatie/.test(t)) return MEDIA.laska
  if (/stastn[aá]|som stast|cítim sa dobre|super nalada|dobrá nalada/.test(t)) return MEDIA.happy
  if (/hokej|zapas|zápas|idem na hokej|hram hokej/.test(t)) return MEDIA.hockey
  if (/idem beh|idem behať|idem bezat|idem na beh|idem bezat|dnes behám|dnes bezim/.test(t)) return MEDIA.running
  if (/idem na fitko|idem do fitka|idem cvicit|idem na trening|idem na tréning|fitness|silovy trening/.test(t)) return MEDIA.fitness
  return null
}
const CRON_SECRET = process.env.CRON_SECRET
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID
const USER_NAME = process.env.USER_NAME ?? 'Natka'

async function kvGet(key) {
  try {
    const res = await fetch(`${SOVA_URL}/api/bot/memory?key=${encodeURIComponent(key)}`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    })
    const data = await res.json()
    return data.value
  } catch { return null }
}

async function kvSet(key, value) {
  try {
    await fetch(`${SOVA_URL}/api/bot/memory`, {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}`, 'content-type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  } catch (e) { console.error('kvSet error:', e) }
}

// Active reminders: key = normalized description, value = { timeoutId, time, channelId }
const activeReminders = new Map()

const REMINDERS_KEY = 'sova:reminders:timed'

async function getTimedReminders() {
  return (await kvGet(REMINDERS_KEY)) ?? []
}

async function addTimedReminder(reminder) {
  const reminders = await getTimedReminders()
  reminders.push(reminder)
  await kvSet(REMINDERS_KEY, reminders)
}

async function deleteTimedReminder(id) {
  const reminders = await getTimedReminders()
  await kvSet(REMINDERS_KEY, reminders.filter(r => r.id !== id))
}

async function fireReminder(reminder) {
  try {
    const channel = await client.channels.fetch(reminder.channelId)
    if (channel) await channel.send(`⏰ Pripomienka: **${reminder.eventDescription}** o ${reminder.reminderTime}!`)
  } catch (e) {
    console.error('fireReminder error:', e)
  }
  await deleteTimedReminder(reminder.id)
}

async function scheduleTimedReminder(reminder) {
  const delayMs = new Date(reminder.notifyAt).getTime() - Date.now()
  if (delayMs <= 0) {
    await fireReminder(reminder)
    return
  }
  setTimeout(() => fireReminder(reminder), delayMs)
  console.log(`Reminder scheduled: "${reminder.eventDescription}" in ${Math.round(delayMs / 60000)} min`)
}

async function loadAndRescheduleReminders() {
  const reminders = await getTimedReminders()
  const now = Date.now()
  const fresh = reminders.filter(r => new Date(r.notifyAt).getTime() > now - 60000)
  if (fresh.length !== reminders.length) await kvSet(REMINDERS_KEY, fresh)
  for (const r of fresh) await scheduleTimedReminder(r)
  if (fresh.length > 0) console.log(`Rescheduled ${fresh.length} reminder(s) after restart`)
}

// Pomodoro state
let pomodoroTimeout = null
let pomodoroRound = 0

async function startPomodoro(channel, minutes = 25) {
  if (pomodoroTimeout) {
    clearTimeout(pomodoroTimeout)
  }
  pomodoroRound++
  const round = pomodoroRound
  await channel.send(`🎯 Pomodoro spustený! Máš ${minutes} minút sústredenia. Daj do toho všetko, Fondula! 💪`)
  pomodoroTimeout = setTimeout(async () => {
    try {
      // Increment daily counter in KV
      const today = new Date().toISOString().slice(0, 10)
      const key = `sova:pomodoro:count:${today}`
      const current = await kvGet(key) ?? 0
      await kvSet(key, (current || 0) + 1)
      await channel.send(`✅ Pomodoro č. ${round} hotový! Skvelá práca 🎉\nDaj si 5-minútovú prestávku — zaslúžiš si to.`)
      pomodoroTimeout = null
    } catch (e) {
      console.error('Pomodoro end error:', e)
    }
  }, minutes * 60 * 1000)
}

function stopPomodoro() {
  if (pomodoroTimeout) {
    clearTimeout(pomodoroTimeout)
    pomodoroTimeout = null
    return true
  }
  return false
}

// Conversation history — loaded from KV, persisted after each message
let history = []

async function loadHistory() {
  try {
    const saved = await kvGet('sova:conversations')
    if (Array.isArray(saved) && saved.length > 0) {
      // Ensure history starts with 'user' role (Claude requirement)
      let clean = saved.filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      if (clean.length > 0 && clean[0].role !== 'user') clean = clean.slice(1)
      history = clean
      console.log(`Loaded ${history.length} messages from history`)
    }
  } catch (e) {
    console.error('loadHistory error:', e)
  }
}

async function saveHistory() {
  await kvSet('sova:conversations', history.slice(-40))
}

// Planning session state
let planningSession = null

const SYSTEM_PROMPT = `Si SONA – Natkin osobny asistent a priatelka. Si uprimna, tepla, zivahna, prirodzena, obcas vtipna. Pises ako skutocna priatelka – nie ako robot.

JAZYK – ABSOLUTNE KRITICKE PRAVIDLA:
- Pises VYHRADNE po slovensky, 100% slovencina
- BEZ diakritiky (bez hacikov a dlznovov) ale VZDY spravna slovenska gramatika
- NIKDY cestina, NIKDY polstina, NIKDY rustina, NIKDY azbuka – ani jedno pismeno
- Ked pouzivas meno: VZDY "Natka" – NIKDY "Natko" (to je ceska verzia, nie slovenska)
- Meno nepouzivaj v kazdej sprave – len prirodzene ked to sedi
- NIKDY nepouzivaj slovo "kamoska"

ROD – VELMI DOLEZITE:
- Natka je ZENA – vzdy pouzivaj zensky rod: "mala", "robila", "prisla", "unavena", "pripravena" atd
- NIKDY muzsky rod pre Natku

CAS – VELMI DOLEZITE:
- Vzdy europsky cas (Europe/Bratislava, UTC+1/+2)
- 5:30 = rano, 17:30 = poobede/vecer, 22:00 = noc
- Pouzivaj 24-hodinovy format

STYL:
- Kratke, prirodzene spravy – max 3-4 vety
- Obcas emoji, nie vzdy
- Ziadne formalnosti, ziadne "samozrejme" ani podobne roboty vyrazy
- Raz za cas prirodzene ponukni: "ak chces aby som ti nieco pripomenula alebo zapamatala, len napis"

PRIPOMIENKY – KRITICKE:
- TY VIES POSIELAT SPRAVY SAMA OD SEBA cez automaticky system!
- NIKDY nehovor "nastav si budik", "pripomeň si sama", "daj si budik v telefone" – TO JE TVOJA PRACA, nie Natkina
- NIKDY nehovor ze nevies posielat notifikacie – VIES to
- Ked Natka spomenie konkretny cas, automaticky jej nastav pripomienku 30 minut pred

SLOVENCINA – KRITICKE:
- Pises BEZ diakritiky ale VZDY spravna slovenska gramatika a slovenska skladba viet
- NIKDY ceske slova ani ceske tvary: "nezapomeň"→"nezabudni", "připrav"→"priprav", "pošli"→"posli"
- Vzdy zensky rod: "zapamätala som si", "nastavila som", "poslem ti"

Oblasti: marketing, Sportqo, Drixton, LinkedIn, osobny rozvoj, wellness.`

const PLANNING_QUESTIONS = [
  { step: 'workout', q: 'V ktore dni sa chystas cvicit tento tydzen? A co bude – beh, fitko, nieco ine? 🏃‍♀️' },
  { step: 'hockey', q: 'Mas cez vikend nejaky zapas? Ak ano, kedy a proti komu? 🏑' },
  { step: 'work', q: 'Co zaujimave ta caka pracovne? Nejake projekty, meetingy alebo vyzvy na ktore sa chystas? 💼' },
  { step: 'other', q: 'Je este nieco co by som mala vediet, alebo chces aby som ti nieco pripomenula? Ak nie, pokojne napis "nie" 😊' },
]

async function savePlan(data) {
  const existing = await kvGet('sova:weekly_plan') ?? {}
  await kvSet('sova:weekly_plan', { ...existing, ...data, updatedAt: new Date().toISOString() })
}

async function saveReminder(text) {
  const reminders = await kvGet('sova:reminders') ?? []
  reminders.push({ text, createdAt: new Date().toISOString() })
  await kvSet('sova:reminders', reminders.slice(-20))
}

// ── TASK REMINDERS ───────────────────────────────────────────────────────────
function scheduleTaskReminder(title, time, channel, minutesBefore = 30) {
  const [rH, rM] = time.split(':').map(Number)
  const nowBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
  const notifyBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
  notifyBratislava.setHours(rH, rM, 0, 0)
  notifyBratislava.setMinutes(notifyBratislava.getMinutes() - minutesBefore)
  const tzOffset = new Date().getTime() - nowBratislava.getTime()
  const notifyAt = new Date(notifyBratislava.getTime() + tzOffset)
  const delayMs = notifyAt.getTime() - Date.now()
  if (delayMs <= 0 || delayMs >= 24 * 60 * 60 * 1000) return ''

  const key = title.toLowerCase().trim()
  if (activeReminders.has(key)) clearTimeout(activeReminders.get(key).timeoutId)

  const timeoutId = setTimeout(async () => {
    try { await channel.send(`⏰ Pripomienka: **${title}** o ${time} – za ${minutesBefore} minut!`) } catch {}
    activeReminders.delete(key)
  }, delayMs)

  const notifyTimeStr = notifyBratislava.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
  activeReminders.set(key, { timeoutId, time, channel, title })
  return ` Pripomeniem ti to o ${notifyTimeStr} (${minutesBefore} min pred).`
}

// ── TIMED REMINDERS ──────────────────────────────────────────────────────────
async function scheduleReminder(userText, channel) {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `Z tejto spravy extrahuj cas pripomienky a minuty vopred. Sprava: "${userText}". Teraz je ${new Date().toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' })} (Europe/Bratislava). Vrat LEN JSON: {"reminderTime": "HH:MM", "minutesBefore": 30, "eventDescription": "..."} alebo {"error": "no time found"}. Nic ine.`,
    }],
  })

  try {
    const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    if (parsed.error || !parsed.reminderTime) return false

    const [rHours, rMinutes] = parsed.reminderTime.split(':').map(Number)

    // Build notifyAt in Bratislava timezone
    const nowBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    const notifyBratislava = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bratislava' }))
    notifyBratislava.setHours(rHours, rMinutes, 0, 0)
    notifyBratislava.setMinutes(notifyBratislava.getMinutes() - (parsed.minutesBefore ?? 0))

    const tzOffset = new Date().getTime() - nowBratislava.getTime()
    const notifyAt = new Date(notifyBratislava.getTime() + tzOffset)
    const delayMs = notifyAt.getTime() - Date.now()

    if (delayMs <= 0 || delayMs > 24 * 60 * 60 * 1000) return 'too_close'

    const reminder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      notifyAt: notifyAt.toISOString(),
      eventDescription: parsed.eventDescription,
      reminderTime: parsed.reminderTime,
      channelId: channel.id,
    }
    await addTimedReminder(reminder)
    setTimeout(() => fireReminder(reminder), delayMs)

    const notifyTime = notifyBratislava.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    console.log(`Reminder set: "${parsed.eventDescription}" at ${notifyTime} (in ${Math.round(delayMs/60000)} min)`)
    return { notifyTime, eventTime: parsed.reminderTime, eventDescription: parsed.eventDescription, minutesBefore: parsed.minutesBefore ?? 0 }
  } catch (e) {
    console.error('scheduleReminder error:', e)
    return false
  }
}

client.once('ready', async () => {
  console.log(`SOVA bot ready as ${client.user.tag}`)
  console.log(`Listening on channel: ${CHANNEL_ID}`)
  await loadHistory()
  await loadAndRescheduleReminders()
})

client.on('messageCreate', async (message) => {
  console.log(`Message received: channel=${message.channelId} author=${message.author.tag} bot=${message.author.bot}`)
  if (message.channelId !== CHANNEL_ID) {
    console.log(`Ignoring — expected channel ${CHANNEL_ID}`)
    return
  }
  if (message.author.bot) return

  const userText = message.content.trim()
  if (!userText) return

  await message.channel.sendTyping()
  const textLower = userText.toLowerCase()

  // ── === DOPLNENIE ─────────────────────────────────────────────────
  if (userText.startsWith('===')) {
    const addition = userText.slice(3).trim()
    if (addition) {
      await saveReminder(addition)
      await message.channel.send(`Zapisala som! Ak chces este nieco pridat, staci znova napisat === a text 📝`)
    }
    return
  }

  // ── PLANNING SESSION ──────────────────────────────────────────────
  if (textLower.includes('prehlad') || textLower.includes('prehľad')) {
    planningSession = { step: 0, answers: {} }
    await message.channel.send(`Jasne, pojdme na to! 📋 Chcem vediet vsetko co ta caka, nech viem ako ta najlepsie podporit.\n\n${PLANNING_QUESTIONS[0].q}`)
    return
  }

  if (planningSession !== null) {
    const currentStep = PLANNING_QUESTIONS[planningSession.step]
    planningSession.answers[currentStep.step] = userText

    if (currentStep.step === 'workout') await savePlan({ workoutPlan: userText })
    if (currentStep.step === 'hockey') await savePlan({ hockeyPlan: userText })
    if (currentStep.step === 'work') await savePlan({ workPlan: userText })
    if (currentStep.step === 'other' && textLower !== 'nie') await saveReminder(userText)

    planningSession.step++

    if (planningSession.step < PLANNING_QUESTIONS.length) {
      await message.channel.send(PLANNING_QUESTIONS[planningSession.step].q)
      return
    } else {
      const answers = { ...planningSession.answers }
      planningSession = null
      const workoutLine = answers.workout && answers.workout.toLowerCase() !== 'nie' ? `💪 Cvicenie: ${answers.workout}\n` : ''
      const hockeyLine = answers.hockey && answers.hockey.toLowerCase() !== 'nie' ? `🏑 Zapas: ${answers.hockey}\n` : ''
      const workLine = answers.work && answers.work.toLowerCase() !== 'nie' ? `💼 Praca: ${answers.work}\n` : ''
      await message.channel.send(`Super, mam vsetko zapisane!\n\n${workoutLine}${hockeyLine}${workLine}\nBudem ta sledovat a pripominat. Ak sa nieco zmeni, len napis 😊`)
      return
    }
  }

  // ── TIMED REMINDER ────────────────────────────────────────────────
  const timedReminderKeywords = ['pripomeň mi', 'pripomen mi', 'upozorni ma', 'nezabudni mi pripomenut', 'chcem pripomienku', 'nastav pripomienku', 'pripomienku na', 'pripomienku o', 'pripomeň o', 'pripomen o']
  if (timedReminderKeywords.some(kw => textLower.includes(kw)) || /pripomien|pripomeň|reminder/.test(textLower) && /\d{1,2}:\d{2}/.test(textLower)) {
    const result = await scheduleReminder(userText, message.channel)
    if (result && result !== 'too_close') {
      await message.channel.send(`Nastavene! Pripomeniem ti ${result.eventDescription} o ${result.notifyTime} (${result.minutesBefore} minut pred ${result.eventTime}) ⏰`)
    } else if (result === 'too_close') {
      await message.channel.send(`Ou, to uz je o chvilku! Pripomienku viem nastavit iba ked mam aspon 15 minut cas. Skus ma poziadat skor 🙏`)
    } else {
      await message.channel.send(`Hmm, nevedela som rozpoznat cas. Skus napisat napr. "mam trening o 10:00, pripomeň mi pol hodinu predtym" 🙏`)
    }
    return
  }

  // ── SAVE REMINDER ─────────────────────────────────────────────────
  const reminderKeywords = ['zapamätaj', 'zapamataj', 'pripomeň', 'pripomen', 'nezabudni']
  if (reminderKeywords.some(kw => textLower.includes(kw))) {
    await saveReminder(userText)
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Potvrď ze si zapamatala: "${userText}". 1-2 vety, bez diakritiky.` }],
    })
    const reply = res.content[0]?.type === 'text' ? res.content[0].text : 'Zapisane! 📝'
    await message.channel.send(reply)
    return
  }

  // ── NORMALIZE (used by multiple sections below) ──────────────────
  const normalizedText = textLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // ── POMODORO ─────────────────────────────────────────────────────
  if (/zapni pomodoro|spusti pomodoro|zacat pomodoro|zacat pomodoro|start pomodoro|pomodoro start|ano.*pomodoro|pomodoro.*ano/i.test(normalizedText) ||
      (normalizedText.includes('pomodoro') && /ano|start|zapni|spusti|zacni/i.test(normalizedText))) {
    await startPomodoro(message.channel)
    return
  }
  if (/zastav pomodoro|stop pomodoro|zrus pomodoro|koniec pomodoro/i.test(normalizedText)) {
    const stopped = stopPomodoro()
    await message.channel.send(stopped ? 'Pomodoro zastavený. ⏹️' : 'Žiadny aktívny Pomodoro.')
    return
  }

  // ── TASK COMPLETION ──────────────────────────────────────────────
  const completionNorm = normalizedText
  if (/spravila som|hotovo|dokoncila som|splnila som|uz som|vybavila som|poslala som|zavolala som|odovzdala som|kupila som/.test(completionNorm)) {
    try {
      const tasksRes = await fetch(`${SOVA_URL}/api/tasks`, {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
      const allTasks = await tasksRes.json()
      const openTasks = Array.isArray(allTasks) ? allTasks.filter(t => t.status !== 'done') : []
      if (openTasks.length > 0) {
        const matchRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: `Sprava: "${userText}". Zoznam uloh: ${openTasks.map((t, i) => `${i}:${t.title}`).join(', ')}. Ktora uloha bola splnena? Vrat LEN cislo indexu alebo "none". Nic ine.`,
          }],
        })
        const idx = matchRes.content[0]?.type === 'text' ? matchRes.content[0].text.trim() : 'none'
        const taskIndex = parseInt(idx)
        if (!isNaN(taskIndex) && openTasks[taskIndex]) {
          const task = openTasks[taskIndex]
          await fetch(`${SOVA_URL}/api/tasks`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${CRON_SECRET}` },
            body: JSON.stringify({ id: task.id, status: 'done' }),
          })
          await message.channel.send(`Super, odfajkla som "**${task.title}**" ako splnenu! 🎉`)
          return
        }
      }
    } catch (e) {
      console.error('Task completion error:', e)
    }
  }

  // ── CANCEL / CHANGE REMINDER ─────────────────────────────────────
  const norm2 = normalizedText
  if (/zrus pripomienku|cancel pripomienku|nechcem pripomienku|vypni pripomienku/.test(norm2)) {
    if (activeReminders.size === 0) {
      await message.channel.send('Nemas ziadnu aktivnu pripomienku.')
    } else {
      activeReminders.forEach(r => clearTimeout(r.timeoutId))
      activeReminders.clear()
      await message.channel.send('Zrusila som vsetky pripomienky. ✅')
    }
    return
  }
  const changeMatch = norm2.match(/zmen pripomienku.{0,20}na (\d{1,2}:\d{2})|pripomeň.{0,10}o (\d{1,2}:\d{2}) namiesto|zmen cas.{0,10}na (\d{1,2}:\d{2})/)
  if (changeMatch && activeReminders.size > 0) {
    const newTime = changeMatch[1] || changeMatch[2] || changeMatch[3]
    const last = [...activeReminders.values()][activeReminders.size - 1]
    clearTimeout(last.timeoutId)
    const note = scheduleTaskReminder(last.title, newTime, last.channel)
    await message.channel.send(`Zmenila som pripomienku na ${newTime}.${note}`)
    return
  }

  // ── TASK DETECTION ───────────────────────────────────────────────
  const taskPatterns = /potrebujem |musim |treba |mam (spravit|urobit|dokoncit|pripravit|poslat|zavolat|napisat|odovzdat|odovzdat|odniest|kupit|vybavit|zaplatit)|o \d{1,2}:\d{2} (mam|idem|musim|treba)|pridaj ulohu|zarad do uloh/i
  if (taskPatterns.test(normalizedText)) {
    try {
      const taskRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Z tejto spravy extrahuj ulohu. Sprava: "${userText}". Dnes je ${new Date().toLocaleDateString('sk-SK', { timeZone: 'Europe/Bratislava' })}. Vrat LEN JSON: {"title": "kratky nazov ulohy", "category": "work|personal", "priority": "high|medium|low", "deadline": "YYYY-MM-DD alebo null", "time": "HH:MM alebo null"}. Nic ine.`,
        }],
      })
      const taskText = taskRes.content[0]?.type === 'text' ? taskRes.content[0].text.trim() : ''
      const jsonMatch = taskText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const res = await fetch(`${SOVA_URL}/api/tasks`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'authorization': `Bearer ${CRON_SECRET}` },
          body: JSON.stringify({
            title: parsed.title,
            category: parsed.category ?? 'personal',
            priority: parsed.priority ?? 'medium',
            deadline: parsed.deadline && parsed.deadline !== 'null' ? parsed.deadline : undefined,
          }),
        })
        if (res.ok) {
          const deadlineStr = parsed.deadline && parsed.deadline !== 'null'
            ? ` do ${new Date(parsed.deadline).toLocaleDateString('sk-SK')}` : ''
          const followUp = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Si Sona. Prave si ulozila ulohu "${parsed.title}"${deadlineStr}. Napisˇ 1-2 vety bez diakritiky po slovensky: potvrď ze si to zapisala a prirodzene sa opytaj ci potrebuje pomoc s planovanim alebo nieco ine. Zensky rod pre Natku.`,
            }],
          })
          const followUpText = followUp.content[0]?.type === 'text' ? followUp.content[0].text : ''
          // Schedule reminder 30 min before if task has specific time today
          let reminderNote = ''
          if (parsed.time && parsed.time !== 'null') {
            reminderNote = scheduleTaskReminder(parsed.title, parsed.time, message.channel)
          }

          await message.channel.send(`${followUpText}${reminderNote}`)
          return
        }
      }
    } catch (e) {
      console.error('Task detection error:', e)
    }
  }

  // ── GENERAL CHAT ─────────────────────────────────────────────────
  history.push({ role: 'user', content: userText })
  if (history.length > 40) history.splice(0, history.length - 40)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-20),
      ],
    })

    const reply = response.choices[0]?.message?.content ?? ''
    if (!reply) return

    history.push({ role: 'assistant', content: reply })
    if (history.length > 40) history.splice(0, history.length - 40)

    await message.channel.send(reply)
    await saveHistory()

    const mediaUrl = detectMedia(userText)
    if (mediaUrl) await message.channel.send(mediaUrl)
  } catch (err) {
    console.error('OpenAI error:', err)
    await message.channel.send(`Prepac, nieco sa pokazilo (${err.message ?? 'unknown error'}). Skus znova 🙏`)
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
