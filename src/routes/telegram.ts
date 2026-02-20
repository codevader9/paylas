import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)

router.get('/menus', async (req: AuthRequest, res: Response) => {
  let query = req.supabase!.from('telegram_menus').select('*, sites(name), social_accounts(account_name)')
  if (req.query.site_id) query = query.eq('site_id', req.query.site_id as string)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.post('/menus', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { site_id, social_account_id, menu_name, menu_json } = req.body
  const { data, error } = await req.supabase!.from('telegram_menus')
    .insert({ site_id, social_account_id, menu_name, menu_json }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/menus/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { menu_name, menu_json, is_active } = req.body
  const { data, error } = await req.supabase!.from('telegram_menus')
    .update({ menu_name, menu_json, is_active }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/menus/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('telegram_menus').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

router.post('/test', adminOnly as any, async (_req: AuthRequest, res: Response) => {
  const { bot_token, chat_id } = _req.body
  try {
    const { sendTelegramMessage } = await import('../services/telegram.js')
    const result = await sendTelegramMessage(bot_token, chat_id, 'Test mesajı - Paylaşım Paneli bağlantısı başarılı!')
    res.json({ success: true, result })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
