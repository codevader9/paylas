import fs from 'fs'
import path from 'path'
import os from 'os'
import { createRequire } from 'module'
import { createCanvas, loadImage, registerFont } from 'canvas'
import axios from 'axios'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)

const ASSETS_DIR = path.join(process.cwd(), 'assets')
const PLACEHOLDERS_DIR = path.join(ASSETS_DIR, 'placeholders')
const SITE_LOGOS_DIR = path.join(ASSETS_DIR, 'site-logos')
const TEMP_DIR = path.join(os.tmpdir(), 'paylasim-temp')

for (const dir of [ASSETS_DIR, PLACEHOLDERS_DIR, SITE_LOGOS_DIR, TEMP_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Font - dejavu-fonts-ttf paketinden (Windows/Linux/Railway)
let TEXT_FONT_FAMILY = 'sans-serif'
const fontPaths: string[] = []
try {
  fontPaths.push(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'))
  fontPaths.push(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'))
} catch {}
fontPaths.push(
  path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans-Bold.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
)
for (const fp of fontPaths) {
  if (fs.existsSync(fp)) {
    try {
      registerFont(fp, { family: 'MatchFont', weight: 'bold' })
      TEXT_FONT_FAMILY = 'MatchFont'
      console.log('[Canvas] Font yüklendi:', fp)
      break
    } catch (e) {
      console.warn('[Canvas] Font yüklenemedi:', fp, (e as Error).message)
    }
  }
}

const LOGO_RENDER_SIZE = 512

interface MatchImageOptions {
  homeTeam: string
  awayTeam: string
  homeLogo?: string | null
  awayLogo?: string | null
  leagueName: string
  leagueLogo?: string | null
  matchDate: string
  venue?: string | null
  sport: string
  placeholderPath?: string
  siteLogoPath?: string | null
  savePath?: string | null
}

function isPlaceholderLogoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true
  const u = url.toLowerCase()
  return u.includes('placeholder') || u.includes('default') || (u.includes('soon') && u.includes('logo'))
}

async function isPlaceholderImage(buffer: Buffer): Promise<boolean> {
  try {
    const stats = await sharp(buffer).stats()
    const channels = stats.channels || []
    if (!channels.length) return false
    const avgMean = channels.reduce((s, c) => s + (c.mean || 0), 0) / channels.length
    const avgStdev = channels.reduce((s, c) => s + (c.stdev || 0), 0) / channels.length
    if (avgStdev < 15) return true
    if (avgMean > 230 && avgStdev < 55) return true
    return false
  } catch { return false }
}

async function downloadLogo(url: string, filepath: string): Promise<string | null> {
  try {
    if (isPlaceholderLogoUrl(url)) return null
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { accept: 'image/*', 'User-Agent': 'Mozilla/5.0 (compatible; PaylasimBot/1.0)' },
      timeout: 10000, maxRedirects: 3,
    })
    const buffer = Buffer.from(response.data)
    if (buffer.length < 100) return null
    if (await isPlaceholderImage(buffer)) return null
    const meta = await sharp(buffer).metadata()
    if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) return null
    await sharp(buffer)
      .resize(LOGO_RENDER_SIZE, LOGO_RENDER_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toFile(filepath)
    return filepath
  } catch (err: any) {
    console.warn(`[Canvas] Logo indirilemedi ${url}:`, err.message)
    return null
  }
}

async function createFallbackLogo(teamName: string, filepath: string): Promise<string> {
  const size = LOGO_RENDER_SIZE
  const initial = (teamName || '?').charAt(0).toUpperCase()
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 8}" fill="#1a1a2e" stroke="#ffffff33" stroke-width="6"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial Black, Arial" font-size="200" font-weight="bold">${initial}</text>
    </svg>`
  await sharp(Buffer.from(svg)).png().toFile(filepath)
  return filepath
}

async function getDefaultPlaceholder(sport: string): Promise<string> {
  const exts = ['png', 'jpg', 'jpeg', 'jfif', 'webp']

  // Spor bazlı (football.png, football.jfif, etc)
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `${sport}.${ext}`)
    if (fs.existsSync(p)) { console.log('[Canvas] Found sport placeholder:', p); return p }
  }
  // background.* (genel stadyum)
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `background.${ext}`)
    if (fs.existsSync(p)) { console.log('[Canvas] Found background placeholder:', p); return p }
  }
  // default.*
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `default.${ext}`)
    if (fs.existsSync(p)) { console.log('[Canvas] Found default placeholder:', p); return p }
  }

  // Hiçbiri yoksa oluştur
  const defaultFile = path.join(PLACEHOLDERS_DIR, 'default.png')
  console.log('[Canvas] No placeholder found, creating:', defaultFile)

  // Stadyum hissi veren koyu yeşil/siyah gradient arka plan
  const width = 1200
  const height = 675
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="spotlight1" cx="30%" cy="15%" r="50%">
        <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.08"/>
        <stop offset="100%" style="stop-color:#000000;stop-opacity:0"/>
      </radialGradient>
      <radialGradient id="spotlight2" cx="70%" cy="15%" r="50%">
        <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.08"/>
        <stop offset="100%" style="stop-color:#000000;stop-opacity:0"/>
      </radialGradient>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#0a1628"/>
        <stop offset="40%" style="stop-color:#0d2137"/>
        <stop offset="100%" style="stop-color:#060e1a"/>
      </linearGradient>
      <linearGradient id="field" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#1a5c2e;stop-opacity:0.3"/>
        <stop offset="100%" style="stop-color:#0a2e15;stop-opacity:0.15"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect y="${height * 0.55}" width="${width}" height="${height * 0.45}" fill="url(#field)"/>
    <rect width="${width}" height="${height}" fill="url(#spotlight1)"/>
    <rect width="${width}" height="${height}" fill="url(#spotlight2)"/>
    <line x1="0" y1="${height * 0.55}" x2="${width}" y2="${height * 0.55}" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>
    <circle cx="${width / 2}" cy="${height * 0.55}" r="60" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
  </svg>`

  console.log('[Canvas] Creating stadium placeholder:', defaultFile)
  await sharp(Buffer.from(svg)).png().toFile(defaultFile)
  return defaultFile
}

async function loadImageSafe(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 })
    return Buffer.from(response.data)
  } catch { return null }
}

export async function generateMatchImage(options: MatchImageOptions): Promise<Buffer> {
  const {
    homeLogo, awayLogo,
    venue, sport,
    siteLogoPath = null, savePath = null,
  } = options

  // Null-safe string - "null", "undefined" literal string'leri de fallback'e çevir
  const safe = (val: any, fallback: string): string => {
    if (val == null) return fallback
    const s = String(val).trim()
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return fallback
    return s
  }
  const homeTeam = safe(options.homeTeam, 'Ev Sahibi')
  const awayTeam = safe(options.awayTeam, 'Deplasman')
  const leagueName = safe(options.leagueName, 'Lig')
  const matchDate = safe(options.matchDate, new Date().toISOString())
  console.log('[Canvas] Metinler:', { homeTeam, awayTeam, leagueName, matchDate: matchDate.slice(0, 20) })

  let placeholderPath = options.placeholderPath
  if (placeholderPath && !fs.existsSync(placeholderPath)) placeholderPath = undefined
  if (!placeholderPath) placeholderPath = await getDefaultPlaceholder(sport)

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const team1LogoPath = path.join(TEMP_DIR, `team1-${uid}.png`)
  const team2LogoPath = path.join(TEMP_DIR, `team2-${uid}.png`)

  try {
    const t1 = homeLogo ? await downloadLogo(homeLogo, team1LogoPath) : null
    const t2 = awayLogo ? await downloadLogo(awayLogo, team2LogoPath) : null
    if (!t1) await createFallbackLogo(homeTeam, team1LogoPath)
    if (!t2) await createFallbackLogo(awayTeam, team2LogoPath)

    // Dosyayı buffer olarak oku, JFIF/JPG ise sharp ile PNG'ye çevir + 1200x675 resize
    const rawBuffer = fs.readFileSync(placeholderPath)
    let placeholderBuffer: Buffer
    if (placeholderPath.match(/\.(jfif|jpg|jpeg|webp)$/i)) {
      placeholderBuffer = await sharp(rawBuffer).resize(1200, 675, { fit: 'cover' }).png().toBuffer()
    } else {
      placeholderBuffer = rawBuffer
    }
    console.log('[Canvas] Placeholder loaded:', placeholderPath, 'size:', placeholderBuffer.length)
    const placeholder = await loadImage(placeholderBuffer)
    const team1Logo = await loadImage(fs.readFileSync(team1LogoPath))
    const team2Logo = await loadImage(fs.readFileSync(team2LogoPath))

    let siteLogo: any = null
    if (siteLogoPath && fs.existsSync(siteLogoPath)) {
      siteLogo = await loadImage(fs.readFileSync(siteLogoPath))
    }

    const W = placeholder.width
    const H = placeholder.height
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // === ARKA PLAN ===
    ctx.drawImage(placeholder, 0, 0)

    // Üst gradient overlay (koyu -> şeffaf)
    const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.35)
    topGrad.addColorStop(0, 'rgba(0,0,0,0.6)')
    topGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = topGrad
    ctx.fillRect(0, 0, W, H * 0.35)

    // Alt gradient overlay (koyu band - lig adı ve tarih için)
    const bottomGrad = ctx.createLinearGradient(0, H * 0.68, 0, H)
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)')
    bottomGrad.addColorStop(0.3, 'rgba(0,0,0,0.7)')
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = bottomGrad
    ctx.fillRect(0, H * 0.68, W, H * 0.32)

    // === SİTE LOGOSU (üst orta, %40 büyütülmüş) ===
    if (siteLogo) {
      const maxH = Math.floor(H * 0.14)
      const maxW = Math.floor(W * 0.50)
      const ratio = Math.min(maxW / siteLogo.width, maxH / siteLogo.height)
      const sW = Math.floor(siteLogo.width * ratio)
      const sH = Math.floor(siteLogo.height * ratio)
      ctx.drawImage(siteLogo, (W - sW) / 2, Math.floor(H * 0.04), sW, sH)
    }

    // === TAKIM LOGOLARI ===
    const logoSize = Math.floor(H * 0.32)
    const logoY = Math.floor(H * 0.22)
    const leftX = Math.floor(W * 0.14)
    const rightX = Math.floor(W * 0.86 - logoSize)

    // Logo glow efekti
    ctx.shadowColor = 'rgba(255,255,255,0.15)'
    ctx.shadowBlur = 30
    ctx.drawImage(team1Logo, leftX, logoY, logoSize, logoSize)
    ctx.drawImage(team2Logo, rightX, logoY, logoSize, logoSize)
    ctx.shadowBlur = 0

    // === VS YAZISI (ortada) ===
    const vsY = logoY + logoSize / 2 + 5
    ctx.font = `bold 52px ${TEXT_FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // VS arka plan daire
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.arc(W / 2, vsY, 38, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.fillText('VS', W / 2, vsY)

    // === TAKIM İSİMLERİ ===
    const nameY = logoY + logoSize + 20
    const teamFontSize = Math.min(28, Math.floor(W * 0.024))
    ctx.font = `bold ${teamFontSize}px ${TEXT_FONT_FAMILY}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Text shadow
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2

    ctx.fillText(homeTeam.toUpperCase(), leftX + logoSize / 2, nameY)
    ctx.fillText(awayTeam.toUpperCase(), rightX + logoSize / 2, nameY)

    // === ALT BANT - ince çizgi ===
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    const lineY = H * 0.73
    const accentGrad = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0)
    accentGrad.addColorStop(0, 'rgba(97,114,243,0)')
    accentGrad.addColorStop(0.3, 'rgba(97,114,243,0.8)')
    accentGrad.addColorStop(0.7, 'rgba(97,114,243,0.8)')
    accentGrad.addColorStop(1, 'rgba(97,114,243,0)')
    ctx.strokeStyle = accentGrad
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(W * 0.15, lineY)
    ctx.lineTo(W * 0.85, lineY)
    ctx.stroke()

    // === LİG ADI ===
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.font = `bold 46px ${TEXT_FONT_FAMILY}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(leagueName.toUpperCase(), W / 2, H * 0.80)

    // === TARİH / SAAT ===
    let dateStr = '--/--/----'
    let timeStr = '--:--'
    try {
      const startAt = new Date(matchDate)
      if (!isNaN(startAt.getTime())) {
        dateStr = new Intl.DateTimeFormat('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        }).format(startAt)
        timeStr = new Intl.DateTimeFormat('tr-TR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul',
        }).format(startAt)
      }
    } catch {}

    ctx.font = `bold 30px ${TEXT_FONT_FAMILY}`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(`${dateStr}  •  ${timeStr}`, W / 2, H * 0.88)

    // === MEKAN (opsiyonel) ===
    const venueStr = (venue != null && typeof venue === 'string' && venue.trim()) ? String(venue).trim() : ''
    if (venueStr) {
      ctx.font = `16px ${TEXT_FONT_FAMILY}`
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(venueStr, W / 2, H * 0.94)
    }

    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // PNG -> JPEG sıkıştırma (Twitter max ~900KB)
    const pngBuffer = canvas.toBuffer('image/png')
    const buffer = await sharp(pngBuffer).jpeg({ quality: 85 }).toBuffer()
    console.log('[Canvas] Görsel boyutu: PNG', pngBuffer.length, '-> JPEG', buffer.length, 'bytes')

    if (savePath) {
      const saveDir = path.dirname(savePath)
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true })
      fs.writeFileSync(savePath, buffer)
    }

    try {
      if (fs.existsSync(team1LogoPath)) fs.unlinkSync(team1LogoPath)
      if (fs.existsSync(team2LogoPath)) fs.unlinkSync(team2LogoPath)
    } catch {}

    return buffer
  } catch (error) {
    try {
      if (fs.existsSync(team1LogoPath)) fs.unlinkSync(team1LogoPath)
      if (fs.existsSync(team2LogoPath)) fs.unlinkSync(team2LogoPath)
    } catch {}
    throw error
  }
}

export async function ensureDefaultPlaceholder(sport: string): Promise<string> {
  return getDefaultPlaceholder(sport)
}

export function getPlaceholderPath(sport: string, siteId?: string): string {
  const exts = ['png', 'jpg', 'jpeg', 'jfif', 'webp']

  // Site özel
  if (siteId) {
    for (const ext of exts) {
      const p = path.join(PLACEHOLDERS_DIR, `${siteId}.${ext}`)
      if (fs.existsSync(p)) return p
    }
  }
  // Spor bazlı
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `${sport}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  // background.* (genel)
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `background.${ext}`)
    if (fs.existsSync(p)) return p
  }
  // default.*
  for (const ext of exts) {
    const p = path.join(PLACEHOLDERS_DIR, `default.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return path.join(PLACEHOLDERS_DIR, 'default.png')
}

export async function getSiteLogoPath(siteId: string): Promise<string | null> {
  // Lokal cache kontrol
  const localPath = path.join(SITE_LOGOS_DIR, `${siteId}.png`)
  if (fs.existsSync(localPath)) return localPath

  // Supabase Storage'dan indir ve cache'le
  try {
    const { supabaseAdmin } = await import('../config/supabase.js')
    const { data } = await supabaseAdmin.storage.from('site-logos').download(`${siteId}.png`)
    if (data) {
      const buffer = Buffer.from(await data.arrayBuffer())
      if (!fs.existsSync(SITE_LOGOS_DIR)) fs.mkdirSync(SITE_LOGOS_DIR, { recursive: true })
      fs.writeFileSync(localPath, buffer)
      console.log('[Canvas] Logo cached from storage:', siteId)
      return localPath
    }
  } catch {}
  return null
}
