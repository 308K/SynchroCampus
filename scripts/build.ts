// 生产构建：Bun 原生打包（替代 Vite/lightningcss，杜绝 CSS 压缩器改写问题）
// 产物：dist/index.html + dist/assets/<name>-<hash>.{js,css} + public/* 平铺
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

// 生产构建强制 NODE_ENV=production（审计 M-03）：缺省时 Bun 会以开发形态编译 JSX
// （jsxDEV + React dev 运行时分支），产物体积膨胀且保留更详细的运行时警告
process.env.NODE_ENV ||= 'production'

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
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(String(log).slice(0, 400))
  process.exit(1)
}

// public/ 平铺复制（favicon、图标、manifest、sw.js、_headers、404.html 等）
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

// 构建期环境变量注入：window.__SC_ENV__（前端 config.ts 读取）；
// 若 API 与页面跨域，在同一脚本内即时注入 preconnect/dns-prefetch 提示——
// 位置在 head 内所有资源之前，跨域连接在 CSS/JS/API 请求前即开始建立
// （fetch 跨域默认凭据模式为 same-origin → 匿名 CORS 连接，preconnect 需带 crossorigin 才能复用）
const scEnv = {
  apiBase: process.env.VITE_API_BASE || '',
  turnstileSitekey: process.env.VITE_TURNSTILE_SITEKEY || '',
}
// 注入链路可见性（审计 M-05）：生产变量缺失时显式告警，避免运行期静默回落
if (!scEnv.apiBase) {
  console.warn('[build] VITE_API_BASE 未设置：前端将回退同源（方案 A 部署会导致 /api 404，见 docs/DEPLOY.md）')
}
if (!scEnv.turnstileSitekey) {
  console.warn('[build] VITE_TURNSTILE_SITEKEY 未设置：前端回退 bundle 内硬编码 sitekey，站点密钥轮换时会静默失配（审计 M-05）')
}
const envScript = [
  '<script>',
  `window.__SC_ENV__=${JSON.stringify(scEnv).replaceAll('<', '\\u003c')};`,
  '(function(){try{var b=window.__SC_ENV__.apiBase||"";if(!b)return;var o=new URL(b,location.origin).origin;'
    + 'if(o===location.origin)return;for(var r of["preconnect","dns-prefetch"]){var l=document.createElement("link");'
    + 'l.rel=r;l.href=o;if(r==="preconnect")l.crossOrigin="anonymous";document.head.appendChild(l)}}catch(e){}})();',
  '</script>',
].join('\n    ')

const html = readFileSync('index.html', 'utf8')
  .replace(
    /<script type="module"[^>]*src="\/src\/client\/main\.tsx"><\/script>/,
    `<script type="module" src="/${rel(entryJs)}"></script>`,
  )
  .replace('</head>', `    ${envScript}\n    <link rel="stylesheet" href="/assets/${cssFile}" />\n  </head>`)
  // HTML 里的 public/ 相对引用 → 部署根路径（public/ 已平铺进 dist）
  .replaceAll('href="public/', 'href="/')

writeFileSync(`${outdir}/index.html`, html)
console.log(`[build] dist/ 完成：${outputs.length} 个 JS 产物 + ${cssFile}`)
