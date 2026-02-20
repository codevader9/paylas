import { Router } from 'express'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { generateMatchImage, getPlaceholderPath, getSiteLogoPath } from '../services/canvas.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.post('/generate', async (req: AuthRequest, res: Response) => {
  const { match_id, site_id } = req.body
  const { data: match } = await req.supabase!.from('matches').select('*').eq('id', match_id).single()
  if (!match) { res.status(404).json({ error: 'Maç bulunamadı' }); return }
  try {
    const buffer = await generateMatchImage({
      homeTeam: match.home_team, awayTeam: match.away_team,
      homeLogo: match.home_logo, awayLogo: match.away_logo,
      leagueName: match.league_name, leagueLogo: match.league_logo,
      matchDate: match.match_date, venue: match.venue, sport: match.sport,
      placeholderPath: getPlaceholderPath(match.sport, site_id),
      siteLogoPath: await getSiteLogoPath(site_id),
    })
    res.set('Content-Type', 'image/png')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/preview', async (req: AuthRequest, res: Response) => {
  const { home_team, away_team, home_logo, away_logo, league_name, match_date, venue, sport, site_id } = req.body
  try {
    const buffer = await generateMatchImage({
      homeTeam: home_team || 'Ev Sahibi', awayTeam: away_team || 'Deplasman',
      homeLogo: home_logo, awayLogo: away_logo,
      leagueName: league_name || 'Lig', matchDate: match_date || new Date().toISOString(),
      venue, sport: sport || 'football',
      placeholderPath: getPlaceholderPath(sport || 'football', site_id),
      siteLogoPath: await getSiteLogoPath(site_id),
    })
    res.set('Content-Type', 'image/png')
    res.send(buffer)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
