import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'

const router = Router()
router.use(authMiddleware as any)
router.use(adminOnly as any)

// List all users
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await req.supabase!.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json(data)
  } catch (err: any) {
    console.log('[Users] List error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Create user
router.post('/', async (req: AuthRequest, res: Response) => {
  const { email, password, full_name, role } = req.body
  if (!email || !password) { res.status(400).json({ error: 'Email ve şifre gerekli' }); return }

  try {
    console.log('[Users] Creating:', email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: { data: { full_name: full_name || '' } },
    })

    if (authError) {
      console.log('[Users] Auth error:', authError.message)
      res.status(500).json({ error: authError.message }); return
    }

    console.log('[Users] Auth OK, user:', authData.user?.id)

    if (authData.user) {
      const { error: profileErr } = await req.supabase!.from('profiles').upsert({
        id: authData.user.id,
        email,
        full_name: full_name || '',
        role: role || 'user',
      })
      if (profileErr) console.log('[Users] Profile upsert error:', profileErr.message)
    }

    res.status(201).json({ success: true, user: authData.user })
  } catch (err: any) {
    console.log('[Users] Create error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Update user role
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
  const { role } = req.body
  if (!role || !['admin', 'user'].includes(role)) { res.status(400).json({ error: 'Geçersiz rol' }); return }

  const { error } = await req.supabase!.from('profiles').update({ role }).eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

// Delete user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) { res.status(400).json({ error: 'Kendinizi silemezsiniz' }); return }

  const { error } = await req.supabase!.from('profiles').delete().eq('id', req.params.id as string)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

export default router
