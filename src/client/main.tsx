import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import 'dayjs/locale/zh-cn'
import { App } from './App'
import { theme } from './theme'

import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* 日期组件本地化：中文月/周名 + 周一为一周起点（dayjs 语言包需显式导入） */}
      <DatesProvider settings={{ locale: 'zh-cn', firstDayOfWeek: 1, labelSeparator: '至' }}>
        <Notifications position="top-center" limit={4} />
        <App />
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
)

// PWA：仅在部署域名上注册 Service Worker（localhost 开发/预览不注册，避免缓存干扰热更新）
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 离线能力降级：注册失败不影响主流程 */
    })
  })
}
