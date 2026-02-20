import axios from 'axios'
import FormData from 'form-data'

const TG_API = 'https://api.telegram.org'

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: any,
  parseMode: string = 'HTML'
) {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  }
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup)

  const { data } = await axios.post(`${TG_API}/bot${botToken}/sendMessage`, body)
  return data
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: any,
  parseMode: string = 'HTML'
) {
  const body: any = {
    chat_id: chatId,
    photo: photoUrl,
    parse_mode: parseMode,
  }
  if (caption) body.caption = caption
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup)

  const { data } = await axios.post(`${TG_API}/bot${botToken}/sendPhoto`, body)
  return data
}

export async function sendTelegramPhotoFile(
  botToken: string,
  chatId: string,
  photoBuffer: Buffer,
  filename: string = 'match.jpg',
  caption?: string,
  parseMode: string = 'HTML',
  replyMarkup?: any
) {
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('photo', photoBuffer, { filename, contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg' })
  if (caption) form.append('caption', caption)
  form.append('parse_mode', parseMode)
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup))

  const { data } = await axios.post(`${TG_API}/bot${botToken}/sendPhoto`, form, {
    headers: form.getHeaders(),
  })
  return data
}

export function buildReplyKeyboard(buttons: string[][], options?: { resize?: boolean; oneTime?: boolean }) {
  return {
    keyboard: buttons,
    resize_keyboard: options?.resize ?? true,
    one_time_keyboard: options?.oneTime ?? false,
  }
}
