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
      <AppShell header={{ height: 64 }} padding="md">
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
