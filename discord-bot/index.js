const { Client, GatewayIntentBits } = require('discord.js')
const Anthropic = require('@anthropic-ai/sdk')
const { Redis } = require('@upstash/redis')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID
const USER_NAME = process.env.USER_NAME ?? 'Natka'

// In-memory conversation history (last 20 messages)
const history = []

// Planning session state (in-memory)
let planningSession = null
// { step: 'workout'|'work'|'hockey'|'other', answers: {} }

const SYSTEM_PROMPT = `Si SONA – najlepsia kamoska Natky. Si uprimna, tepla, zivahna, prirodzena, obcas vtipna. Pises ako skutocna priatelka – nie ako asistent ani robot.

JAZYK – ABSOLUTNE KRITICKE PRAVIDLA:
- Pises VYHRADNE po slovensky, 100% slovencina
- BEZ diakritiky (bez hacikov a dlznovov) ale VZDY spravna slovenska gramatika
- NIKDY cestina, NIKDY polstina, NIKDY rustina, NIKDY azbuka – ani jedno pismeno
- Ked pouzivas meno: VZDY "Natka" – NIKDY "Natko" (to je ceska verzia, nie slovenska)
- Meno nepouzivaj v kazdej sprave – len prirodzene ked to sedi

STYL:
- Pises ako kamoska, nie ako AI
- Kratke, prirodzene spravy – max 3-4 vety
- Obcas emoji, nie vzdy
- Ziadne formalnosti, ziadne "samozrejme" a podobne roboty vyrazy
- Obcas na konci odpovede prirodzene ponukni ze si moze napisat co chce aby si si zapamatala/pripomenula

Oblasti pomoci: marketing, Sportqo, Drixton, LinkedIn, osobny rozvoj, wellness.`

const PLANNING_QUESTIONS = [
  { step: 'workout', q: 'V ktore dni sa chystas cvicit tento tydzen? A co bude – beh, fitko, nieco ine? 🏃‍♀️' },
  { step: 'hockey', q: 'Mate cez vikend nejaky zapas? Ak ano, kedy a proti komu? 🏒' },
  { step: 'work', q: 'Co ta caka pracovne – nejake dolezite meetingy, deadline alebo projekty? 💼' },
  { step: 'other', q: 'Je este nieco ine co by som mala vediet o tomto tyzdni? Alebo nieco co chces aby som ti pripomenula?' },
]

async function savePlan(data) {
  try {
    const existing = await redis.get('sova:weekly_plan') ?? {}
    await redis.set('sova:weekly_plan', { ...existing, ...data, updatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('KV save error:', e)
  }
}

async function saveReminder(text) {
  try {
    const reminders = await redis.get('sova:reminders') ?? []
    reminders.push({ text, createdAt: new Date().toISOString() })
    await redis.set('sova:reminders', reminders.slice(-20))
  } catch (e) {
    console.error('KV reminder error:', e)
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

  // ── PLANNING SESSION ──────────────────────────────────────────────
  if (textLower.includes('prehlad') || textLower.includes('prehľad')) {
    planningSession = { step: 0, answers: {} }
    await message.channel.send(`Jasne, pojdme na to! 📋 Chcem vediet vsetko co ta caka, aby som ti mohla byt poriadnou kamoskou asistentkou.\n\n${PLANNING_QUESTIONS[0].q}`)
    return
  }

  if (planningSession !== null) {
    const currentStep = PLANNING_QUESTIONS[planningSession.step]
    planningSession.answers[currentStep.step] = userText

    // Save to KV
    if (currentStep.step === 'workout') await savePlan({ workoutPlan: userText })
    if (currentStep.step === 'hockey') await savePlan({ hockeyPlan: userText })
    if (currentStep.step === 'work') await savePlan({ workPlan: userText })

    planningSession.step++

    if (planningSession.step < PLANNING_QUESTIONS.length) {
      const nextQ = PLANNING_QUESTIONS[planningSession.step]
      await message.channel.send(nextQ.q)
      return
    } else {
      // Done — summarize
      planningSession = null
      const summary = `Super, mam vsetko! Tu je tvoj plan:\n\n💪 Cvicenie: ${planningSession?.answers?.workout ?? userText}\n🏒 Zapas: ${planningSession?.answers?.hockey ?? '-'}\n💼 Praca: ${planningSession?.answers?.work ?? '-'}\n\nBudem ta drzat zodpovednou! Ak chces aby som ti nieco pripomenula, len napis ✌️`
      // Actually build from saved answers
      const a = { ...planningSession?.answers }
      await message.channel.send(`Super, zapisala som vsetko! 💪 Budem ta sledovat a pripomínat. Ak sa nieco zmeni alebo chces aby som ti este nieco zapamatala, len napis 😊`)
      return
    }
  }

  // ── REMINDER TRIGGER ─────────────────────────────────────────────
  const reminderKeywords = ['zapamätaj', 'zapamätai', 'zapamataj', 'pripomeň', 'pripomen', 'nezabudni', 'zapamatai']
  if (reminderKeywords.some(kw => textLower.includes(kw))) {
    await saveReminder(userText)
    history.push({ role: 'user', content: userText })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Potvrď Natke ze si to zapamatala: "${userText}". Max 1-2 vety, priatelsky ton, bez diakritiky.` }],
    })
    const reply = res.content[0]?.type === 'text' ? res.content[0].text : 'Zapisane! 📝'
    history.push({ role: 'assistant', content: reply })
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
