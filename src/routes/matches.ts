import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import { fetchUpcomingMatches, fetchPastMatches, searchTeam, getAllLeagues, getSupportedLeagues } from '../services/theSportsDB.js'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// Public - auth gerektirmez
router.get('/', async (req: Request, res: Response) => {
  let query = supabaseAdmin.from('matches').select('*')
  if (req.query.sport) query = query.eq('sport', req.query.sport as string)
  if (req.query.status) query = query.eq('status', req.query.status as string)
  if (req.query.from) query = query.gte('match_date', req.query.from as string)
  if (req.query.to) query = query.lte('match_date', req.query.to as string)
  if (req.query.league) query = query.ilike('league_name', `%${req.query.league}%`)
  if (req.query.team) {
    const team = req.query.team as string
    query = query.or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
  }
  const { data, error } = await query.order('match_date', { ascending: true }).limit(200)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.get('/leagues', async (_req: Request, res: Response) => { res.json(getSupportedLeagues()) })

router.get('/all-leagues', async (_req: Request, res: Response) => {
  try { res.json(await getAllLeagues()) } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/search-team', async (req: Request, res: Response) => {
  const { q } = req.query
  if (!q) { res.status(400).json({ error: 'q parametresi gerekli' }); return }
  try { res.json(await searchTeam(q as string)) } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Admin only
router.post('/fetch', authMiddleware as any, adminOnly as any, async (_req: AuthRequest, res: Response) => {
  const { sport, date } = _req.body
  try {
    const matches = await fetchUpcomingMatches(sport || 'football', date)
    res.json({ fetched: matches.length, matches })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.post('/fetch-past', authMiddleware as any, adminOnly as any, async (_req: AuthRequest, res: Response) => {
  const { sport } = _req.body
  try {
    const matches = await fetchPastMatches(sport || 'football')
    res.json({ fetched: matches.length, matches })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', authMiddleware as any, adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('matches').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
