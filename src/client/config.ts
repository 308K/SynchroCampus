// 前端公共配置
export const APP_NAME = '序时SynchroCampus'
export const APP_TAGLINE = '群体日程自协同决策智能体'

/** Cloudflare Turnstile 站点密钥（公开值，可用 .env 的 VITE_TURNSTILE_SITEKEY 覆盖） */
export const TURNSTILE_SITEKEY: string =
  (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined) ?? '0x4AAAAAAF13JTQAycn2077e'

/** 受保护表面的稳定 action（与服务端 siteverify 校验一一对应） */
export const TURNSTILE_ACTIONS = { register: 'signup', login: 'login' } as const

const NICKNAME_KEY = 'sc_nickname'
export const nicknameStore = {
  get: () => localStorage.getItem(NICKNAME_KEY) ?? '',
  set: (v: string) => localStorage.setItem(NICKNAME_KEY, v),
}
