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

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID
const USER_NAME = process.env.USER_NAME ?? 'Natka'

// In-memory conversation history (last 20 messages)
const history = []

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

Oblasti pomoci: marketing, Sportqo, Drixton, LinkedIn, osobny rozvoj, wellness.`

client.once('ready', () => {
  console.log(`SOVA bot ready as ${client.user.tag}`)
  console.log(`Listening on channel: ${CHANNEL_ID}`)
})

client.on('messageCreate', async (message) => {
  console.log(`Message received: channel=${message.channelId} author=${message.author.tag} bot=${message.author.bot}`)
  // Only respond in the designated channel, ignore bots
  if (message.channelId !== CHANNEL_ID) {
    console.log(`Ignoring — expected channel ${CHANNEL_ID}`)
    return
  }
  if (message.author.bot) return

  const userText = message.content.trim()
  if (!userText) return

  // Show typing indicator
  await message.channel.sendTyping()

  // Add to history
  history.push({ role: 'user', content: userText })
  if (history.length > 20) history.shift()

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: history.slice(-10),
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    if (!reply) return

    // Add assistant response to history
    history.push({ role: 'assistant', content: reply })
    if (history.length > 20) history.shift()

    await message.channel.send(reply)
  } catch (err) {
    console.error('Anthropic error:', err)
  }
})

client.login(process.env.DISCORD_BOT_TOKEN)
