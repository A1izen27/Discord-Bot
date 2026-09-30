'use strict'

const {
  findChar,
  findWeapon,
  findArtifact,
  formatChar,
  formatWeapon,
  formatArtifact,
  formatMats,
  disambiguate,
  getBuilds,
} = require('./search')

// Live production domain for the Vercel project (team scope:
// vihannagz27-6153s-projects). The old genshin-omega.vercel.app host has no
// deployment behind it and 404s.
const SITE_URL = 'https://genshin-vihannagz27-6153s-projects.vercel.app/'

function pick(detail, query) {
  if (detail.list.length === 0) return { reply: { title: 'Not found', description: `Nothing matched **${query}**. Check the spelling or try fewer words.`, color: 0xe64545, fields: [], footer: 'Genshin Helper' } }
  if (detail.list.length === 1) return { reply: detail.formatter(detail.list[0]), match: detail.list[0] }
  return { reply: disambiguate(detail.list.slice(0, 15), detail.manyLabel || 'results') }
}

function hasBuild(c) {
  const b = getBuilds()
  return !!(b[c.key] || b[c.name])
}

function noBuild(c) {
  return {
    title: 'No build data',
    description: `No suggested build is currently available for **${c.name}**.\n\nEvery character normally ships a generated build (with KQM quick-guide detail and community drafts on top) — try **/help** for what else I know.`,
    color: 0xffb347,
    fields: [],
    footer: 'Genshin Helper',
  }
}

const route = {
  char: (q) => pick({ list: findChar(q).list, formatter: formatChar, manyLabel: 'characters' }, q),
  build: (q) => {
    const found = findChar(q).list
    if (found.length === 0) return { reply: { title: 'Not found', description: `Nothing matched **${q}**.`, color: 0xe64545, fields: [], footer: 'Genshin Helper' } }
    if (found.length === 1) {
      const c = found[0]
      return hasBuild(c)
        ? { reply: formatChar(c), match: c }
        : { reply: noBuild(c) }
    }
    if (found.length > 15) return { reply: disambiguate(found.slice(0, 15), 'characters') }
    const curated = found.filter(hasBuild)
    if (curated.length === 1) return { reply: formatChar(curated[0]), match: curated[0] }
    return pick({ list: curated.length ? curated : found, formatter: formatChar, manyLabel: 'characters' }, q)
  },
  weapon: (q) => pick({ list: findWeapon(q).list, formatter: formatWeapon, manyLabel: 'weapons' }, q),
  artifact: (q) => pick({ list: findArtifact(q).list, formatter: formatArtifact, manyLabel: 'artifact sets' }, q),
  mats: (q) => pick({ list: findChar(q).list, formatter: formatMats, manyLabel: 'characters' }, q),
}

const HELP = {
  title: 'Genshin Helper — Commands',
  description: 'I pull character, weapon, artifact and material data from the bundled Genshin database. Names are fuzzy — `/char hu tao` works.',
  color: 0x63b5ff,
  fields: [
    { name: '/char <name>', value: 'Full character sheet: max stats, ascension bonus, total materials, suggested build.', inline: false },
    { name: '/mats <name>', value: 'All materials needed for a character (ascension + talents), grouped by type.', inline: false },
    { name: '/build <name>', value: 'Suggested build (weapons/artifacts/main stats/substats) — generated for every character from game data.', inline: false },
    { name: '/weapon <name>', value: 'Weapon stats, passive at R1 and R5, ascension materials.', inline: false },
    { name: '/artifact <name>', value: 'Artifact set 2-pc / 4-pc bonuses and pieces.', inline: false },
    { name: '/help', value: 'This message.', inline: false },
    { name: '/website', value: 'Open the companion website with all characters, builds, stats and materials.', inline: false },
    { name: '/bot', value: 'About this bot and the companion website.', inline: false },
  ],
  footer: 'Data: genshin-db → local data.js bundle',
}

const BOT_INFO = {
  title: '🤖 Teraphane — Genshin Helper',
  description: 'A Teyvat database bot. Ask me about any character, weapon, artifact or material.',
  color: 0x63b5ff,
  fields: [
    { name: '📚 Commands', value: '`/char`  `/build`  `/mats`  `/weapon`  `/artifact`\nType **/help** for details on each one.', inline: false },
    { name: '🗺️ Companion website', value: `Live at **${SITE_URL}** — every character\'s materials, stats, images and builds in the browser.`, inline: false },
    { name: '🧠 Data source', value: 'Open-source **genshin-db** dataset, bundled into a local `data.js` bundle shipped with the app. Suggested builds are rule-generated from game data for every character, with KQM quick-guide detail (CC BY-NC-SA) where available.', inline: false },
    { name: '⚙️ Hosting', value: 'Runs on Vercel serverless functions — always available, zero maintenance from me.', inline: false },
  ],
  footer: 'Genshin Helper · fan-made, not affiliated with HoYoverse',
}

const SLASH_MANIFEST = [
  { name: 'char', description: 'Character sheet: max stats, ascension bonus, total materials, suggested build.', options: [{ type: 3, name: 'name', description: 'Character name — fuzzy matching', required: true }] },
  { name: 'mats', description: 'All materials for a character (ascension + talents), grouped by type.', options: [{ type: 3, name: 'name', description: 'Character name — fuzzy matching', required: true }] },
  { name: 'build', description: 'Suggested build (weapons/artifacts/main stats/substats) — generated for every character.', options: [{ type: 3, name: 'name', description: 'Character name — fuzzy matching', required: true }] },
  { name: 'weapon', description: 'Weapon stats, passive at R1/R5, ascension materials.', options: [{ type: 3, name: 'name', description: 'Weapon name — fuzzy matching', required: true }] },
  { name: 'artifact', description: 'Artifact set 2-pc / 4-pc bonuses and pieces.', options: [{ type: 3, name: 'name', description: 'Artifact set name — fuzzy matching', required: true }] },
  { name: 'help', description: 'Show all commands.', options: [] },
  { name: 'bot', description: 'About this bot, commands, and the companion website.', options: [] },
]

function optionArg(interaction) {
  const opts = (interaction.data && interaction.data.options) || []
  const opt = opts.find((o) => o.name === 'name')
  return opt ? String(opt.value || '').trim() : ''
}

function handleSlash(interaction) {
  const name = interaction.data && interaction.data.name
  const arg = optionArg(interaction)
  switch (name) {
    case 'help':
    case 'commands':
      return toEmbeds(HELP)
    case 'bot':
    case 'about':
    case 'info':
      return toEmbeds(BOT_INFO)
    case 'char':
    case 'character':
      if (!arg) return toEmbeds(HELP)
      return toEmbeds(route.char(arg).reply)
    case 'mats':
    case 'materials':
      if (!arg) return toEmbeds(HELP)
      return toEmbeds(route.mats(arg).reply)
    case 'build':
      if (!arg) return toEmbeds(HELP)
      return toEmbeds(route.build(arg).reply)
    case 'weapon':
      if (!arg) return toEmbeds(HELP)
      return toEmbeds(route.weapon(arg).reply)
    case 'artifact':
    case 'art':
      if (!arg) return toEmbeds(HELP)
      return toEmbeds(route.artifact(arg).reply)
    default:
      return toEmbeds(HELP)
  }
}

function toEmbeds(reply) {
  const color = reply.color || 0x3a3f45
  const footer = reply.footer ? { text: String(reply.footer).slice(0, 120) } : undefined
  const embeds = []
  let cur = null

  const open = () => {
    const e = { color, footer, fields: [] }
    if (embeds.length === 0) {
      if (reply.title) e.title = String(reply.title).slice(0, 256)
      if (reply.description) e.description = String(reply.description).slice(0, 4096)
    }
    embeds.push(e)
    cur = e
    return e
  }
  const room = (extra) => {
    if (!cur) return false
    return cur.fields.length < 25 && JSON.stringify(cur).length + (extra || 0) < 5900
  }

  for (const f of reply.fields || []) {
    let name = String(f.name || '').slice(0, 256)
    let value = f.value == null ? '' : String(f.value)
    const inline = !!f.inline
    while (value.length > 1024) {
      const part = value.slice(0, 1020)
      value = value.slice(1020)
      if (!room(400)) cur = open()
      cur.fields.push({ name, value: part + '…', inline })
      name = (name + ' (cont.)').slice(0, 256)
    }
    if (!room(300)) cur = open()
    cur.fields.push({ name, value, inline })
  }

  if (embeds.length === 0) open()
  return embeds.slice(0, 10)
}

module.exports = {
  route,
  HELP,
  BOT_INFO,
  SITE_URL,
  SLASH_MANIFEST,
  handleSlash,
  toEmbeds,
  optionArg,
  hasBuild,
  noBuild,
}