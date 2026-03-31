# SOVA – Soňa 🦉
Tvoja osobná AI asistentka na úrovni CEO.

---

## Setup krok za krokom

### 1. Nainštaluj závislosti
```bash
cd sova-app
npm install
```

### 2. Skopíruj env súbor
```bash
cp .env.example .env.local
```

---

### 3. Anthropic API Key
1. Choď na https://console.anthropic.com
2. API Keys → Create Key
3. Vlož do `ANTHROPIC_API_KEY`

---

### 4. Google OAuth + Calendar + Gmail

**A. Vytvor Google Cloud Project:**
1. https://console.cloud.google.com → New Project
2. Enable APIs: **Google Calendar API** + **Gmail API**
3. Credentials → OAuth 2.0 Client ID → Web application
4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` + `https://sova-app.vercel.app/api/auth/callback/google`
5. Skopíruj `Client ID` → `GOOGLE_CLIENT_ID`
6. Skopíruj `Client Secret` → `GOOGLE_CLIENT_SECRET`

**B. Získaj Refresh Token (raz, lokálne):**
```bash
# Nainštaluj google-auth-library globálne alebo lokálne
npx ts-node scripts/get-refresh-token.ts
```
Alebo použij OAuth Playground: https://developers.google.com/oauthplayground
- Scope: `https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly`
- Exchange authorization code for tokens → skopíruj `refresh_token` → `GOOGLE_REFRESH_TOKEN`

---

### 5. Discord Bot

1. https://discord.com/developers/applications → New Application
2. Bot → Add Bot → Reset Token → skopíruj → `DISCORD_BOT_TOKEN`
3. OAuth2 → URL Generator → Scopes: `bot` → Permissions: `Send Messages`, `Read Messages/View Channels`
4. Skopíruj URL → otvor v prehliadači → pridaj bota na tvoj server
5. V Discorde: pravý klik na kanál → Copy Channel ID → `DISCORD_CHANNEL_ID`
6. (Povoľ Developer Mode: User Settings → Advanced → Developer Mode)

---

### 6. Vercel KV (Redis)

1. https://vercel.com → tvoj projekt → Storage → Create KV Database
2. Skopíruj `KV_REST_API_URL` a `DISCORD_BOT_TOKEN` z Vercel dashboardu

---

### 7. NextAuth Secret
```bash
openssl rand -base64 32
```
Vlož do `NEXTAUTH_SECRET`

---

### 8. CRON_SECRET
```bash
openssl rand -base64 32
```
Vlož do `CRON_SECRET` – toto chráni cron endpointy

---

### 9. Lokálny dev
```bash
npm run dev
```
Otvor http://localhost:3000

---

### 10. Deploy na Vercel
```bash
npm install -g vercel
vercel
```
Nastav všetky ENV variables v Vercel Dashboard → Settings → Environment Variables.

**Dôležité:** V `vercel.json` sú cron joby. Vercel ich automaticky spustí podľa schedule. Pre lokálne testovanie cron endpointov:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/morning
```

---

## Cron schedule (časy v UTC → SK čas = UTC+1/+2)

| Endpoint | Schedule | SK čas |
|----------|----------|--------|
| morning | `*/15 6-11 * * *` | 8:00-13:00 (kontroluje tvoj nastavený čas) |
| evening | `*/15 18-22 * * *` | 20:00-00:00 (kontroluje tvoj nastavený čas) |
| midday | `0 12 * * *` | 14:00 |
| gmail-check | `*/30 7-19 * * 1-5` | každých 30 min počas prac. dní |
| pre-task-reminder | `*/15 18-22 * * *` | hodinu pred večerným zhrnutím |
| weekly-meeting | `*/15 6-11 * * 1` | pondelok ráno |

> Časy si nastavíš v Settings UI – Soňa ich automaticky zohľadní.

---

## Soňa vie...
- Sledovať emaily od vybraných kontaktov
- Čítať a vytvárať Google Calendar udalosti
- Posielať Discord správy (ranné/večerné/týždenné brífing)
- Generovať LinkedIn posty a články v slovenčine
- Robiť research trendov pre LinkedIn obsah
- Spravovať úlohy a oslavovať ich splnenie
- Pripomínať prípravu na zajtrajšie udalosti
