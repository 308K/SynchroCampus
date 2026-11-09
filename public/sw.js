/* 序时SynchroCampus Service Worker
 * 策略：
 * - 导航请求：网络优先，失败回退离线壳（缓存的 /）
 * - /api/*：仅网络（鉴权与协同数据不可陈旧）
 * - 同源已知静态资源（/assets/* 与核心文件）：缓存优先 + 后台更新（stale-while-revalidate）
 * - 其余同源路径：仅网络（审计 M-06：避免未来的动态 JSON 等被默认缓存）
 */
const CACHE = 'synchrocampus-v2'
const CORE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // 仅缓存成功响应：404/5xx 不能顶替离线壳（审计 M-06）
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((cache) => cache.put('/', clone))
          }
          return res
        })
        .catch(() => caches.match('/').then((hit) => hit || Response.error())),
    )
    return
  }

  // 已知静态资源才进缓存管线；其余同源请求透传给网络（不 respondWith）
  if (!url.pathname.startsWith('/assets/') && !CORE.includes(url.pathname)) return

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const clone = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, clone))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
