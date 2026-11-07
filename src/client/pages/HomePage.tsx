// 首页：演示模式 / 创建 / 加入协同房间，我的房间列表
import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconDoorEnter,
  IconFlask,
  IconGridDots,
  IconPalette,
  IconSparkles,
} from '@tabler/icons-react'
import { useMantineColorScheme } from '@mantine/core'
import { HERO_TITLE_DARK, HERO_TITLE_LIGHT } from '../theme'
import { api, unwrap, ApiError, tokenStore } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAuthUI } from '../auth/AuthUIContext'
import { RoomConfigForm } from '../components/RoomConfigForm'
import { parseFinalized, type RoomDTO } from '../lib/room'
import { Temporal, dateRange, fmtDateFull } from '../lib/temporal'

interface HomePageProps {
  navigate: (to: string) => void
}

interface MyRoom extends RoomDTO {
  participantCount: number
}

const FEATURES = [
  { icon: IconGridDots, title: '2D时空涂抹', desc: '拖拽标记忙碌/空闲/勉强三态偏好' },
  { icon: IconPalette, title: 'OKLCH热力图', desc: '知觉均匀的群体空闲度透视' },
  { icon: IconSparkles, title: '端侧毫秒决策', desc: '启发式约束规划求解最优时段' },
]

function extractRoomCode(input: string): string | null {
  const trimmed = input.trim()
  if (/^[A-Za-z0-9_-]{4,32}$/.test(trimmed)) return trimmed
  const m = trimmed.match(/room\/([A-Za-z0-9_-]{4,32})/)
  return m ? m[1] : null
}

export function HomePage({ navigate }: HomePageProps) {
  const { user, ready, adoptSession } = useAuth()
  const { openAuth } = useAuthUI()
  const { colorScheme } = useMantineColorScheme()
  const [rooms, setRooms] = useState<MyRoom[]>([])
  const [joinCode, setJoinCode] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [enteringDemo, setEnteringDemo] = useState(false)

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
      notifications.show({ color: 'red', message: '请输入6–8位房间短码或完整邀请链接。' })
      return
    }
    navigate(`/room/${code}`)
  }

  const handleDemo = async () => {
    setEnteringDemo(true)
    try {
      const data = await unwrap(await api.demo.enter.post())
      adoptSession(data.token, { id: 'demo-owner', username: data.username })
      notifications.show({ color: 'brand', message: '已进入演示模式，示例数据加载完成' })
      navigate(`/room/${data.roomId}`)
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '演示模式启动失败' })
    } finally {
      setEnteringDemo(false)
    }
  }

  return (
    <Stack gap="xl" maw={1080} mx="auto" w="100%">
      <Stack gap="sm" mt={{ base: 'xs', sm: 'md' }}>
        {/* 大标题：两行，首行主题感知取色（浅色=色阶中对比度≥3:1 的层，深色=#ddaacc 本色）+ 双主题阴影 */}
        <Stack gap={0} component="header">
          <Text
            ff="'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
            fw={800}
            fz={{ base: '2.6rem', sm: '3.6rem' }}
            lh={1.12}
            c={colorScheme === 'dark' ? HERO_TITLE_DARK : HERO_TITLE_LIGHT}
            className="sc-hero-title"
          >
            序时
          </Text>
          <Text
            ff="'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
            fw={800}
            fz={{ base: '2.6rem', sm: '3.6rem' }}
            lh={1.12}
            className="sc-hero-title"
          >
            SynchroCampus
          </Text>
        </Stack>
        <Text size="lg" c="dimmed" maw={760}>
          序时以离散时空碰撞与启发式约束规划替代群内接龙与课表导入：成员在2D时间矩阵上涂抹偏好，智能体在端侧毫秒级求解Top-K最优排程，一键定案并派发系统日历。
        </Text>
        <Group gap="sm" wrap="wrap">
          <Button
            size="md"
            leftSection={<IconFlask size={17} />}
            loading={enteringDemo}
            onClick={() => void handleDemo()}
          >
            进入演示模式
          </Button>
          <Text size="xs" c="dimmed" maw={420}>
            免注册载入示例房间与6位模拟成员的全周冲突数据，完整体验涂抹→热力图→决策→定案闭环
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
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

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
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
                  创建房间需要一个极简账号（仅用户名+密码，注册经Turnstile人机验证）。{ready ? '' : '（会话恢复中…）'}
                </Alert>
              )}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
            <Stack gap="sm">
              <Text fw={700} size="lg">
                加入房间
              </Text>
              <Text size="xs" c="dimmed">
                粘贴邀请链接或输入短码；成员无需注册即可涂抹时间
              </Text>
              <TextInput
                placeholder="如Ab3xK9aQ或完整链接"
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
        </Grid.Col>
      </Grid>

      {user && (
        <>
          <Divider label={`我的房间（${loaded ? rooms.length : '…'}）`} labelPosition="left" />
          {rooms.length === 0 ? (
            <Alert color="gray" variant="light" icon={<IconFlask size={16} />}>
              还没有房间。创建一个，或进入演示模式体验多方碰撞决策全流程。
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
                      <Group gap="xs" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {fmtDateFull(start)}~{fmtDateFull(end)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {dateRange(r.startDate, r.endDate).length}天
                        </Text>
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          每日{r.startHour}:00–{r.endHour}:00
                        </Text>
                        <Text size="xs" c="dimmed">
                          {r.durationMinutes}分钟
                        </Text>
                        <Text size="xs" c="dimmed">
                          {r.participantCount}人已提交
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <CopyButton value={`${window.location.origin}/#/room/${r.id}`} timeout={2000}>
                          {({ copied, copy }) => (
                            <Button
                              size="compact-sm"
                              variant="light"
                              color={copied ? 'brand' : 'gray'}
                              onClick={copy}
                              leftSection={copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                            >
                              复制邀请
                            </Button>
                          )}
                        </CopyButton>
                        <Button
                          size="compact-sm"
                          rightSection={<IconDoorEnter size={14} />}
                          onClick={() => navigate(`/room/${r.id}`)}
                        >
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
