// Cloudflare Turnstile React 封装
// - 显式渲染（explicit render），每个受保护表面持有独立 widgetId
// - Token 单次有效：提交后由外部调用 reset() 换取新 Token
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Box, Text, useComputedColorScheme } from '@mantine/core'
import { TURNSTILE_SITEKEY } from '../config'

export interface TurnstileHandle {
  reset: () => void
}

interface TurnstileWidgetProps {
  action: string
  onToken: (token: string) => void
  ref?: Ref<TurnstileHandle>
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      script.addEventListener('load', () => resolve())
      script.addEventListener('error', () => {
        scriptPromise = null
        reject(new Error('Turnstile脚本加载失败，请检查网络后刷新重试。'))
      })
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export function TurnstileWidget({ action, onToken, ref }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken
  const [widgetId, setWidgetId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // useComputedColorScheme 会把 auto 解析为实际生效值，并订阅 prefers-color-scheme 变化
  const computed = useComputedColorScheme()
  const theme = computed === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    let cancelled = false
    let id: string | undefined
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        id = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          action,
          theme,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        })
        setWidgetId(id ?? null)
      })
      .catch((err: Error) => setLoadError(err.message))
    return () => {
      cancelled = true
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id)
        } catch {
          /* 容器可能已被移除 */
        }
      }
    }
  }, [action, theme])

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
      },
    }),
    [widgetId],
  )

  return (
    <Box my="xs" style={{ minHeight: 65 }}>
      <div ref={containerRef} />
      {loadError && (
        <Text c="red" size="sm">
          {loadError}
        </Text>
      )}
    </Box>
  )
}
