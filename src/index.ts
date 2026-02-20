import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { startScheduler } from './services/scheduler.js'

import sitesRouter from './routes/sites.js'
import socialAccountsRouter from './routes/socialAccounts.js'
import matchesRouter from './routes/matches.js'
import postsRouter from './routes/posts.js'
import templatesRouter from './routes/templates.js'
import retweetsRouter from './routes/retweets.js'
import telegramRouter from './routes/telegram.js'
import imagesRouter from './routes/images.js'
import proxiesRouter from './routes/proxies.js'
import statsRouter from './routes/stats.js'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))

// Routes
app.use('/api/sites', sitesRouter)
app.use('/api/social-accounts', socialAccountsRouter)
app.use('/api/matches', matchesRouter)
app.use('/api/posts', postsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/retweets', retweetsRouter)
app.use('/api/telegram', telegramRouter)
app.use('/api/images', imagesRouter)
app.use('/api/proxies', proxiesRouter)
app.use('/api/stats', statsRouter)

// Public logo serve (auth gerektirmez, img tag'ları için)
import fs from 'fs'
import path from 'path'

app.get('/api/public/site-logo/:id', (req, res) => {
  const siteLogosDir = path.join(process.cwd(), 'assets', 'site-logos')
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(siteLogosDir, `${req.params.id}.${ext}`)
    if (fs.existsSync(p)) {
      res.set('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg')
      res.set('Cache-Control', 'no-cache')
      res.send(fs.readFileSync(p))
      return
    }
  }
  res.status(404).send('')
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Quick test endpoints (auth gerektirmez, sadece development)
app.post('/api/test/telegram', async (req, res) => {
  try {
    const { sendTelegramMessage } = await import('./services/telegram.js')
    const { bot_token, chat_id, message } = req.body
    const result = await sendTelegramMessage(bot_token, chat_id, message || 'Test mesajı - Paylaşım Paneli çalışıyor!')
    res.json({ success: true, result })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/test/fetch-matches', async (req, res) => {
  try {
    const { fetchUpcomingMatches } = await import('./services/theSportsDB.js')
    const { sport } = req.body
    const matches = await fetchUpcomingMatches(sport || 'football')
    res.json({ success: true, count: matches.length, sample: matches.slice(0, 3) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/test/publish-match', async (req, res) => {
  try {
    const { bot_token, chat_id, match_id, site_id } = req.body
    const { supabaseAnon } = await import('./config/supabase.js')
    const { generateMatchImage } = await import('./services/canvas.js')
    const { sendTelegramPhotoFile } = await import('./services/telegram.js')

    const { data: match } = await supabaseAnon.from('matches').select('*').eq('id', match_id).single()
    if (!match) { res.status(404).json({ error: 'Maç bulunamadı' }); return }

    console.log('[Test Publish] Görsel oluşturuluyor:', match.home_team, 'vs', match.away_team)

    const { getPlaceholderPath, getSiteLogoPath } = await import('./services/canvas.js')
    const placeholderPath = getPlaceholderPath(match.sport, site_id)
    const siteLogoPath = site_id ? getSiteLogoPath(site_id) : null
    console.log('[Test Publish] Site logo:', siteLogoPath || 'YOK')

    const buffer = await generateMatchImage({
      homeTeam: match.home_team, awayTeam: match.away_team,
      homeLogo: match.home_logo, awayLogo: match.away_logo,
      leagueName: match.league_name, matchDate: match.match_date,
      venue: match.venue, sport: match.sport,
      placeholderPath, siteLogoPath,
    })

    console.log('[Test Publish] Görsel oluşturuldu, boyut:', buffer.length, 'bytes')

    const caption = `⚽ <b>${match.home_team}</b> vs <b>${match.away_team}</b>\n🏆 ${match.league_name}\n📅 ${new Date(match.match_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}`
    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '📺 Canlı Maç İzle', url: 'https://siteadi.com/canli' }],
        [{ text: '🎁 250 TL Bonus Al', url: 'https://siteadi.com/bonus' }],
      ]
    }
    const result = await sendTelegramPhotoFile(bot_token, chat_id, buffer, 'match.jpg', caption, 'HTML', inlineKeyboard)
    res.json({ success: true, result })
  } catch (err: any) {
    console.log('[Test Publish] ERROR:', err.message)
    console.log('[Test Publish] STACK:', err.stack)
    console.log('[Test Publish] CODE:', err.code)
    res.status(500).json({ error: err.message, code: err.code, stack: err.stack?.split('\n').slice(0, 5) })
  }
})

app.post('/api/test/twitter-login', async (req, res) => {
  try {
    const { loginTwitter } = await import('./services/twitter.js')
    const result = await loginTwitter(req.body)
    res.json({ success: true, result })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(env.port, () => {
  console.log(`[Server] http://localhost:${env.port} adresinde çalışıyor`)
  startScheduler()
})
