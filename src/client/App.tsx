// 应用外壳：路由分发 + 认证上下文
import { useCallback, useState } from 'react'
import { AppShell } from '@mantine/core'
import { AuthProvider } from './auth/AuthContext'
import { AuthUIProvider } from './auth/AuthUIContext'
import { AppNavbar } from './components/AppNavbar'
import { AuthModal, type AuthMode } from './components/AuthModal'
import { HomePage } from './pages/HomePage'
import { RoomPage } from './pages/RoomPage'
import { useHashRoute } from './hooks/useHashRoute'

function Shell() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authOpen, setAuthOpen] = useState(false)
  const { path, navigate } = useHashRoute()

  const openAuth = useCallback((mode: AuthMode = 'login') => {
    setAuthMode(mode)
    setAuthOpen(true)
  }, [])

  const roomMatch = path.match(/^\/room\/([A-Za-z0-9_-]+)/)

  return (
    <AuthUIProvider onOpen={openAuth}>
      {/* header 96px = 胶囊 72px + 上下各 12px 悬浮间隙（顶部 28px 视觉留白）；胶囊左端半圆与 40px 圆形 Logo 同心（px 16 + Logo 半径 20 = 胶囊半高 36） */}
      <AppShell header={{ height: 96 }} padding="md">
        <AppShell.Header>
          <AppNavbar onOpenAuth={openAuth} />
        </AppShell.Header>
        <AppShell.Main>
          {roomMatch ? (
            <RoomPage key={roomMatch[1]} id={roomMatch[1]} navigate={navigate} />
          ) : (
            <HomePage navigate={navigate} />
          )}
        </AppShell.Main>
      </AppShell>
      <AuthModal opened={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </AuthUIProvider>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
