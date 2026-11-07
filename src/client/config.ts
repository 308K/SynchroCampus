// 前端公共配置
export const APP_NAME = '序时SynchroCampus'
export const APP_TAGLINE = '群体日程自协同决策智能体'

// 构建期环境变量：scripts/build.ts 生成 dist/index.html 时注入 window.__SC_ENV__
// （不依赖任何打包器的 define/env 魔法）；本地 dev 与单进程形态走同源兜底
interface BuildEnv {
  apiBase?: string
  turnstileSitekey?: string
}
const buildEnv: BuildEnv = (window as unknown as { __SC_ENV__?: BuildEnv }).__SC_ENV__ ?? {}

/** 后端 API 基址：Pages 部署构建时设 VITE_API_BASE=https://synchro-api.kkn.moe；缺省同源 */
export const API_BASE: string = buildEnv.apiBase || window.location.origin

/** Cloudflare Turnstile 站点密钥（公开值） */
export const TURNSTILE_SITEKEY: string = buildEnv.turnstileSitekey || '0x4AAAAAAF13JTQAycn2077e'

/** 受保护表面的稳定 action（与服务端 siteverify 校验一一对应） */
export const TURNSTILE_ACTIONS = { register: 'signup', login: 'login' } as const

const NICKNAME_KEY = 'sc_nickname'
export const nicknameStore = {
  get: () => localStorage.getItem(NICKNAME_KEY) ?? '',
  set: (v: string) => localStorage.setItem(NICKNAME_KEY, v),
}
