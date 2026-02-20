import { Router } from 'express'
import { authMiddleware, adminOnly, type AuthRequest } from '../middleware/auth.js'
import type { Response } from 'express'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const router = Router()
router.use(authMiddleware as any)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!.from('sites').select('*').order('created_at', { ascending: false })
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await req.supabase!.from('sites').select('*').eq('id', req.params.id).single()
  if (error) { res.status(404).json({ error: 'Site bulunamadı' }); return }
  res.json(data)
})

router.post('/', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { name, domain, description, settings } = req.body
  const { data, error } = await req.supabase!.from('sites').insert({ name, domain, description, settings }).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

router.put('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { name, domain, description, is_active, settings } = req.body
  const { data, error } = await req.supabase!.from('sites').update({ name, domain, description, is_active, settings }).eq('id', req.params.id).select().single()
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

router.delete('/:id', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { error } = await req.supabase!.from('sites').delete().eq('id', req.params.id)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ success: true })
})

// Logo upload (base64)
router.post('/:id/logo', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const { logo } = req.body // base64 string
  if (!logo) { res.status(400).json({ error: 'Logo verisi gerekli' }); return }

  try {
    const base64Data = logo.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const siteLogosDir = path.join(process.cwd(), 'assets', 'site-logos')
    if (!fs.existsSync(siteLogosDir)) fs.mkdirSync(siteLogosDir, { recursive: true })

    const logoPath = path.join(siteLogosDir, `${req.params.id}.png`)
    await sharp(buffer).resize(600, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(logoPath)

    console.log('[Sites] Logo kaydedildi:', logoPath)
    res.json({ success: true, path: logoPath })
  } catch (err: any) {
    console.error('[Sites] Logo upload hatası:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Logo sil
router.delete('/:id/logo', adminOnly as any, async (req: AuthRequest, res: Response) => {
  const siteLogosDir = path.join(process.cwd(), 'assets', 'site-logos')
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(siteLogosDir, `${req.params.id}.${ext}`)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  res.json({ success: true })
})

// Logo var mı kontrol
router.get('/:id/logo', async (req: AuthRequest, res: Response) => {
  const siteLogosDir = path.join(process.cwd(), 'assets', 'site-logos')
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(siteLogosDir, `${req.params.id}.${ext}`)
    if (fs.existsSync(p)) {
      res.set('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg')
      res.send(fs.readFileSync(p))
      return
    }
  }
  res.status(404).json({ error: 'Logo bulunamadı' })
})

export default router
