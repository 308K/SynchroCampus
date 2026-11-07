// 生产构建：Bun 原生打包（替代 Vite/lightningcss，杜绝 CSS 压缩器改写问题）
// 产物：dist/index.html + dist/assets/<name>-<hash>.{js,css} + public/* 平铺
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const outdir = 'dist'
rmSync(outdir, { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ['./src/client/main.tsx'],
  target: 'browser',
  format: 'esm',
  splitting: true,
  minify: true,
  naming: {
    entry: 'assets/[name]-[hash].[ext]',
    chunk: 'assets/[name]-[hash].[ext]',
    asset: 'assets/[name]-[hash].[ext]',
  },
  outdir,
})

if (!result.success) {
  for (const log of result.logs) console.error(String(log).slice(0, 400))
  process.exit(1)
}

// public/ 平铺复制（favicon、图标、manifest、sw.js）
if (existsSync('public')) cpSync('public', outdir, { recursive: true })

// 生成 index.html：替换脚本引用 + 注入 CSS link
const outputs = result.outputs.map((o) => o.path.replaceAll('\\', '/'))
// Bun.build 返回绝对路径；HTML 引用需要相对 dist 根的路径（assets/...）
const rel = (p: string) => p.slice(p.indexOf(`/${outdir}/`) + outdir.length + 2)
const entryJs = outputs.find((p) => p.includes('assets/main-') && p.endsWith('.js'))
const cssFile = readdirSync(`${outdir}/assets`).find((f) => f.endsWith('.css'))
if (!entryJs || !cssFile) {
  console.error('[build] 未找到入口 JS 或 CSS 产物，HTML 生成中止')
  process.exit(1)
}

// 构建期环境变量注入：在 HTML 头部写入 window.__SC_ENV__（前端 config.ts 读取）
const scEnv = {
  apiBase: process.env.VITE_API_BASE || '',
  turnstileSitekey: process.env.VITE_TURNSTILE_SITEKEY || '',
}
const envScript = `<script>window.__SC_ENV__=${JSON.stringify(scEnv).replaceAll('<', '\\u003c')}</script>`

const html = readFileSync('index.html', 'utf8')
  .replace(
    /<script type="module"[^>]*src="\/src\/client\/main\.tsx"><\/script>/,
    `${envScript}\n    <script type="module" src="/${rel(entryJs)}"></script>`,
  )
  .replace('</head>', `    <link rel="stylesheet" href="/assets/${cssFile}" />\n  </head>`)
  // HTML 里的 public/ 相对引用 → 部署根路径（public/ 已平铺进 dist）
  .replaceAll('href="public/', 'href="/')

writeFileSync(`${outdir}/index.html`, html)
console.log(`[build] dist/ 完成：${outputs.length} 个 JS 产物 + ${cssFile}`)
