// 安全优化的轻量级 JWT（Web Crypto 原生实现）
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const MAX_TOKEN_LENGTH = 4096
const MIN_SECRET_LENGTH = 32

// 1. 利用 Bun 内置 Buffer 实现极致性能的 base64url 编解码
//    返回 Uint8Array<ArrayBuffer>（独立副本），满足 TS 严格模式下 BufferSource 的泛型约束
const b64urlEncode = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url')
const b64urlDecode = (input: string): Uint8Array<ArrayBuffer> => Uint8Array.from(Buffer.from(input, 'base64url'))

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
  jti?: string
  [key: string]: any
}

// 2. 缓存 CryptoKey 单例，避免每次验证重复 importKey
let cachedCryptoKey: CryptoKey | null = null

export async function getJwtCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey

  let secret = process.env.JWT_SECRET?.trim()

  if (secret) {
    if (encoder.encode(secret).length < MIN_SECRET_LENGTH) {
      throw new Error(`[auth] JWT_SECRET 长度过短，至少需 ${MIN_SECRET_LENGTH} 字节`)
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[auth] 生产环境必须配置 JWT_SECRET 环境变量！')
    }
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    secret = b64urlEncode(bytes)
    console.warn('[auth] 开发模式：已生成临时随机密钥，重启后登录态失效。')
  }

  // 同时赋予 'sign' 和 'verify' 用途
  cachedCryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )

  return cachedCryptoKey
}

/**
 * 签发 Token
 */
export async function signJwt<T extends Record<string, any>>(
  payload: T & { sub: string },
  expiresInSeconds = 2 * 3600
): Promise<string> {
  const key = await getJwtCryptoKey()
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'HS256', typ: 'JWT' }
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomUUID(),
  }

  const head = b64urlEncode(encoder.encode(JSON.stringify(header)))
  const claims = b64urlEncode(encoder.encode(JSON.stringify(body)))
  const dataToSign = encoder.encode(`${head}.${claims}`)

  const sig = await crypto.subtle.sign('HMAC', key, dataToSign)
  return `${head}.${claims}.${b64urlEncode(new Uint8Array(sig))}`
}

/**
 * 验证 Token
 */
export async function verifyJwt<T extends JwtPayload = JwtPayload>(
  token: string
): Promise<T | null> {
  // 1. 基础防御
  if (!token || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, claims, sig] = parts

  try {
    const key = await getJwtCryptoKey()
    const signatureBytes = b64urlDecode(sig)
    const dataToVerify = encoder.encode(`${head}.${claims}`)

    // 2. 原生恒时间签名比对
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataToVerify)
    if (!isValid) return null

    // 3. 校验 Header（容忍大小写 typ）
    const header = JSON.parse(decoder.decode(b64urlDecode(head)))
    if (header.alg !== 'HS256' || (header.typ && header.typ.toUpperCase() !== 'JWT')) {
      return null
    }

    // 4. 校验 Claims
    const payload = JSON.parse(decoder.decode(b64urlDecode(claims))) as T
    const now = Math.floor(Date.now() / 1000)

    if (typeof payload.exp !== 'number' || payload.exp < now) return null
    if (typeof payload.iat === 'number' && payload.iat > now + 60) return null // 允许 60 秒时钟漂移
    if (typeof payload.sub !== 'string') return null

    return payload
  } catch {
    return null
  }
}