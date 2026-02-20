import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

// Service role key varsa (JWT format) onu kullan, yoksa anon key ile devam et
const adminKey = env.supabaseServiceRoleKey.startsWith('eyJ')
  ? env.supabaseServiceRoleKey
  : env.supabaseAnonKey

export const supabaseAdmin = createClient(env.supabaseUrl, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey)
