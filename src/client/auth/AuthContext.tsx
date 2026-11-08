// 认证上下文：登录态管理与会话恢复（演示会话端侧恢复，不依赖后端）
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore, unwrap, ApiError } from '../api/client'
import { DEMO_TOKEN, DEMO_USER_ID, DEMO_USERNAME } from '../lib/demo'

export interface AuthUser {
  id: string
  username: string
}

interface AuthContextValue {
  user: AuthUser | null
  ready: boolean
  login: (username: string, password: string, turnstileToken: string) => Promise<void>
  register: (username: string, password: string, turnstileToken: string) => Promise<void>
  /** 接管会话：演示模式注入端侧标记 token，登录/注册接管服务端签发会话 */
  adoptSession: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 演示会话在初始化时端侧恢复（同步零请求）：保证首帧渲染即持有用户，房间页/首页无需等待
  const [user, setUser] = useState<AuthUser | null>(() =>
    tokenStore.get() === DEMO_TOKEN ? { id: DEMO_USER_ID, username: DEMO_USERNAME } : null,
  )
  const [ready, setReady] = useState(() => tokenStore.get() === DEMO_TOKEN)

  // 会话恢复：本地 token → 服务端校验（演示 token 已在上方端侧恢复，跳过）
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      const token = tokenStore.get()
      if (!token || token === DEMO_TOKEN) {
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

  const adoptSession = useCallback((token: string, next: AuthUser) => {
    tokenStore.set(token)
    setUser(next)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, adoptSession, logout }),
    [user, ready, login, register, adoptSession, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
