import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import type { Request, Response } from 'express'

const router = Router()

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const db = supabaseAdmin
    const [
      { count: totalMatches }, { count: totalPosts }, { count: successPosts },
      { count: failedPosts }, { count: pendingScheduled }, { count: totalSites }, { count: totalAccounts },
    ] = await Promise.all([
      db.from('matches').select('*', { count: 'exact', head: true }),
      db.from('post_history').select('*', { count: 'exact', head: true }),
      db.from('post_history').select('*', { count: 'exact', head: true }).eq('status', 'success'),
      db.from('post_history').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      db.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('sites').select('*', { count: 'exact', head: true }),
      db.from('social_accounts').select('*', { count: 'exact', head: true }),
    ])
    res.json({
      totalMatches: totalMatches || 0, totalPosts: totalPosts || 0,
      successPosts: successPosts || 0, failedPosts: failedPosts || 0,
      pendingScheduled: pendingScheduled || 0, totalSites: totalSites || 0,
      totalAccounts: totalAccounts || 0,
      successRate: totalPosts ? Math.round(((successPosts || 0) / (totalPosts || 1)) * 100) : 0,
    })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

router.get('/recent-posts', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.from('post_history').select('*').order('posted_at', { ascending: false }).limit(20)
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

export default router
