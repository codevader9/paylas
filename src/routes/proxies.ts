import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!.from('proxies').select('*').order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { label, host, port, username, password, protocol } = req.body
  const { data, error } = await req.supabase!.from('proxies')
    .insert({ label, host, port, username, password, protocol }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { label, host, port, username, password, protocol, is_active } = req.body
  const { data, error } = await req.supabase!.from('proxies')
    .update({ label, host, port, username, password, protocol, is_active }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('proxies').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
