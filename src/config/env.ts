import 'dotenv/config'

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  theSportsDbKey: process.env.THESPORTSDB_API_KEY || '3',
  twitterApiBase: process.env.TWITTER_API_BASE || 'https://api.twitterapi.io',
  twitterApiKey: process.env.TWITTER_API_KEY || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  instagramAppId: process.env.INSTAGRAM_APP_ID || '',
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET || '',
}
