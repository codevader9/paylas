import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/tweet', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('tweet_templates').select('*, sites(name)')
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  if (req.query.sport) query = query.eq('sport', req.query.sport as string)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/tweet', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { site_id, name, template, sport, is_default, variables } = req.body
  const { data, error } = await req.supabase!.from('tweet_templates')
    .insert({ site_id, name, template, sport, is_default, variables }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/tweet/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { name, template, sport, is_default, variables } = req.body
  const { data, error } = await req.supabase!.from('tweet_templates')
    .update({ name, template, sport, is_default, variables }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/tweet/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('tweet_templates').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

router.get('/image', async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!.from('image_templates').select('*').order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/image', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { name, sport, width, height, bg_color, bg_image_url, layout, is_default } = req.body
  const { data, error } = await req.supabase!.from('image_templates')
    .insert({ name, sport, width, height, bg_color, bg_image_url, layout, is_default }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/image/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!.from('image_templates')
    .update(req.body).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/image/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('image_templates').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
