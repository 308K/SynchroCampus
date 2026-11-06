// Cloudflare Turnstile 全局脚本类型声明
interface TurnstileOptions {
  sitekey: string
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: (errorCode: string) => void
  'timeout-callback'?: () => void
  retry?: 'auto' | 'never'
  'retry-interval'?: number
}

interface TurnstileApi {
  render(element: HTMLElement | string, options: TurnstileOptions): string
  reset(widgetId?: string): void
  remove(widgetId?: string): void
  getResponse(widgetId?: string): string | undefined
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export {}
