import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { App } from './App'
import { theme } from './theme'

import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-center" limit={4} />
      <App />
    </MantineProvider>
  </React.StrictMode>,
)

// PWA：生产构建注册 Service Worker（开发环境不注册，避免缓存干扰热更新）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 离线能力降级：注册失败不影响主流程 */
    })
  })
}
