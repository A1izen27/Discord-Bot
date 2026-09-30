'use strict'

const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const { load } = require('./search')
const { route, HELP, SITE_URL } = require('./slash')

const PREFIX = '!'

function readToken() {
  if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN
  const cfgPath = path.join(__dirname, 'config.json')
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      if (cfg.token) return cfg.token
    } catch (e) {}
  }
  return null
}

function embedOf(msg) {
  const e = new EmbedBuilder().setColor(msg.color || 0x3a3f45).setTitle(msg.title).setDescription(msg.description || '')
  for (const f of msg.fields || []) e.addFields({ name: f.name, value: f.value, inline: !!f.inline })
  if (msg.footer) e.setFooter({ text: msg.footer })
  return e
}

const WEBSITE_REPLY = {
  title: '🌐 Genshin Helper Website',
  description: `Check out the companion website for characters, builds, stats and more:\n**${SITE_URL}**`,
  color: 0x63b5ff,
  fields: [],
  footer: 'Genshin Helper',
}

const HELP_PREFIX = {
  title: 'Genshin Helper — Commands',
  description: 'I pull character, weapon, artifact and material data from the bundled Genshin database.',
  color: 0x63b5ff,
  fields: HELP.fields.map((f) => ({
    name: PREFIX + f.name.slice(1),
    value: f.value,
    inline: false,
  })),
  footer: 'Data: genshin-db → local data.js bundle',
}

function main() {
  load()
  const token = readToken()
  if (!token) {
    console.error('No token. Set DISCORD_TOKEN env var or create bot/config.json with {"token":"..."}.')
    process.exit(1)
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

  client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag} — prefix "${PREFIX}"`)
  })

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return
    if (!message.content.startsWith(PREFIX)) return
    const text = message.content.slice(PREFIX.length).trim()
    if (!text) return
    const [cmdRaw, ...rest] = text.split(/\s+/)
    const cmd = cmdRaw.toLowerCase()
    const arg = rest.join(' ').trim()

    let result
    if (cmd === 'help' || cmd === 'commands' || cmd === 'about') result = { reply: HELP_PREFIX }
    else if (cmd === 'website' || cmd === 'web' || cmd === 'site') result = { reply: WEBSITE_REPLY }
    else if (cmd === 'char' || cmd === 'character') result = arg ? route.char(arg) : { reply: HELP_PREFIX }
    else if (cmd === 'build') result = arg ? route.build(arg) : { reply: HELP_PREFIX }
    else if (cmd === 'weapon') result = arg ? route.weapon(arg) : { reply: HELP_PREFIX }
    else if (cmd === 'artifact' || cmd === 'art' || cmd === 'set') result = arg ? route.artifact(arg) : { reply: HELP_PREFIX }
    else if (cmd === 'mats' || cmd === 'materials') result = arg ? route.mats(arg) : { reply: HELP_PREFIX }
    else return

    const reply = result.reply
    if (reply.fields.some((f) => f.value.length > 1024)) {
      const chunks = []
      let cur = reply.fields.shift()
      const drain = () => {
        if (cur && cur.value) chunks.push(cur)
        cur = null
      }
      for (const f of reply.fields) {
        if (f.value.length > 1024) {
          drain()
          chunks.push(f)
        } else if (cur) {
          if ((cur.value + '\n' + f.value).length <= 1024) cur.value += '\n' + f.value
          else { drain(); chunks.push(f) }
        } else cur = f
      }
      drain()
      const first = chunks.shift()
      const base = embedOf({ ...reply, fields: first ? [first] : [] })
      await message.reply({ embeds: [base] })
      for (const ch of chunks) {
        await message.reply({ embeds: [embedOf({ title: reply.title, color: reply.color, description: '', fields: [ch] })] })
      }
      return
    }
    await message.reply({ embeds: [embedOf(reply)] })
  })

  client.login(token).catch((e) => {
    console.error('Login failed:', e.message)
    process.exit(1)
  })
}

module.exports = { route, HELP: HELP_PREFIX, embedOf, main }

if (require.main === module) main()