import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/configs', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('retweet_configs').select('*, sites(name)')
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  const { data, error } = await query
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/configs', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { site_id, is_active, min_delay_seconds, max_delay_seconds, auto_rt_own_tweets } = req.body
  const { data, error } = await req.supabase!.from('retweet_configs')
    .insert({ site_id, is_active, min_delay_seconds, max_delay_seconds, auto_rt_own_tweets }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/configs/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { is_active, min_delay_seconds, max_delay_seconds, auto_rt_own_tweets } = req.body
  const { data, error } = await req.supabase!.from('retweet_configs')
    .update({ is_active, min_delay_seconds, max_delay_seconds, auto_rt_own_tweets }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.get('/accounts', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('retweet_accounts').select('*, sites(name), proxies(label, host)')
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/accounts', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { site_id, account_name, credentials, proxy_id, delay_seconds } = req.body
  const { data, error } = await req.supabase!.from('retweet_accounts')
    .insert({ site_id, account_name, credentials, proxy_id, delay_seconds }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/accounts/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { account_name, credentials, proxy_id, is_active, delay_seconds } = req.body
  const { data, error } = await req.supabase!.from('retweet_accounts')
    .update({ account_name, credentials, proxy_id, is_active, delay_seconds }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/accounts/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('retweet_accounts').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
