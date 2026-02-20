import type { Request, Response, NextFunction } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
  supabase?: SupabaseClient
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token gerekli' })
    return
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    // Kullanıcının kendi token'ı ile client oluştur
    const userClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // Token'dan user bilgisi al
    const { data: { user }, error } = await userClient.auth.getUser()

    if (error || !user) {
      console.error('[Auth] Token doğrulama hatası:', error?.message)
      res.status(401).json({ error: 'Geçersiz token' })
      return
    }

    // Kullanıcının kendi profili -- RLS izin verir (auth.uid() = id)
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    req.userId = user.id
    req.userRole = profile?.role || 'user'
    req.supabase = userClient
    next()
  } catch (err: any) {
    console.error('[Auth] Hata:', err.message)
    res.status(401).json({ error: 'Token doğrulanamadı' })
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin yetkisi gerekli' })
    return
  }
  next()
}
