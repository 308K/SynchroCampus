// 轻量 JWT（HMAC-SHA256，Web Crypto 实现，无第三方依赖）
const encoder = new TextEncoder()

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return new Uint8Array(sig)
}

/** 常数时间比较，抵御时序侧信道 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export interface JwtPayload {
  sub: string
  username: string
  iat: number
  exp: number
}

let bootSecret: string | null = null

/** JWT 密钥：优先读取环境变量；缺失时生成进程级随机密钥（重启后会话失效，仅供开发） */
export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (!bootSecret) {
    bootSecret = crypto.randomUUID() + crypto.randomUUID()
    console.warn(
      '[auth] JWT_SECRET 未配置，已生成临时密钥（重启后登录态失效）。生产环境请在 .env 中固定该值。',
    )
  }
  return bootSecret
}

export async function signJwt(
  payload: { sub: string; username: string },
  secret: string,
  expiresInSeconds = 7 * 24 * 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const body: JwtPayload = { ...payload, iat: now, exp: now + expiresInSeconds }
  const head = b64urlEncode(encoder.encode(JSON.stringify(header)))
  const claims = b64urlEncode(encoder.encode(JSON.stringify(body)))
  const sig = await hmacSha256(secret, `${head}.${claims}`)
  return `${head}.${claims}.${b64urlEncode(sig)}`
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, claims, sig] = parts
  const expected = await hmacSha256(secret, `${head}.${claims}`)
  const actual = b64urlDecode(sig)
  if (!timingSafeEqual(expected, actual)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(claims))) as JwtPayload
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null
    return payload
  } catch {
    return null
  }
}
