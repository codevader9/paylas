import axios from 'axios'
import { env } from '../config/env.js'

const API_BASE = env.twitterApiBase

interface TwitterLoginParams {
  user_name: string
  email: string
  password: string
  proxy?: string
  totp_secret?: string
}

interface TwitterCredentials {
  user_name: string
  email: string
  password: string
  totp_secret?: string
  login_cookies?: string
  ct0?: string
  auth_token?: string
  __proxy_url?: string // publisher tarafından eklenir
}

interface CreateTweetParams {
  text: string
  mediaIds?: string[]
  replyToTweetId?: string
  attachmentUrl?: string
  communityId?: string
  isNoteTweet?: boolean
}

function getProxyUrl(credentials: TwitterCredentials): string | undefined {
  return credentials.__proxy_url || undefined
}

/**
 * Twitter Login - user_login_v2
 */
export async function loginTwitter(credentials: TwitterCredentials, _accountId?: string) {
  const proxyUrl = getProxyUrl(credentials)

  const body: TwitterLoginParams = {
    user_name: credentials.user_name,
    email: credentials.email,
    password: credentials.password,
  }
  if (credentials.totp_secret) body.totp_secret = credentials.totp_secret
  if (proxyUrl) body.proxy = proxyUrl

  console.log('[Twitter] Login:', credentials.user_name, 'proxy:', proxyUrl ? 'var' : 'YOK')

  const { data } = await axios.post(`${API_BASE}/twitter/user_login_v2`, body, {
    headers: { 'X-API-Key': env.twitterApiKey, 'Content-Type': 'application/json' },
  })
  return data
}

/**
 * Upload Media - upload_media_v2
 * file field required (multipart form)
 */
export async function uploadMedia(
  media: string | Buffer,
  credentials: TwitterCredentials,
  _accountId?: string
) {
  const proxyUrl = getProxyUrl(credentials)
  const FormData = (await import('form-data')).default
  const form = new FormData()

  if (Buffer.isBuffer(media)) {
    form.append('file', media, { filename: 'match.jpg', contentType: 'image/jpeg' })
  } else {
    const response = await axios.get(media, { responseType: 'arraybuffer', timeout: 15000 })
    form.append('file', Buffer.from(response.data), { filename: 'match.jpg', contentType: 'image/jpeg' })
  }

  if (credentials.login_cookies) form.append('login_cookies', credentials.login_cookies)
  if (proxyUrl) form.append('proxy', proxyUrl)

  const { data } = await axios.post(`${API_BASE}/twitter/upload_media_v2`, form, {
    headers: {
      'X-API-Key': env.twitterApiKey,
      ...form.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  })
  return data
}

/**
 * Create Tweet - create_tweet_v2
 */
export async function createTweet(params: CreateTweetParams, credentials: TwitterCredentials, _accountId?: string) {
  const proxyUrl = getProxyUrl(credentials)

  const body: any = { tweet_text: params.text }
  if (credentials.login_cookies) body.login_cookies = credentials.login_cookies
  if (params.mediaIds && params.mediaIds.length > 0) body.media_ids = params.mediaIds
  if (params.replyToTweetId) body.reply_to_tweet_id = params.replyToTweetId
  if (params.attachmentUrl) body.attachment_url = params.attachmentUrl
  if (params.communityId) body.community_id = params.communityId
  if (params.isNoteTweet) body.is_note_tweet = true
  if (proxyUrl) body.proxy = proxyUrl

  const { data } = await axios.post(`${API_BASE}/twitter/create_tweet_v2`, body, {
    headers: { 'X-API-Key': env.twitterApiKey, 'Content-Type': 'application/json' },
  })
  return data
}

/**
 * Retweet - retweet_tweet_v2
 */
export async function retweetTweet(tweetId: string, credentials: TwitterCredentials, _accountId?: string) {
  const proxyUrl = getProxyUrl(credentials)

  const body: any = { tweet_id: tweetId }
  if (credentials.login_cookies) body.login_cookies = credentials.login_cookies
  if (proxyUrl) body.proxy = proxyUrl

  const { data } = await axios.post(`${API_BASE}/twitter/retweet_tweet_v2`, body, {
    headers: { 'X-API-Key': env.twitterApiKey, 'Content-Type': 'application/json' },
  })
  return data
}
