// 登录 / 注册弹窗：Cloudflare Turnstile 人机验证 + JWT 会话签发
import { useEffect, useState, type Ref } from 'react'
import { Alert, Button, Modal, PasswordInput, SegmentedControl, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { TURNSTILE_ACTIONS } from '../config'
import { TurnstileWidget, type TurnstileHandle } from './TurnstileWidget'

export type AuthMode = 'login' | 'register'

interface AuthModalProps {
  opened: boolean
  onClose: () => void
  initialMode?: AuthMode
}

export function AuthModal({ opened, onClose, initialMode = 'login' }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileRef, setTurnstileRef] = useState<TurnstileHandle | null>(null)

  // 每次打开时同步到调用方请求的模式（login / register），并清空上一次的状态
  useEffect(() => {
    if (!opened) return
    setMode(initialMode)
    setError(null)
    setToken('')
    setSubmitting(false)
  }, [opened, initialMode])

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setToken('')
  }

  const handleSubmit = async () => {
    if (!token) {
      setError('请先完成人机验证。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') await login(username.trim(), password, token)
      else await register(username.trim(), password, token)
      notifications.show({
        color: 'brand',
        message: mode === 'login' ? `欢迎回来，${username.trim()}` : `注册成功，欢迎加入序时，${username.trim()}`,
      })
      setUsername('')
      setPassword('')
      setToken('')
      onClose()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '网络异常，请稍后重试。'
      setError(message)
      notifications.show({ color: 'red', message })
    } finally {
      // Token 单次有效：无论成败都重置，确保下一次提交拿到全新 Token
      turnstileRef?.reset()
      setToken('')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'login' ? '登录序时' : '注册序时'}
      centered
      overlayProps={{ blur: 3 }}
    >
      <Stack>
        <SegmentedControl
          value={mode}
          onChange={(v) => switchMode(v as AuthMode)}
          data={[
            { value: 'login', label: '登录' },
            { value: 'register', label: '注册' },
          ]}
          fullWidth
        />
        <TextInput
          label="用户名"
          placeholder="3–20个字符"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          maxLength={20}
        />
        <PasswordInput
          label="密码"
          placeholder={mode === 'register' ? '至少 6 位' : '你的密码'}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          maxLength={32}
        />
        <TurnstileWidget
          key={mode}
          action={mode === 'login' ? TURNSTILE_ACTIONS.login : TURNSTILE_ACTIONS.register}
          onToken={setToken}
          ref={setTurnstileRef}
        />
        {error && (
          <Alert color="red" icon={<IconInfoCircle size={16} />} py="xs">
            {error}
          </Alert>
        )}
        <Button
          fullWidth
          loading={submitting}
          disabled={!token || !username || !password}
          onClick={() => void handleSubmit()}
        >
          {mode === 'login' ? '登录并继续' : '创建账户'}
        </Button>
      </Stack>
    </Modal>
  )
}
