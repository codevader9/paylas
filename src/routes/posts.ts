import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import { publishPost } from '../services/publisher.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/scheduled', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('scheduled_posts')
    .select('*, matches(home_team, away_team, league_name, match_date, sport), sites(name)')
  if (req.query.status) query = query.eq('status', req.query.status as string)
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  const { data, error } = await query.order('scheduled_at', { ascending: true })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/schedule', async (req: AuthRequest, res: Response) => {
  const { match_id, site_id, platform, social_account_id, caption, image_url, scheduled_at, minutes_before } = req.body
  const { data, error } = await req.supabase!.from('scheduled_posts')
    .insert({ match_id, site_id, platform, social_account_id, caption, image_url, scheduled_at, minutes_before, created_by: req.userId })
    .select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.post('/publish-now', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { platform, social_account_id, site_id, caption, image_url, match_id } = req.body
  try {
    const result = await publishPost({ platform, social_account_id, site_id, caption, image_url, match_id }, req.supabase!)
    res.json(result)
  } catch (err: any) {
    console.log('[Publish Route] HATA:', err.message)
    if (err.response?.data) console.log('[Publish Route] API Response:', JSON.stringify(err.response.data).slice(0, 500))
    res.status(500).json({ error: err.message })
  }
})

router.put('/scheduled/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { caption, image_url, scheduled_at, status } = req.body
  const { data, error } = await req.supabase!.from('scheduled_posts')
    .update({ caption, image_url, scheduled_at, status }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/scheduled/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('scheduled_posts').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

router.get('/history', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('post_history').select('*, matches(home_team, away_team, sport)')
  if (req.query.status) query = query.eq('status', req.query.status as string)
  if (req.query.platform) query = query.eq('platform', req.query.platform as string)
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  const { data, error } = await query.order('posted_at', { ascending: false }).limit(200)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

export default router
