import type { AxiosRequestConfig } from 'axios'

export interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  protocol: string
}

export function buildProxyUrl(proxy: ProxyConfig): string {
  const auth = proxy.username ? `${proxy.username}:${proxy.password}@` : ''
  return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`
}

export function getAxiosProxyConfig(proxy: ProxyConfig): AxiosRequestConfig {
  return {
    proxy: {
      host: proxy.host,
      port: proxy.port,
      auth: proxy.username ? { username: proxy.username, password: proxy.password || '' } : undefined,
      protocol: proxy.protocol,
    },
  }
}

// Artık kullanılmıyor - proxy bilgisi publisher'dan geçiriliyor
export async function getProxyForAccount(_accountId: string): Promise<ProxyConfig | null> {
  return null
}
