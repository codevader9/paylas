import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../config/supabase.js'
import { createTweet, uploadMedia } from './twitter.js'
import { sendTelegramPhoto, sendTelegramPhotoFile, sendTelegramMessage } from './telegram.js'
import { postToInstagram } from './instagram.js'
import { generateMatchImage, getPlaceholderPath, getSiteLogoPath } from './canvas.js'

interface PublishParams {
  platform: string
  social_account_id: string
  site_id: string
  caption: string
  image_url?: string
  match_id?: string
}

export async function publishPost(params: PublishParams, db?: SupabaseClient) {
  const client = db || supabaseAdmin

  // Hesap + proxy bilgisini çek
  const { data: account, error: accErr } = await client
    .from('social_accounts')
    .select('*, proxies(*)')
    .eq('id', params.social_account_id)
    .single()

  if (accErr || !account) {
    console.error('[Publish] Hesap bulunamadı:', accErr?.message)
    throw new Error('Sosyal hesap bulunamadı')
  }

  // Proxy varsa URL oluştur ve credentials'a ekle
  if (account.proxies) {
    const { buildProxyUrl } = await import('./proxy.js')
    const proxyUrl = buildProxyUrl(account.proxies)
    if (account.credentials) {
      ;(account.credentials as any).__proxy_url = proxyUrl
    }
    console.log('[Publish] Proxy kullanılacak:', proxyUrl.replace(/:[^:]*@/, ':***@'))
  }

  let imageBuffer: Buffer | undefined
  let imageUrl = params.image_url

  // Maç ID varsa ve görsel yoksa, otomatik oluştur
  if (params.match_id && !imageUrl) {
    const { data: match } = await client
      .from('matches').select('*').eq('id', params.match_id).single()
    if (match) {
      const r = match.raw_data || {}
      const placeholderPath = getPlaceholderPath(match.sport || 'football', params.site_id)
      const siteLogoPath = await getSiteLogoPath(params.site_id)
      console.log('[Publish] Match verisi:', { home_team: match.home_team, away_team: match.away_team, league_name: match.league_name })
      imageBuffer = await generateMatchImage({
        homeTeam: match.home_team ?? r.strHomeTeam ?? 'Ev Sahibi',
        awayTeam: match.away_team ?? r.strAwayTeam ?? 'Deplasman',
        homeLogo: match.home_logo, awayLogo: match.away_logo,
        leagueName: match.league_name ?? r.strLeague ?? 'Lig',
        leagueLogo: match.league_logo,
        matchDate: match.match_date ?? (r.dateEvent && r.strTime ? `${r.dateEvent}T${r.strTime}` : null) ?? new Date().toISOString(),
        venue: match.venue, sport: match.sport || 'football',
        placeholderPath, siteLogoPath,
      })
      console.log('[Publish] Görsel oluşturuldu:', imageBuffer.length, 'bytes')

      // Twitter/Instagram için görseli Supabase Storage'a yükle (URL gerekiyor)
      if (params.platform !== 'telegram' && imageBuffer) {
        const fileName = `match-${params.match_id}-${Date.now()}.png`
        const { data: uploadData, error: uploadErr } = await client.storage
          .from('match-images')
          .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: true })

        if (uploadErr) {
          console.error('[Publish] Storage upload hatası:', uploadErr.message)
        } else {
          const { data: urlData } = client.storage.from('match-images').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
          console.log('[Publish] Görsel URL:', imageUrl)
        }
      }
    }
  }

  let result: any
  let externalPostId: string | undefined

  try {
    switch (params.platform) {
      case 'twitter': {
        const creds = account.credentials as any
        console.log('[Publish] Twitter hesabı:', account.account_name, 'login_cookies:', !!creds.login_cookies)

        // login_cookies yoksa önce login yap
        if (!creds.login_cookies) {
          if (!creds.user_name || !creds.password) {
            throw new Error('Twitter hesabında user_name/password veya login_cookies eksik')
          }
          console.log('[Publish] Twitter login yapılıyor...')
          const { loginTwitter } = await import('./twitter.js')
          const loginResult = await loginTwitter(creds, params.social_account_id)
          console.log('[Publish] Twitter login sonucu:', JSON.stringify(loginResult).slice(0, 200))

          if (loginResult?.login_cookies || loginResult?.cookies) {
            creds.login_cookies = loginResult.login_cookies || loginResult.cookies
            if (db) {
              await db.from('social_accounts')
                .update({ credentials: { ...creds } })
                .eq('id', params.social_account_id)
            }
          }
        }

        let mediaIds: string[] = []
        // Buffer varsa direkt upload, URL varsa URL'den indir ve upload
        if (imageBuffer) {
          console.log('[Publish] Twitter media upload (buffer)...')
          const mediaResult = await uploadMedia(imageBuffer, creds, params.social_account_id)
          console.log('[Publish] Media upload sonucu:', JSON.stringify(mediaResult).slice(0, 200))
          if (mediaResult?.media_id) mediaIds = [mediaResult.media_id]
        } else if (imageUrl) {
          console.log('[Publish] Twitter media upload (url)...')
          const mediaResult = await uploadMedia(imageUrl, creds, params.social_account_id)
          if (mediaResult?.media_id) mediaIds = [mediaResult.media_id]
        }

        console.log('[Publish] Tweet gönderiliyor, media:', mediaIds.length, 'adet')
        result = await createTweet({ text: params.caption, mediaIds }, creds, params.social_account_id)
        console.log('[Publish] Tweet sonucu:', JSON.stringify(result).slice(0, 200))
        externalPostId = result?.data?.id || result?.tweet_id
        break
      }

      case 'telegram': {
        const creds = account.credentials as any
        if (!creds.bot_token || !creds.chat_id) {
          throw new Error('Telegram hesabında bot_token veya chat_id eksik')
        }

        // Site'nin TG menü butonlarını çek
        let inlineKeyboard: any = undefined
        const { data: menuData } = await client
          .from('telegram_menus')
          .select('menu_json')
          .eq('social_account_id', params.social_account_id)
          .eq('is_active', true)
          .limit(1)
          .single()

        if (menuData?.menu_json) {
          inlineKeyboard = menuData.menu_json
          console.log('[Publish] TG inline keyboard ekleniyor')
        }

        if (imageBuffer) {
          result = await sendTelegramPhotoFile(creds.bot_token, creds.chat_id, imageBuffer, 'match.jpg', params.caption, 'HTML', inlineKeyboard)
        } else if (imageUrl) {
          result = await sendTelegramPhoto(creds.bot_token, creds.chat_id, imageUrl, params.caption, inlineKeyboard)
        } else {
          result = await sendTelegramMessage(creds.bot_token, creds.chat_id, params.caption, inlineKeyboard)
        }
        externalPostId = result?.result?.message_id?.toString()
        break
      }

      case 'instagram': {
        const creds = account.credentials as any
        if (!imageUrl) throw new Error('Instagram için görsel URL gerekli')
        result = await postToInstagram(creds, imageUrl, params.caption)
        externalPostId = result?.id
        break
      }

      default:
        throw new Error(`Desteklenmeyen platform: ${params.platform}`)
    }

    // Başarı logla
    await client.from('post_history').insert({
      site_id: params.site_id,
      platform: params.platform,
      account_name: account.account_name,
      match_id: params.match_id,
      caption: params.caption,
      image_url: imageUrl,
      status: 'success',
      external_post_id: externalPostId,
      response_data: result,
    })

    console.log(`[Publish] Başarılı: ${params.platform} - ${account.account_name}`)
    return { success: true, externalPostId, result }
  } catch (err: any) {
    // Hata logla
    await client.from('post_history').insert({
      site_id: params.site_id,
      platform: params.platform,
      account_name: account.account_name,
      match_id: params.match_id,
      caption: params.caption,
      image_url: imageUrl,
      status: 'failed',
      error_message: err.message,
    })

    console.error(`[Publish] Hata: ${params.platform} - ${err.message}`)
    throw err
  }
}
