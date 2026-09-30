'use strict'

const fs = require('fs')
const path = require('path')
const { SLASH_MANIFEST } = require('./slash')

function env(name) {
  return process.env[name] || ''
}

function readToken() {
  if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN
  const cfgPath = path.join(__dirname, 'config.json')
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
      if (cfg.token) return cfg.token
    } catch (e) {}
  }
  return ''
}

async function main() {
  const token = readToken()
  const appId = env('DISCORD_APP_ID')
  const guildId = env('GUILD_ID')
  if (!token || !appId) {
    console.error('Missing credentials. Set env DISCORD_APP_ID (and DISCORD_TOKEN, or put it in bot/config.json).')
    process.exit(1)
  }

  let url = `https://discord.com/api/v10/applications/${appId}/commands`
  const scope = 'GLOBAL'
  if (guildId) {
    url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(SLASH_MANIFEST),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`Registration failed (HTTP ${res.status}):`, JSON.stringify(data, null, 2).slice(0, 800))
    process.exit(1)
  }

  const names = (Array.isArray(data) ? data : []).map((c) => '/' + c.name)
  console.log(`Registered ${names.length} commands (${scope}${guildId ? ' guild ' + guildId : ''}):`)
  console.log(names.join('  '))
  if (scope === 'GLOBAL') {
    console.log('\nGlobal commands can take up to an hour to appear in Discord.')
    console.log('For instant testing, re-run with GUILD_ID=<your-server-id>.')
  }
}

main()