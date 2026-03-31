/**
 * Run this ONCE locally to get your Google Refresh Token:
 *   node scripts/get-refresh-token.mjs
 *
 * Prerequisites: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
 */

import { readFileSync } from 'fs'
import { createServer } from 'http'
import { URL } from 'url'

// Load .env.local manually
try {
  const env = readFileSync('.env.local', 'utf-8')
  for (const line of env.split('\n')) {
    const [key, ...vals] = line.split('=')
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
  }
} catch {}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3333/callback'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first')
  process.exit(1)
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
].join(' ')

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES)}&` +
  `access_type=offline&` +
  `prompt=consent`

console.log('\n🦉 SOVA – Google OAuth Setup\n')
console.log('Otvor tento URL v prehliadači:\n')
console.log(authUrl)
console.log('\n⏳ Čakám na callback...\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333')
  const code = url.searchParams.get('code')
  if (!code) {
    res.end('No code')
    return
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.refresh_token) {
    console.log('✅ Refresh token získaný!\n')
    console.log('Vlož toto do .env.local:\n')
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    res.end('<h2>✅ Hotovo! Skopíruj refresh token z terminálu a zatvor toto okno.</h2>')
  } else {
    console.error('❌ Chyba:', JSON.stringify(tokens, null, 2))
    res.end('<h2>❌ Chyba – pozri terminál</h2>')
  }

  server.close()
})

server.listen(3333)
