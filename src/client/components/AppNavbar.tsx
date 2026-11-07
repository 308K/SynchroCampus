// 顶栏导航：胶囊容器内同心圆 Logo、主题三态切换、登录态（窄屏图标化防溢出）
import { useState } from 'react'
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Menu,
  Text,
  ThemeIcon,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconDeviceDesktop,
  IconLogin,
  IconLogout,
  IconMoonFilled,
  IconSunFilled,
  IconUserPlus,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthContext'
import { APP_NAME } from '../config'
import type { AuthMode } from './AuthModal'

type ColorMode = 'auto' | 'dark' | 'light'

/** 循环顺序：系统 → 深 → 浅 → 系统 */
const NEXT_MODE: Record<ColorMode, ColorMode> = { auto: 'dark', dark: 'light', light: 'auto' }

const MODE_META: Record<ColorMode, { label: string; icon: typeof IconSunFilled }> = {
  auto: { label: '跟随系统', icon: IconDeviceDesktop },
  dark: { label: '深色', icon: IconMoonFilled },
  light: { label: '浅色', icon: IconSunFilled },
}

function readStoredMode(): ColorMode {
  try {
    const stored = localStorage.getItem('mantine-color-scheme-value')
    return stored === 'dark' || stored === 'light' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

interface AppNavbarProps {
  onOpenAuth: (mode: AuthMode) => void
}

export function AppNavbar({ onOpenAuth }: AppNavbarProps) {
  const { user, logout } = useAuth()
  const { setColorScheme, clearColorScheme } = useMantineColorScheme()
  const [mode, setMode] = useState<ColorMode>(readStoredMode)

  const cycleMode = () => {
    const next = NEXT_MODE[mode]
    setMode(next)
    if (next === 'auto') clearColorScheme()
    else setColorScheme(next)
  }

  const meta = MODE_META[mode]
  const nextLabel = MODE_META[NEXT_MODE[mode]].label

  return (
    /* px=12：胶囊左端半圆圆心 = 左缘 + 半高32px；Logo 圆 40px + 12px 内边距 → 两者同心 */
    <Group h="100%" px={12} justify="space-between" wrap="nowrap" align="center" className="sc-capsule-nav">
      <Group gap="sm" wrap="nowrap" align="center">
        <ThemeIcon size={40} radius="50%" variant="filled">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3.5 2" />
          </svg>
        </ThemeIcon>
        <div>
          <Text fw={800} lh={1.2} lineClamp={1}>
            {APP_NAME}
          </Text>
          <Text size="xs" c="dimmed" lh={1.2} className="sc-tagline">
            群体日程自协同决策智能体
          </Text>
        </div>
      </Group>

      <Group gap="xs" wrap="nowrap" align="center">
        <Tooltip label={`当前：${meta.label}（点击切换为${nextLabel}）`}>
          <ActionIcon variant="default" size="lg" aria-label="切换主题" onClick={cycleMode}>
            <meta.icon size={17} />
          </ActionIcon>
        </Tooltip>
        {user ? (
          <>
            {/* 窄屏：头像图标入口，避免文字按钮溢出胶囊 */}
            <Box hiddenFrom="xs">
              <Menu shadow="md" width={190} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="default" size="lg" aria-label="账号菜单">
                    <Avatar size={22} radius="xl" color="brand" variant="filled">
                      {user.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{user.username}</Menu.Label>
                  <Menu.Item leftSection={<IconLogout size={15} />} onClick={logout}>
                    退出登录
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>
            <Box visibleFrom="xs">
              <Menu shadow="md" width={190} position="bottom-end">
                <Menu.Target>
                  <Button
                    variant="subtle"
                    leftSection={
                      <Avatar size={24} radius="xl" color="brand" variant="filled">
                        {user.username.slice(0, 1).toUpperCase()}
                      </Avatar>
                    }
                  >
                    {user.username}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>账号</Menu.Label>
                  <Menu.Item leftSection={<IconLogout size={15} />} onClick={logout}>
                    退出登录
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>
          </>
        ) : (
          <>
            <Group gap="xs" wrap="nowrap" hiddenFrom="xs">
              <ActionIcon variant="default" size="lg" aria-label="登录" onClick={() => onOpenAuth('login')}>
                <IconLogin size={17} />
              </ActionIcon>
              <ActionIcon variant="filled" size="lg" aria-label="注册" onClick={() => onOpenAuth('register')}>
                <IconUserPlus size={17} />
              </ActionIcon>
            </Group>
            <Group gap="xs" wrap="nowrap" visibleFrom="xs">
              <Button variant="subtle" onClick={() => onOpenAuth('login')}>
                登录
              </Button>
              <Button onClick={() => onOpenAuth('register')}>注册</Button>
            </Group>
          </>
        )}
      </Group>
    </Group>
  )
}
