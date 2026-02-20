import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('social_accounts').select('*, sites(name), proxies(label, host)')
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  if (req.query.platform) query = query.eq('platform', req.query.platform as string)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { site_id, platform, account_name, credentials, proxy_id, settings } = req.body
  const { data, error } = await req.supabase!.from('social_accounts')
    .insert({ site_id, platform, account_name, credentials, proxy_id, settings }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { account_name, credentials, proxy_id, is_active, settings } = req.body
  const { data, error } = await req.supabase!.from('social_accounts')
    .update({ account_name, credentials, proxy_id, is_active, settings }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('social_accounts').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
