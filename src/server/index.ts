// 服务端入口：Elysia + Bun
import { existsSync, statSync } from 'node:fs'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { app } from './api'

const port = Number(process.env.PORT ?? 3001)

const root = new Elysia().use(cors()).use(app)

// 可选：若存在前端构建产物 dist/，则单进程托管静态资源（生产形态预览）
if (existsSync('dist/index.html')) {
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
  }
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
  root.get('/*', ({ params }) => {
    const asset = serveFile(params['*'] ?? '')
    return asset ?? new Response(Bun.file('dist/index.html'), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  })
}

root.listen(port)
console.log(`[api] SynchroCampus API 已启动: http://localhost:${port} (SQLite WAL + argon2id + Turnstile siteverify)`)
