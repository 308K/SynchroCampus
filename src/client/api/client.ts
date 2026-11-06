// Eden Treaty 全链路类型安全客户端（类型零样板推导）
import { treaty } from '@elysiajs/eden'
import type { App } from '../../server/api'

const TOKEN_KEY = 'sc_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const baseURL = (import.meta.env.VITE_API_BASE as string | undefined) ?? window.location.origin

const treatyClient = treaty<App>(baseURL, {
  headers: () => {
    const token = tokenStore.get()
    return token ? { authorization: `Bearer ${token}` } : {}
  },
})

/** App 带有 /api 前缀，取其子树直接暴露业务路由 */
export const api = treatyClient.api

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function extractMessage(value: unknown, status: number): string {
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.error === 'string' && o.error.length > 0) return o.error
    if (typeof o.summary === 'string' && o.summary.length > 0) return o.summary
  }
  return `请求失败（HTTP ${status}）`
}

/** 解包 Eden 响应：成功取 data，失败抛出带状态的 ApiError */
export async function unwrap<T>(res: {
  data: T | null
  error: { status: number; value: unknown } | null
}): Promise<T> {
  if (res.error) throw new ApiError(res.error.status, extractMessage(res.error.value, res.error.status))
  if (res.data === null || res.data === undefined) throw new ApiError(0, '服务端返回了空响应。')
  return res.data
}
