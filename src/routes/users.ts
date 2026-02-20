import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)
router.use(adminOnly as any)

// List all users
router.get('/', async (_req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// Create user
router.post('/', async (req: AuthRequest, res: Response) => {
  const { email, password, full_name, role } = req.body
  if (!email || !password) { res.status(400).json({ error: 'Email ve şifre gerekli' }); return }

  const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: { data: { full_name: full_name || '' } },
  })

  if (authError) { res.status(500).json({ error: authError.message }); return }

  if (authData.user) {
    await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      email,
      full_name: full_name || '',
      role: role || 'user',
    })
  }

  res.status(201).json({ success: true, user: authData.user })
})

// Update user role
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
  const { role } = req.body
  if (!role || !['admin', 'user'].includes(role)) { res.status(400).json({ error: 'Geçersiz rol' }); return }

  const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

// Delete user (profile'dan sil, auth cascade ile gider)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) { res.status(400).json({ error: 'Kendinizi silemezsiniz' }); return }

  const { error } = await req.supabase!.from('profiles').delete().eq('id', req.params.id as string)
  if (error) { res.status(500).json({ error: error.message }); return }

  res.json({ success: true })
})

export default router
