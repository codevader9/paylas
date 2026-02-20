import cron from 'node-cron'
import { supabaseAdmin } from '../config/supabase.js'
import { fetchUpcomingMatches } from './theSportsDB.js'
import { publishPost } from './publisher.js'
import { retweetTweet } from './twitter.js'

export function startScheduler() {
  console.log('[Scheduler] Başlatılıyor...')

  // 1. Fetch matches every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Maçlar çekiliyor...')
    try {
      for (const sport of ['football', 'basketball', 'volleyball', 'tennis']) {
        await fetchUpcomingMatches(sport)
      }
      console.log('[Scheduler] Maçlar güncellendi')
    } catch (err) {
      console.error('[Scheduler] Maç çekme hatası:', err)
    }
  })

  // 2. Check & publish scheduled posts every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString()
      const { data: posts } = await supabaseAdmin
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)

      if (!posts || posts.length === 0) return

      console.log(`[Scheduler] ${posts.length} post gönderilecek`)

      for (const post of posts) {
        await supabaseAdmin.from('scheduled_posts')
          .update({ status: 'processing' }).eq('id', post.id)

        try {
          // Caption yoksa maç bilgisinden oluştur
          let caption = post.caption
          if (!caption && post.match_id) {
            caption = await buildCaption(post.match_id, post.site_id, post.platform)
          }

          await publishPost({
            platform: post.platform,
            social_account_id: post.social_account_id,
            site_id: post.site_id,
            caption: caption || '',
            image_url: post.image_url,
            match_id: post.match_id,
          })

          await supabaseAdmin.from('scheduled_posts')
            .update({ status: 'sent' }).eq('id', post.id)

          console.log(`[Scheduler] Post gönderildi: ${post.id} (${post.platform})`)

          // Twitter ise otomatik RT
          if (post.platform === 'twitter') {
            await handleAutoRetweet(post.site_id, post.id)
          }
        } catch (err: any) {
          await supabaseAdmin.from('scheduled_posts')
            .update({ status: 'failed', error_message: err.message }).eq('id', post.id)
          console.error(`[Scheduler] Post hatası ${post.id}:`, err.message)
        }
      }
    } catch (err) {
      console.error('[Scheduler] Zamanlama hatası:', err)
    }
  })

  // 3. Auto-schedule posts for upcoming matches every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await autoScheduleUpcomingMatches()
    } catch (err) {
      console.error('[Scheduler] Otomatik zamanlama hatası:', err)
    }
  })

  console.log('[Scheduler] Aktif - 3 cron job çalışıyor')
  console.log('[Scheduler] - Her 30dk: Maç çekme')
  console.log('[Scheduler] - Her 1dk: Zamanlanmış post gönderme')
  console.log('[Scheduler] - Her 15dk: Yaklaşan maçlar için otomatik zamanlama')
}

async function buildCaption(matchId: string, siteId: string, platform: string): Promise<string> {
  const { data: match } = await supabaseAdmin
    .from('matches').select('*').eq('id', matchId).single()
  if (!match) return ''

  // Site'nin tweet şablonunu ara
  const { data: template } = await supabaseAdmin
    .from('tweet_templates')
    .select('template')
    .eq('site_id', siteId)
    .or(`sport.eq.${match.sport},sport.eq.all`)
    .order('is_default', { ascending: false })
    .limit(1)
    .single()

  if (template?.template) {
    const date = new Date(match.match_date)
    return template.template
      .replace(/\{\{home_team\}\}/g, match.home_team)
      .replace(/\{\{away_team\}\}/g, match.away_team)
      .replace(/\{\{league\}\}/g, match.league_name)
      .replace(/\{\{date\}\}/g, date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }))
      .replace(/\{\{time\}\}/g, date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }))
      .replace(/\{\{venue\}\}/g, match.venue || '')
  }

  // Varsayılan caption
  const date = new Date(match.match_date)
  const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })
  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

  if (platform === 'telegram') {
    return `⚽ <b>${match.home_team}</b> vs <b>${match.away_team}</b>\n🏆 ${match.league_name}\n📅 ${dateStr} ${timeStr}`
  }
  return `⚽ ${match.home_team} vs ${match.away_team}\n🏆 ${match.league_name}\n📅 ${dateStr} ${timeStr}`
}

async function handleAutoRetweet(siteId: string, postId: string) {
  const { data: config } = await supabaseAdmin
    .from('retweet_configs').select('*')
    .eq('site_id', siteId).eq('is_active', true).single()

  if (!config?.auto_rt_own_tweets) return

  const { data: history } = await supabaseAdmin
    .from('post_history').select('external_post_id')
    .eq('scheduled_post_id', postId).eq('status', 'success').eq('platform', 'twitter').single()

  if (!history?.external_post_id) return

  const { data: rtAccounts } = await supabaseAdmin
    .from('retweet_accounts').select('*, proxies(*)')
    .eq('site_id', siteId).eq('is_active', true)

  if (!rtAccounts || rtAccounts.length === 0) return

  console.log(`[RT] ${rtAccounts.length} hesapla RT yapılacak: ${history.external_post_id}`)

  for (const rtAccount of rtAccounts) {
    const delay = Math.floor(
      Math.random() * (config.max_delay_seconds - config.min_delay_seconds) + config.min_delay_seconds
    ) * 1000

    setTimeout(async () => {
      try {
        const creds = rtAccount.credentials as any
        if (rtAccount.proxies) {
          const { buildProxyUrl } = await import('./proxy.js')
          creds.__proxy_url = buildProxyUrl(rtAccount.proxies)
        }
        await retweetTweet(history.external_post_id!, creds)
        console.log(`[RT] ${rtAccount.account_name} RT başarılı`)
      } catch (err: any) {
        console.error(`[RT] ${rtAccount.account_name} hata:`, err.message)
      }
    }, delay)
  }
}

async function autoScheduleUpcomingMatches() {
  const { data: sites } = await supabaseAdmin.from('sites').select('id, name').eq('is_active', true)
  if (!sites || sites.length === 0) return

  let totalScheduled = 0

  for (const site of sites) {
    const { data: accounts } = await supabaseAdmin
      .from('social_accounts').select('id, platform')
      .eq('site_id', site.id).eq('is_active', true)

    if (!accounts || accounts.length === 0) continue

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data: matches } = await supabaseAdmin
      .from('matches').select('id, home_team, away_team, match_date')
      .eq('status', 'upcoming')
      .gte('match_date', now.toISOString())
      .lte('match_date', in24h.toISOString())

    if (!matches || matches.length === 0) continue

    for (const match of matches) {
      for (const account of accounts) {
        const matchTime = new Date(match.match_date)
        const scheduledAt = new Date(matchTime.getTime() - 60 * 60 * 1000)

        if (scheduledAt > now) {
          const caption = await buildCaption(match.id, site.id, account.platform)

          const { error } = await supabaseAdmin.from('scheduled_posts').upsert({
            match_id: match.id,
            site_id: site.id,
            platform: account.platform,
            social_account_id: account.id,
            caption,
            scheduled_at: scheduledAt.toISOString(),
            minutes_before: 60,
            status: 'pending',
          }, { onConflict: 'match_id,social_account_id', ignoreDuplicates: true })

          if (!error) totalScheduled++
        }
      }
    }
  }

  if (totalScheduled > 0) {
    console.log(`[Scheduler] ${totalScheduled} yeni post zamanlandı`)
  }
}
