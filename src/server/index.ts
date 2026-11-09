// 服务端入口：Elysia 2 + Bun（双模式）
// - dist/index.html 存在：生产单进程 —— Elysia 托管 API + dist 静态资源（:3001）
// - 否则：Bun 全栈 dev —— Bun.serve HTML 导入（--hot 时客户端 HMR）+ public/ 资源 + API（app.handle 回退）
import { existsSync, statSync } from 'node:fs'
import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'
import { app } from './api'
import { ensureDemoData } from './demo'
import appHtml from '../../index.html'

const port = Number(process.env.PORT ?? 3001)

// 演示模式种子数据（幂等）
ensureDemoData()

// CORS：开发默认全放开；生产用 CORS_ORIGINS 白名单（逗号分隔），并显式放行 Authorization 预检
const corsOrigins = process.env.CORS_ORIGINS?.trim()
const root = new Elysia()
  .use(
    cors({
      origin: corsOrigins ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean) : true,
      allowedHeaders: ['authorization', 'content-type'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      // 审计 M-02：预检缓存 5s → 10min
      maxAge: 600,
    }),
  )
  // 审计 M-02：@elysia/cors 默认 exposeHeaders=true 会把本次请求的请求头名动态拼进
  // Access-Control-Expose-Headers（调试残留），且类型不接受 false、传值即固定写头。
  // 在 CORS 的 onRequest 之后统一剥除该响应头（应用未暴露任何自定义响应头，无需白名单）
  .onRequest(({ set }) => {
    delete set.headers['access-control-expose-headers']
  })
  .use(app)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

// BUN_DEV=1 强制开发模式（防止 build 后残留 dist/ 让 bun run dev 意外进入生产形态）
const devMode = process.env.BUN_DEV === '1' || !existsSync('dist/index.html')

if (!devMode) {
  // ============ 生产单进程模式 ============
  const serveFile = (relPath: string): Response | null => {
    try {
      if (!relPath || relPath.includes('..')) return null
      const file = `dist/${relPath}`
      if (!existsSync(file) || statSync(file).isDirectory()) return null
      const ext = file.slice(file.lastIndexOf('.'))
      return new Response(Bun.file(file), {
        headers: { 'content-type': MIME[ext] ?? 'application/octet-stream' },
      })
    } catch {
      return null
    }
  }
  // 未知路径的兜底语义与 Pages 对齐（审计 M-04）：未知路径返回 dist/404.html（404 状态），
  // 而非全路径 200 HTML；404 页缺失时退回旧的 index.html 行为
  const notFoundFile = existsSync('dist/404.html') ? 'dist/404.html' : 'dist/index.html'
  root.get('/*', ({ params }) => {
    const asset = serveFile(params['*'] ?? '')
    if (asset) return asset
    if (!(params['*'] ?? '')) {
      return new Response(Bun.file('dist/index.html'), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    return new Response(Bun.file(notFoundFile), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  })
  root.listen(port)
  console.log(`[prod] SynchroCampus 单进程生产形态: http://localhost:${port} (API + dist 静态托管)`)
} else {
  // ============ Bun 全栈开发模式（bun --hot 启用以获得客户端 HMR） ============
  const servePublic = (pathname: string): Response | null => {
    try {
      if (!pathname || pathname.includes('..')) return null
      const file = `public${pathname}`
      if (!existsSync(file) || statSync(file).isDirectory()) return null
      const ext = file.slice(file.lastIndexOf('.'))
      return new Response(Bun.file(file), {
        headers: { 'content-type': MIME[ext] ?? 'application/octet-stream' },
      })
    } catch {
      return null
    }
  }

  Bun.serve({
    port,
    development: { hmr: true },
    routes: {
      '/': appHtml,
    },
    async fetch(req) {
      const pathname = new URL(req.url).pathname
      // public/ 静态资源（favicon / manifest / sw.js / 图标）
      const asset = servePublic(pathname)
      if (asset) return asset
      // 其余全部交给 Elysia（/api/* 与未匹配路径的 404 语义）
      return (await app.handle(req)) ?? new Response('Not Found', { status: 404 })
    },
  })
  console.log(`[dev] SynchroCampus Bun 全栈开发服务器: http://localhost:${port} (HTML 导入 + HMR + API 同源)`)
}
