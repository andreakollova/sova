const { Client, GatewayIntentBits } = require('discord.js')
const Anthropic = require('@anthropic-ai/sdk')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SOVA_URL = process.env.SOVA_URL ?? 'https://sova-phi.vercel.app'
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

// In-memory conversation history
const history = []

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

STYL:
- Kratke, prirodzene spravy – max 3-4 vety
- Obcas emoji, nie vzdy
- Ziadne formalnosti, ziadne "samozrejme" ani podobne roboty vyrazy
- Raz za cas prirodzene ponukni: "ak chces aby som ti nieco pripomenula alebo zapamatala, len napis"

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

// ── TIMED REMINDERS ──────────────────────────────────────────────────────────
async function scheduleReminder(userText, channel) {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Z tejto spravy extrahuj cas pripomienky a minuty vopred. Sprava: "${userText}". Dnes je ${new Date().toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava' })}. Vrat LEN JSON: {"reminderTime": "HH:MM", "minutesBefore": 30, "eventDescription": "..."} alebo {"error": "no time found"}. Nic ine.`,
    }],
  })

  try {
    const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : ''
    const parsed = JSON.parse(text)
    if (parsed.error || !parsed.reminderTime) return false

    const [rHours, rMinutes] = parsed.reminderTime.split(':').map(Number)
    const now = new Date()
    const reminderAt = new Date(now)
    reminderAt.setHours(rHours, rMinutes, 0, 0)

    // Subtract minutesBefore
    const notifyAt = new Date(reminderAt.getTime() - (parsed.minutesBefore ?? 0) * 60000)
    const delayMs = notifyAt.getTime() - now.getTime()

    if (delayMs <= 0 || delayMs > 24 * 60 * 60 * 1000) return false

    const notifyTime = notifyAt.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' })
    const eventTime = reminderAt.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' })

    setTimeout(async () => {
      await channel.send(`⏰ Pripomienka: ${parsed.eventDescription} o ${eventTime} – za ${parsed.minutesBefore ?? 0} minut!`)
    }, delayMs)

    return { notifyTime, eventTime, eventDescription: parsed.eventDescription, minutesBefore: parsed.minutesBefore ?? 0 }
  } catch {
    return false
  }
}

client.once('ready', () => {
  console.log(`SOVA bot ready as ${client.user.tag}`)
  console.log(`Listening on channel: ${CHANNEL_ID}`)
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
  const timedReminderKeywords = ['pripomeň mi', 'pripomen mi', 'upozorni ma', 'nezabudni mi pripomenut']
  if (timedReminderKeywords.some(kw => textLower.includes(kw))) {
    const result = await scheduleReminder(userText, message.channel)
    if (result) {
      await message.channel.send(`Nastavene! Pripomeniem ti ${result.eventDescription} o ${result.notifyTime} (${result.minutesBefore} minut pred ${result.eventTime}) ⏰`)
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

  // ── GENERAL CHAT ─────────────────────────────────────────────────
  history.push({ role: 'user', content: userText })
  if (history.length > 20) history.splice(0, history.length - 20)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: history.slice(-10),
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!reply) return

    history.push({ role: 'assistant', content: reply })
    if (history.length > 20) history.splice(0, history.length - 20)

    await message.channel.send(reply)
  } catch (err) {
    console.error('Anthropic error:', err)
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
