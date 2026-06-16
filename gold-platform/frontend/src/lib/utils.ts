import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(num)) return '--'
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPercent(percent: number | string): string {
  const num = typeof percent === 'string' ? parseFloat(percent) : percent
  if (isNaN(num)) return '--'
  const sign = num >= 0 ? '+' : ''
  return `${sign}${num.toFixed(2)}%`
}

export function formatTime(timestamp: string | number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(timestamp: string | number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function getPriceColor(change: number | string): string {
  const num = typeof change === 'string' ? parseFloat(change) : change
  if (isNaN(num) || num === 0) return 'text-[#e0e0ff]'
  return num > 0 ? 'price-up' : 'price-down'
}

export function getImpactColor(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'high':
      return 'text-neon-red'
    case 'medium':
      return 'text-gold'
    case 'low':
      return 'text-cyan-glow'
    default:
      return 'text-[#8888aa]'
  }
}

export function getImpactBgColor(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'high':
      return 'bg-neon-red/10 border-neon-red/30 text-neon-red'
    case 'medium':
      return 'bg-gold/10 border-gold/30 text-gold'
    case 'low':
      return 'bg-cyan-glow/10 border-cyan-glow/30 text-cyan-glow'
    default:
      return 'bg-[#8888aa]/10 border-[#8888aa]/30 text-[#8888aa]'
  }
}

export function truncateAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 客户端密码哈希 - 传输前对密码进行 SHA-256 哈希
 * 这样密码不会以明文形式在网络上传输
 */
export async function hashPasswordClient(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '_gold_platform_client')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 安全地将值转为数组，防止 .map() 报错
 */
export function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return []
}

/**
 * 安全地解析 API 响应数据
 */
export function extractApiData(res: { data: unknown }): any {
  const d = res.data as any
  return d?.data || d
}
