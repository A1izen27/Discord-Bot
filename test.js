'use strict'

const { route, HELP } = require('./index')

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log('PASS  ' + name)
  } else {
    fail++
    console.log('FAIL  ' + name)
  }
}

function run(cmd, arg) {
  const r = route[cmd] ? route[cmd](arg) : null
  return r ? r.reply : null
}

function show(reply) {
  const lines = [`[${reply.title}]`]
  for (const f of reply.fields || []) lines.push(`  ${f.name}: ${String(f.value).slice(0, 90)}`)
  if (reply.description) lines.push('  desc: ' + String(reply.description).slice(0, 90))
  return lines.join('\n')
}

// -- char --
let r = run('char', 'amber')
check('char amber found', r.title === 'Amber ★★★★☆')
check('char amber has stats field', (r.fields || []).some((f) => f.name.includes('Max Stats')))
check('char amber build present', (r.fields || []).some((f) => f.name.includes('Suggested Build')))
console.log(show(r))

// -- fuzzy names --
r = run('char', 'hu tao')
check('char hu tao (fuzzy)', r.title.startsWith('Hu Tao'))
r = run('char', 'hutao')
check('char hutao (slug)', r.title.startsWith('Hu Tao'))
r = run('char', 'kazuha')
check('char kazuha name', r.title.startsWith('Kaedehara Kazuha'))

// -- mats --
r = run('mats', 'furina')
check('mats furina', r.title.includes('Furina') && (r.fields || []).some((f) => f.name.includes('Ascension')))
console.log(show(r))

// -- weapon --
r = run('weapon', 'polar star')
check('weapon polar star', r.title.startsWith('Polar Star'))
check('weapon has R1 passive', (r.fields || []).some((f) => f.name.includes('R1')))
check('weapon has R5 passive', (r.fields || []).some((f) => f.name.includes('R5')))
console.log(show(r))
r = run('weapon', 'thrilling')
check('weapon thrilling fuzzy', r.title.startsWith('Thrilling Tales'))

// -- artifact --
r = run('artifact', 'noblesse')
check('artifact noblesse', r.title === 'Noblesse Oblige')
check('artifact has 2pc', (r.fields || []).some((f) => f.name.includes('2-piece')))
console.log(show(r))

// -- build --
r = run('build', 'raiden')
check('build raiden exists', r.title.startsWith('Raiden Shogun') && (r.fields || []).some((f) => f.name.includes('Suggested Build')))
console.log(show(r))
r = run('build', 'kaveh')
check('build kaveh has build', r.title.startsWith('Kaveh') && (r.fields || []).some((f) => f.name.includes('Suggested Build')))
r = run('build', 'xinyan')
check('build xinyan generated (no guide)', r.title.startsWith('Xinyan') && (r.fields || []).some((f) => f.name.includes('Suggested Build')))
r = run('build', 'manekin')
check('build manekin generated', r.title.startsWith('Manekin') && (r.fields || []).some((f) => f.name.includes('Suggested Build')))

// -- not found + disambiguation --
r = run('char', 'zzznope')
check('char not found', r.title === 'Not found')
r = run('weapon', 'sword')
check('weapon ambiguous lists', r.title.startsWith('Multiple'))
r = run('char', 'shogun')
check('char raiden via title search', r.title.startsWith('Raiden Shogun') || r.title.startsWith('Multiple'))

// -- slash commands --
const { handleSlash, SLASH_MANIFEST, toEmbeds, SITE_URL } = require('./slash')

const botEmbeds = handleSlash({ data: { name: 'bot' } })
check('/bot returns an embed', Array.isArray(botEmbeds) && botEmbeds[0].title.includes('Teraphane'))
check('/bot lists commands', botEmbeds[0].fields && botEmbeds[0].fields.some((f) => f.name.includes('Commands')))
check('/bot links website', botEmbeds[0].fields && botEmbeds[0].fields.some((f) => f.value.includes(SITE_URL)))

check('manifest has 7 commands', SLASH_MANIFEST.length === 7)
check('manifest includes /bot', SLASH_MANIFEST.some((c) => c.name === 'bot'))
check('manifest names are valid', SLASH_MANIFEST.every((c) => /^[a-z-]{1,32}$/.test(c.name)))

const charEmbeds = handleSlash({ data: { name: 'char', options: [{ name: 'name', value: 'kazuha' }] } })
check('/char kazuha embed', charEmbeds[0].title.startsWith('Kaedehara Kazuha'))

const helpEmbeds = handleSlash({ data: { name: 'help' } })
check('/help lists slash commands', helpEmbeds[0].fields && helpEmbeds[0].fields.some((f) => f.name.startsWith('/char')))

const big = { title: 'X', description: 'y', color: 0x111111, fields: [{ name: 'f', value: 'a'.repeat(2500), inline: false }], footer: 'z' }
const chunked = toEmbeds(big)
check('long field split into multiple fields', chunked[0].fields.length >= 3)
check('chunked fields stay <=1024', chunked.every((e) => e.fields.every((f) => f.value.length <= 1024)))

const bare = toEmbeds({ color: 0x111111, description: 'hi', fields: [] })
check('bare reply still produces an embed', bare.length === 1 && bare[0].description === 'hi')

console.log('\n---')
console.log(`${pass}/${pass + fail} checks passed`)
process.exit(fail ? 1 : 0)