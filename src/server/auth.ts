// 会话解析：从 Authorization: Bearer <JWT> 还原当前用户
import { verifyJwt, type JwtPayload } from './jwt'

export interface AuthUser {
  id: string
  username: string
}

export function clientIp(headers: Record<string, string | undefined>): string | undefined {
  // 生产经 Cloudflare（Pages/Tunnel）接入：CF-Connecting-IP 由边缘写入、客户端不可伪造，优先级最高；
  // X-Forwarded-For 首段仅作本地开发/通用代理兜底（直连场景可被伪造）
  const cf = headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.trim().length > 0) return cf.trim()
  const fwd = headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]?.trim()
  return headers['x-real-ip'] ?? undefined
}

export async function currentUser(headers: Record<string, string | undefined>): Promise<AuthUser | null> {
  const auth = headers['authorization']
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null
  const payload: JwtPayload | null = await verifyJwt(token)
  if (!payload) return null
  return { id: payload.sub, username: String(payload.username ?? '') }
}
