'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')

function resolveDataPaths() {
  const candidates = []
  for (const base of [__dirname, process.cwd(), path.dirname(require.main && require.main.filename || '')]) {
    candidates.push(path.join(base, '..', 'assets', 'js', 'data.js'))
    candidates.push(path.join(base, 'assets', 'js', 'data.js'))
  }
  const dataPath = candidates.find((p) => { try { return fs.existsSync(p) } catch (e) { return false } })
  const buildsCandidates = candidates.map((p) => p.replace('data.js', 'builds.js'))
  const buildsPath = buildsCandidates.find((p) => { try { return fs.existsSync(p) } catch (e) { return false } })
  const kqmBuildsCandidates = candidates.map((p) => p.replace('data.js', 'kqm-builds.js'))
  const kqmBuildsPath = kqmBuildsCandidates.find((p) => { try { return fs.existsSync(p) } catch (e) { return false } })
  const genericCandidates = candidates.map((p) => p.replace('data.js', 'generic-builds.js'))
  const genericPath = genericCandidates.find((p) => { try { return fs.existsSync(p) } catch (e) { return false } })
  return { DATA_PATH: dataPath, BUILDS_PATH: buildsPath, KQM_BUILDS_PATH: kqmBuildsPath, GENERIC_PATH: genericPath }
}

const _paths = resolveDataPaths()
const DATA_PATH = _paths.DATA_PATH
const BUILDS_PATH = _paths.BUILDS_PATH
const KQM_BUILDS_PATH = _paths.KQM_BUILDS_PATH
const GENERIC_PATH = _paths.GENERIC_PATH

let DATA = null
let BUILDS = {}

/* Resolve one build per character: generated (universal) < KQM < curated.
 * Higher layers inherit any fields they don't define (role/priority) from the
 * generated baseline. */
function resolveBuilds(sources, characters) {
  const out = {}
  for (const c of Object.values(characters)) {
    const gen = (sources[0] && (sources[0][c.key] || sources[0][c.name])) || null
    let v = gen
    for (const m of sources.slice(1)) {
      const hit = m && (m[c.key] || m[c.name])
      if (hit) v = Object.assign({}, gen, hit)
    }
    if (v) out[c.key] = v
  }
  return out
}

function load() {
  if (DATA) return DATA
  if (!DATA_PATH || !fs.existsSync(DATA_PATH)) {
    throw new Error('data.js bundle not found. Run scripts/build-bundle.js or deploy the full repo.')
  }
  const sandbox = { window: {} }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(DATA_PATH, 'utf8'), sandbox)
  const sources = []
  try {
    if (GENERIC_PATH && fs.existsSync(GENERIC_PATH)) {
      const gsandbox = { window: {} }
      vm.createContext(gsandbox)
      vm.runInContext(fs.readFileSync(GENERIC_PATH, 'utf8'), gsandbox)
      sources.push(gsandbox.window.GI_GENERIC_BUILDS)
    }
  } catch (e) {}
  try {
    if (KQM_BUILDS_PATH && fs.existsSync(KQM_BUILDS_PATH)) {
      const ksandbox = { window: {} }
      vm.createContext(ksandbox)
      vm.runInContext(fs.readFileSync(KQM_BUILDS_PATH, 'utf8'), ksandbox)
      sources.push(ksandbox.window.GI_KQM_BUILDS)
    }
  } catch (e) {}
  try {
    const bsandbox = { window: {} }
    vm.createContext(bsandbox)
    vm.runInContext(fs.readFileSync(BUILDS_PATH, 'utf8'), bsandbox)
    sources.push(bsandbox.window.GI_BUILDS || {})
  } catch (e) {
    sources.push({})
  }
  DATA = sandbox.window.GI_DATA
  BUILDS = resolveBuilds(sources, DATA.characters)
  return DATA
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u00ff]+/g, '')
}

function searchDict(dict, query, extract) {
  const q = norm(query)
  if (!q) return []
  const entries = Object.values(dict)
  const hits = { exact: [], starts: [], partial: [] }
  for (const item of entries) {
    const hay = norm(extract(item))
    if (hay === q) hits.exact.push(item)
    else if (hay.startsWith(q)) hits.starts.push(item)
    else if (hay.includes(q)) hits.partial.push(item)
  }
  return [...hits.exact, ...hits.starts, ...hits.partial]
}

function findChar(q) {
  load()
  const chars = Object.values(DATA.characters)
  const qn = norm(q)
  const exact = chars.find((c) => c.key === qn || norm(c.name) === qn)
  if (exact) return { list: [exact] }
  return { list: searchDict(DATA.characters, q, (c) => c.name + ' ' + c.title) }
}

function findWeapon(q) {
  load()
  return { list: searchDict(DATA.weapons, q, (w) => w.name) }
}

function findArtifact(q) {
  load()
  return { list: searchDict(DATA.artifacts, q, (a) => a.name) }
}

const ELEMENT_COLOR = {
  anemo: 0x66e0dc,
  cryo: 0xbfeaff,
  dendro: 0xa8e36e,
  electro: 0xc779f2,
  geo: 0xf5ce6e,
  hydro: 0x63b5ff,
  pyro: 0xff9066,
}

const ELEMENT_EMOJI = {
  anemo: '💨',
  cryo: '❄️',
  dendro: '🌿',
  electro: '⚡',
  geo: '⛰️',
  hydro: '💧',
  pyro: '🔥',
}

function elementColor(ele) {
  return ELEMENT_COLOR[ele] || 0x3a3f45
}

function elementEmoji(ele) {
  return ELEMENT_EMOJI[ele] || ''
}

function stars(n) {
  n = n || 0
  return '★'.repeat(n) + '☆'.repeat(5 - Math.min(5, Math.max(0, n)))
}

function num(n) {
  const v = Number(n) || 0
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function buildSummary(c) {
  const b = BUILDS[c.key] || BUILDS[c.name]
  if (!b) return ''
  const wl = (b.weapons || []).map((x) => cleanWeaponName(x.name)).slice(0, 4).join(', ')
  const al = (b.artifacts || []).map((x) => (x.pieces ? `${x.set} x${x.pieces}` : x.set)).join(', ')
  let out = `**Role:** ${b.role || '—'}`
  if (wl) out += `\n**Weapons:** ${wl}`
  if (al) out += `\n**Artifacts:** ${al}`
  if (b.mainStats) out += `\n**Main Stats:** ${b.mainStats}`
  return out
}

function cleanWeaponName(name) {
  return String(name || '').replace(/^\d★\s*/, '').trim()
}

function totalMats(c) {
  const asc = (c.ascTotal || []).map((m) => `\`${m.name} ×${num(m.count)}\``).join(' ')
  const t = (c.talents && c.talents.total) || []
  const tal = t.map((m) => `\`${m.name} ×${num(m.count)}\``).join(' ')
  let out = ''
  if (asc) out += `**Ascension (to Lv.90):** ${asc} \`${num(c.ascMora || 0)} Mora\``
  if (tal) out += `\n**Talents (all ≥10):** ${tal} \`${num((c.talents && c.talents.mora) || 0)} Mora\``
  return out || '—'
}

const BONUS_LABEL = {
  FIGHT_PROP_ATTACK_PERCENT: 'ATK',
  FIGHT_PROP_HP_PERCENT: 'HP',
  FIGHT_PROP_DEFENSE_PERCENT: 'DEF',
  FIGHT_PROP_CRITICAL: 'CRIT Rate',
  FIGHT_PROP_CRITICAL_HURT: 'CRIT DMG',
  FIGHT_PROP_ELEMENT_MASTERY: 'Elemental Mastery',
  FIGHT_PROP_HEAL_ADD: 'Healing Bonus',
  FIGHT_PROP_CHARGE_EFFICIENCY: 'Energy Recharge',
  CHARGE_EFFICIENCY: 'Energy Recharge',
  FIGHT_PROP_FIRE_ADD_HURT: 'Pyro DMG',
  FIGHT_PROP_WATER_ADD_HURT: 'Hydro DMG',
  FIGHT_PROP_GRASS_ADD_HURT: 'Dendro DMG',
  FIGHT_PROP_ELEC_ADD_HURT: 'Electro DMG',
  FIGHT_PROP_WIND_ADD_HURT: 'Anemo DMG',
  FIGHT_PROP_ROCK_ADD_HURT: 'Geo DMG',
  FIGHT_PROP_ICE_ADD_HURT: 'Cryo DMG',
  FIGHT_PROP_PHYSICAL_ADD_HURT: 'Physical DMG',
}

function bonusLabel(type) {
  if (BONUS_LABEL[type]) return BONUS_LABEL[type]
  return String(type || '').replace(/_/g, ' ')
}

/* ------------------------------- Formatters ------------------------------ */

function formatChar(c) {
  const max = (c.ascStats || []).slice(-1)[0] || {}
  const bonus = c.ascensionBonusPct
    ? `${bonusLabel(c.ascensionBonusType)} +${c.ascensionBonusPct}%`
    : ''
  const build = buildSummary(c)
  const fields = [
    {
      name: `📊 Max Stats (${max.label || 'Max'})`,
      value: `HP ${num(max.hp)} · ATK ${num(max.atk)} · DEF ${num(max.def)}${bonus ? `\n**Ascension:** ${bonus}` : ''}`,
      inline: false,
    },
    {
      name: '🧬 Progression',
      value: `Rarity ${stars(c.rarity)}
Element: ${c.elementText || c.element}
Weapon: ${c.weaponText || c.weapon}
Region: ${c.region || '—'}
Constellation: ${c.constellation || '—'}`,
      inline: false,
    },
    {
      name: '📦 Total Materials',
      value: totalMats(c),
      inline: false,
    },
  ]
  if (build) fields.push({ name: `🛠️ Suggested Build (${(c.name)})`, value: build, inline: false })
  return {
    title: `${c.name} ${stars(c.rarity)}`,
    description: `**${c.title || ''}** ${c.affiliation ? `— ${c.affiliation}` : ''}\n${c.description || ''}`,
    color: elementColor(c.element) || 0x3a3f45,
    fields,
    footer: elementEmoji(c.element) + ' ' + (c.elementText || '') + ' · Genshin Helper',
  }
}

function formatWeapon(w) {
  const r1 = (w.refinements || []).find((r) => r.level === 1)
  const r5 = (w.refinements || []).find((r) => r.level === 5) || (w.refinements || []).slice(-1)[0]
  const asc = (w.ascTotal || []).map((m) => `\`${m.name} ×${num(m.count)}\``).join(' ')
  const fields = [
    { name: '📊 Stats', value: `Base ATK (Lv.1): **${num(w.baseAtkValue)}**\n${w.mainStatText || 'Main Stat'}: **${w.baseStatText || '—'}**`, inline: false },
  ]
  if (r1) fields.push({ name: `✨ ${w.effectName || 'Passive'} (R1)`, value: r1.description || '—', inline: false })
  if (r5 && r1 !== r5) fields.push({ name: `✨ ${w.effectName || 'Passive'} (R5)`, value: (r5.description || '—').slice(0, 900), inline: false })
  if (asc) fields.push({ name: '📦 Ascension Totals', value: asc + ` \`${num(w.ascMora || 0)} Mora\``, inline: false })
  return {
    title: `${w.name} ${stars(w.rarity)}`,
    description: `**${w.weaponText || w.weaponType || ''}**\n${w.description || ''}`,
    color: w.rarity >= 5 ? 0xffc24d : w.rarity >= 4 ? 0xc565ff : 0x63b5ff,
    fields,
    footer: 'Genshin Helper',
  }
}

function formatArtifact(a) {
  const pieces = Object.values(a.pieces || {}).map((p) => p.name).filter(Boolean)
  const fields = []
  fields.push({ name: '🔮 2-piece', value: a.effect2Pc || '—', inline: false })
  fields.push({ name: '🔮 4-piece', value: a.effect4Pc || '—', inline: false })
  if (pieces.length) fields.push({ name: '🧩 Pieces', value: pieces.join(' · '), inline: false })
  return {
    title: `${a.name}`,
    description: `${(a.rarityList || []).includes(5) ? '5★' : ((a.rarityList || [])[0] || '') + '★'} artifact set`,
    color: 0xc565ff,
    fields,
    footer: 'Genshin Helper',
  }
}

function formatMats(c) {
  const asc = (c.ascTotal || [])
  const tal = (c.talents && c.talents.total) || []
  const group = (rows) => {
    const map = new Map()
    for (const m of rows) {
      const cat = DATA.materials[m.name] ? DATA.materials[m.name].typeText : 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(`\`${m.name} ×${num(m.count)}\``)
    }
    return [...map.entries()].map(([cat, items]) => `**${cat}:** ${items.join(' ')}`).join('\n') || '—'
  }
  return {
    title: `📦 Materials — ${c.name}`,
    description: `${stars(c.rarity)} ${c.elementText || c.element} · ${c.weaponText || c.weapon}`,
    color: elementColor(c.element) || 0x3a3f45,
    fields: [
      { name: `Ascension (Lv.90) — ${num(c.ascMora || 0)} Mora`, value: group(asc), inline: false },
      { name: `Talents (all → 10) — ${num((c.talents && c.talents.mora) || 0)} Mora`, value: group(tal), inline: false },
    ],
    footer: 'Genshin Helper',
  }
}

function disambiguate(items, label) {
  return {
    title: `Multiple ${label} match`,
    description: items.map((it) => `• ${it.name}`).slice(0, 15).join('\n'),
    color: 0xffb347,
    fields: [],
    footer: 'Try a more specific name',
  }
}

module.exports = {
  load,
  DATA,
  BUILDS,
  getBuilds: () => BUILDS,
  findChar,
  findWeapon,
  findArtifact,
  formatChar,
  formatWeapon,
  formatArtifact,
  formatMats,
  disambiguate,
  stars,
  num,
}