// 认证 UI 上下文：任意位置唤起登录/注册弹窗
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface AuthUIContextValue {
  openAuth: (mode?: 'login' | 'register') => void
}

const AuthUIContext = createContext<AuthUIContextValue | null>(null)

export function AuthUIProvider({
  children,
  onOpen,
}: {
  children: ReactNode
  onOpen: (mode?: 'login' | 'register') => void
}) {
  const value = useMemo(() => ({ openAuth: onOpen }), [onOpen])
  return <AuthUIContext.Provider value={value}>{children}</AuthUIContext.Provider>
}

export function useAuthUI(): AuthUIContextValue {
  const ctx = useContext(AuthUIContext)
  if (!ctx) throw new Error('useAuthUI 必须在 AuthUIProvider 内使用')
  return ctx
}
