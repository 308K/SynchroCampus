// 认证上下文：登录态管理与会话恢复
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore, unwrap, ApiError } from '../api/client'

export interface AuthUser {
  id: string
  username: string
}

interface AuthContextValue {
  user: AuthUser | null
  ready: boolean
  login: (username: string, password: string, turnstileToken: string) => Promise<void>
  register: (username: string, password: string, turnstileToken: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  // 会话恢复：本地 token → 服务端校验
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      if (!tokenStore.get()) {
        setReady(true)
        return
      }
      try {
        const data = await unwrap(await api.auth.me.get())
        if (!cancelled) setUser(data.user)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) tokenStore.clear()
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string, turnstileToken: string) => {
    const data = await unwrap(await api.auth.login.post({ username, password, turnstileToken }))
    tokenStore.set(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (username: string, password: string, turnstileToken: string) => {
    const data = await unwrap(await api.auth.register.post({ username, password, turnstileToken }))
    tokenStore.set(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
