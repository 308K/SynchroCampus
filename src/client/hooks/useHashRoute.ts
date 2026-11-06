// 极简哈希路由（零依赖，天然兼容静态托管）
import { useCallback, useEffect, useState } from 'react'

export function useHashRoute() {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, '') || '/')

  useEffect(() => {
    const onChange = () => setPath(window.location.hash.replace(/^#/, '') || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: string) => {
    window.location.hash = to.startsWith('/') ? to : `/${to}`
  }, [])

  return { path, navigate }
}
