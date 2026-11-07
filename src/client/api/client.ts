// Eden Treaty 全链路类型安全客户端（类型零样板推导）
import { treaty } from '@elysia/eden'
import type { App } from '../../server/api'

import { API_BASE } from '../config'

const TOKEN_KEY = 'sc_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// 兜底：Bun dev 的模块内联可能把 API_BASE 求值为空串（"" falsy → 回退同源）
const treatyClient = treaty<App>(API_BASE || window.location.origin, {
  // 关闭 Eden 的响应日期自动转换：本项目的 startDate/endDate 是纯日期字符串，
  // 必须保持 string 形态交给 Temporal.PlainDate 处理（转成 Date 会丢失"仅日期"语义并带时区偏移）
  parseDate: false,
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
  error: { status: unknown; value: unknown } | null
}): Promise<T> {
  if (res.error) {
    const status = typeof res.error.status === 'number' ? res.error.status : 0
    throw new ApiError(status, extractMessage(res.error.value, status))
  }
  if (res.data === null || res.data === undefined) throw new ApiError(0, '服务端返回了空响应。')
  return res.data
}

/** 启动自检：探测后端 /api/health 是否可达（5 秒超时），不通返回 false 由调用方通报 */
export async function pingApi(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}
