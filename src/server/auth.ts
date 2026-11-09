// 会话解析：从 Authorization: Bearer <JWT> 还原当前用户
import { eq } from 'drizzle-orm'
import { verifyJwt, type JwtPayload } from './jwt'
import { db } from './db'
import { revokedSessions } from './db/schema'

export interface AuthUser {
  id: string
  username: string
  /** 当前 JWT 的 jti（服务端吊销黑名单的键；历史签发的令牌可能缺失） */
  sessionId?: string
  /** 当前 JWT 的过期时间（黑名单条目的过期依据） */
  sessionExpiresAt?: Date
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
  // 服务端吊销检查（审计 M-01）：jti 命中黑名单即视为已登出。
  // 黑名单语义 fail-open：查无记录放行，历史令牌（无 jti）同样放行
  if (payload.jti) {
    const revoked = db
      .select({ jti: revokedSessions.jti })
      .from(revokedSessions)
      .where(eq(revokedSessions.jti, String(payload.jti)))
      .get()
    if (revoked) return null
  }
  return {
    id: payload.sub,
    username: String(payload.username ?? ''),
    sessionId: typeof payload.jti === 'string' ? payload.jti : undefined,
    sessionExpiresAt: typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : undefined,
  }
}
