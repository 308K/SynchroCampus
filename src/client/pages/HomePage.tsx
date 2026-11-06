// 首页：创建 / 加入协同房间，我的房间列表
import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowRight, IconCheck, IconCopy, IconDoorEnter, IconFlask, IconGridDots, IconPalette, IconShieldCheck, IconSparkles } from '@tabler/icons-react'
import { api, unwrap, ApiError, tokenStore } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAuthUI } from '../auth/AuthUIContext'
import { RoomConfigForm } from '../components/RoomConfigForm'
import { parseFinalized, type RoomDTO } from '../lib/room'
import { dateRange, fmtDateFull } from '../lib/temporal'
import { Temporal } from '../lib/temporal'

interface HomePageProps {
  navigate: (to: string) => void
}

interface MyRoom extends RoomDTO {
  participantCount: number
}

const FEATURES = [
  { icon: IconGridDots, title: '2D 时空涂抹', desc: '拖拽标记忙碌/空闲/勉强三态偏好' },
  { icon: IconPalette, title: 'OKLCH 热力图', desc: '知觉均匀的群体空闲度透视' },
  { icon: IconSparkles, title: '端侧毫秒决策', desc: '启发式约束规划求解最优时段' },
  { icon: IconShieldCheck, title: 'Turnstile 护航', desc: '人机验证阻断脚本刷房撞库' },
]

function extractRoomCode(input: string): string | null {
  const trimmed = input.trim()
  if (/^[A-Za-z0-9_-]{4,32}$/.test(trimmed)) return trimmed
  const m = trimmed.match(/room\/([A-Za-z0-9_-]{4,32})/)
  return m ? m[1] : null
}

export function HomePage({ navigate }: HomePageProps) {
  const { user, ready } = useAuth()
  const { openAuth } = useAuthUI()
  const [rooms, setRooms] = useState<MyRoom[]>([])
  const [joinCode, setJoinCode] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) {
      setRooms([])
      setLoaded(true)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoaded(false)
      try {
        const data = await unwrap(await api.rooms.get())
        if (!cancelled) setRooms(data.rooms as MyRoom[])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          tokenStore.clear()
          setRooms([])
        } else {
          notifications.show({ color: 'red', message: '房间列表加载失败' })
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleJoin = () => {
    const code = extractRoomCode(joinCode)
    if (!code) {
      notifications.show({ color: 'red', message: '请输入 6–8 位房间短码或完整邀请链接。' })
      return
    }
    navigate(`/room/${code}`)
  }

  return (
    <Stack gap="xl" maw={1080} mx="auto" w="100%">
      <Stack gap="sm" mt={{ base: 'xs', sm: 'md' }}>
        <Badge variant="light" color="brand" w="fit-content">
          智启北疆 · 联动丝路
        </Badge>
        <Title order={1}>
          让全员空闲时段，
          <Text inherit c="brand" span>
            一次涂出来
          </Text>
        </Title>
        <Text size="lg" c="dimmed" maw={720}>
          序时以离散时空碰撞与启发式约束规划替代群内接龙与课表导入：成员在 2D 时间矩阵上涂抹偏好，智能体在端侧毫秒级求解
          Top-K 最优排程，一键定案并派发系统日历。
        </Text>
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm" mt="xs">
          {FEATURES.map((f) => (
            <Group key={f.title} gap="sm" wrap="nowrap" align="flex-start">
              <ThemeIcon variant="light" color="brand" size={34}>
                <f.icon size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={600}>
                  {f.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {f.desc}
                </Text>
              </div>
            </Group>
          ))}
        </SimpleGrid>
      </Stack>

      <Divider label="发起或加入协同" labelPosition="left" />

      <Group align="flex-start" gap="md" grow>
        <Card shadow="sm" padding="lg" radius="md" withBorder style={{ flex: '1 1 460px' }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                创建协同房间
              </Text>
              {!user && (
                <Button size="xs" variant="light" onClick={() => openAuth('register')}>
                  登录后创建
                </Button>
              )}
            </Group>
            {user ? (
              <RoomConfigForm onCreated={(room) => navigate(`/room/${room.id}`)} />
            ) : (
              <Alert color="brand" variant="light">
                创建房间需要一个极简账号（仅用户名 + 密码，注册经 Turnstile 人机验证）。{ready ? '' : '（会话恢复中…）'}
              </Alert>
            )}
          </Stack>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder style={{ flex: '1 1 320px' }}>
          <Stack gap="sm">
            <Text fw={700} size="lg">
              加入房间
            </Text>
            <Text size="xs" c="dimmed">
              粘贴邀请链接或输入短码；成员无需注册即可涂抹时间
            </Text>
            <TextInput
              placeholder="如 Ab3xK9aQ 或完整链接"
              value={joinCode}
              onChange={(e) => setJoinCode(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoin()
              }}
              rightSection={
                <Tooltip label="进入房间">
                  <Button size="compact-xs" variant="subtle" onClick={handleJoin} disabled={!joinCode.trim()}>
                    <IconArrowRight size={14} />
                  </Button>
                </Tooltip>
              }
            />
          </Stack>
        </Card>
      </Group>

      {user && (
        <>
          <Divider label={`我的房间（${loaded ? rooms.length : '…'}）`} labelPosition="left" />
          {rooms.length === 0 ? (
            <Alert color="gray" variant="light" icon={<IconFlask size={16} />}>
              还没有房间。创建一个，或在房间页注入 Mock 数据体验多方碰撞决策全流程。
            </Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {rooms.map((r) => {
                const finalized = parseFinalized(r.finalizedSlot)
                const start = Temporal.PlainDate.from(r.startDate)
                const end = Temporal.PlainDate.from(r.endDate)
                return (
                  <Card key={r.id} shadow="sm" padding="lg" radius="md" withBorder>
                    <Stack gap="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={700} lineClamp={1}>
                          {r.title}
                        </Text>
                        <Badge color={finalized ? 'brand' : 'green'} variant="light">
                          {finalized ? '已定案' : '进行中'}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {fmtDateFull(start)} ~ {fmtDateFull(end)} · {dateRange(r.startDate, r.endDate).length} 天
                      </Text>
                      <Text size="xs" c="dimmed">
                        每日 {r.startHour}:00–{r.endHour}:00 · {r.durationMinutes} 分钟 · {r.participantCount} 人已提交
                      </Text>
                      <Group justify="space-between">
                        <CopyButton value={`${window.location.origin}/#/room/${r.id}`} timeout={2000}>
                          {({ copied, copy }) => (
                            <Button size="compact-sm" variant="light" color={copied ? 'brand' : 'gray'} onClick={copy} leftSection={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}>
                              复制邀请
                            </Button>
                          )}
                        </CopyButton>
                        <Button size="compact-sm" rightSection={<IconDoorEnter size={14} />} onClick={() => navigate(`/room/${r.id}`)}>
                          打开
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                )
              })}
            </SimpleGrid>
          )}
        </>
      )}
    </Stack>
  )
}
