// 会话解析：从 Authorization: Bearer <JWT> 还原当前用户
import { verifyJwt, getJwtSecret, type JwtPayload } from './jwt'

export interface AuthUser {
  id: string
  username: string
}

export function clientIp(headers: Record<string, string | undefined>): string | undefined {
  const fwd = headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]?.trim()
  return headers['x-real-ip'] ?? undefined
}

export async function currentUser(headers: Record<string, string | undefined>): Promise<AuthUser | null> {
  const auth = headers['authorization']
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null
  const payload: JwtPayload | null = await verifyJwt(token, getJwtSecret())
  if (!payload) return null
  return { id: payload.sub, username: payload.username }
}
