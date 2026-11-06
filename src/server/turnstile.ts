// Cloudflare Turnstile 服务端校验（canonical siteverify）
// 前端 → 本后端 → https://challenges.cloudflare.com/turnstile/v0/siteverify
// 校验：success === true + action 匹配 + 前端主机名在白名单内
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileFail {
  ok: false
  status: 400 | 401 | 403 | 404 | 409 | 503
  message: string
}

export type TurnstileVerdict = { ok: true } | TurnstileFail

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET?.trim())
}

function expectedHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? 'localhost,127.0.0.1')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  )
}

interface SiteverifyResult {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function verifyTurnstileToken(opts: {
  token: string
  /** 该受保护表面的稳定 action（signup / login） */
  action: string
  remoteIp?: string
}): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET?.trim()
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message: '服务端尚未配置 TURNSTILE_SECRET：请在 .env 中填入与站点密钥配对的 Turnstile Secret Key 后重启服务。',
    }
  }

  const { token, action, remoteIp } = opts
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { ok: false, status: 403, message: '人机验证 Token 缺失或格式非法，请重新完成验证。' }
  }

  const hostnames = expectedHostnames()
  if (hostnames.size === 0) {
    return { ok: false, status: 403, message: '服务端未配置 TURNSTILE_HOSTNAMES 白名单。' }
  }

  let result: SiteverifyResult
  try {
    const form = new URLSearchParams({ secret, response: token })
    if (remoteIp) form.set('remoteip', remoteIp)
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`siteverify ${res.status}`)
    result = (await res.json()) as SiteverifyResult
  } catch {
    return { ok: false, status: 403, message: '人机验证服务暂不可用，请稍后重试。' }
  }

  if (!result.success) {
    return { ok: false, status: 403, message: '人机验证未通过，请重新验证后再试。' }
  }
  if (result.action !== action) {
    return { ok: false, status: 403, message: '人机验证 action 不匹配，请求已被拦截。' }
  }  if (!result.hostname || !hostnames.has(result.hostname.toLowerCase())) {
    return { ok: false, status: 403, message: '人机验证来源域名不在白名单内，请求已被拦截。' }
  }
  return { ok: true }
}
