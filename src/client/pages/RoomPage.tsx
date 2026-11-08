// 房间页：涂抹 / 热力图 / 决策建议三标签 + 定案导出闭环
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import confetti from 'canvas-confetti'
import {
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconConfetti,
  IconDoorExit,
  IconFlask,
  IconHourglass,
  IconLock,
  IconRefresh,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { api, unwrap, ApiError, tokenStore } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { AgentDecisionDeck } from '../components/AgentDecisionDeck'
import { FinalizedPanel } from '../components/FinalizedPanel'
import { HeatmapBoard } from '../components/HeatmapBoard'
import { SharePopover } from '../components/SharePopover'
import { TimeSlotPainter } from '../components/TimeSlotPainter'
import { nicknameStore } from '../config'
import {
  DEMO_ROOM_ID,
  DEMO_USER_ID,
  finalizeDemo,
  injectDemoMock,
  leaveDemo,
  loadDemoRoom,
  resetDemo,
  saveDemoAvailability,
} from '../lib/demo'
import { emptyMask, maskToNumbers, numbersToMask } from '../lib/mask'
import { MOCK_NAMES, generateMockMask } from '../lib/mock'
import {
  daysOf,
  parseFinalized,
  totalSlots,
  windowRange,
  type ParticipantDTO,
  type RoomDTO,
  type ScoredWindow,
} from '../lib/room'

interface RoomPageProps {
  id: string
  navigate: (to: string) => void
}

interface RoomData {
  room: RoomDTO
  participants: ParticipantDTO[]
  isOwner: boolean
}

const CONFETTI_COLORS = ['#ddaacc', '#c07cad', '#9a5489', '#f3e4ee']

function celebrate() {
  confetti({ particleCount: 130, spread: 100, origin: { y: 0.72 }, colors: CONFETTI_COLORS })
  setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors: CONFETTI_COLORS }), 180)
  setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors: CONFETTI_COLORS }), 330)
}

export function RoomPage({ id, navigate }: RoomPageProps) {
  const { user } = useAuth()
  const [data, setData] = useState<RoomData | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [nickname, setNickname] = useState(() => nicknameStore.get())
  const [mask, setMask] = useState<number[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [injecting, setInjecting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [finalizing, setFinalizing] = useState<ScoredWindow | null>(null)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null)
  const [acting, setActing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const maskInitRef = useRef(false)

  const isDemoRoom = id === DEMO_ROOM_ID

  /** 演示房间：端侧数据直读（零后端），isSelf/isOwner 随会话用户联动 */
  const applyDemoData = (userId: string | null) => {
    const d = loadDemoRoom(userId)
    setData({ room: d.room, participants: d.participants, isOwner: d.isOwner })
    setNotFound(null)
  }

  const fetchRoom = useCallback(
    async (silent = false) => {
      if (isDemoRoom) return // 演示房间走端侧数据层（见 applyDemoData），无远端状态可同步
      try {
        const res = await unwrap(await api.rooms({ id }).get())
        setData({ room: res.room as RoomDTO, participants: res.participants, isOwner: res.isOwner })
        setNotFound(null)
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) setNotFound(err.message)
          else if (err.status === 401) tokenStore.clear()
          else if (!silent) notifications.show({ color: 'red', message: err.message })
        } else if (!silent) {
          notifications.show({ color: 'red', message: '房间数据同步失败' })
        }
      }
    },
    [id, isDemoRoom],
  )

  useEffect(() => {
    maskInitRef.current = false
    setMask(null)
    setData(null)
    void fetchRoom()
  }, [id, fetchRoom])

  // 演示房间数据装载：随房间 id 与会话用户变化重读端侧存储（进入/会话恢复/登出联动）；
  // 声明在挂载 effect 之后，保证同一提交内晚于 setData(null) 执行
  useEffect(() => {
    if (isDemoRoom) applyDemoData(user?.id ?? null)
  }, [id, isDemoRoom, user])

  // 协同轮询：8 秒同步其他成员的涂抹结果（页面可见时）
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchRoom(true)
    }, 8000)
    return () => clearInterval(timer)
  }, [fetchRoom])

  // 涂抹掩码初始化：优先本人历史提交，其次匿名昵称匹配，否则全忙碌
  useEffect(() => {
    if (!data || mask !== null || maskInitRef.current) return
    const mine =
      data.participants.find((p) => p.isSelf) ??
      data.participants.find((p) => p.nickname === nickname.trim() && !p.isSelf && nickname.trim() !== '')
    if (mine) {
      setMask(maskToNumbers(mine.availabilityMask))
      if (!nickname) setNickname(mine.nickname)
    } else {
      setMask(emptyMask(totalSlots(data.room)))
    }
    maskInitRef.current = true
  }, [data, mask, nickname])

  const finalized = useMemo(() => parseFinalized(data?.room.finalizedSlot), [data?.room.finalizedSlot])

  const handleSave = async () => {
    if (!data || !mask) return
    const name = nickname.trim() || user?.username || '匿名同学'
    setSaving(true)
    try {
      if (isDemoRoom) {
        saveDemoAvailability(user?.id ?? null, name, numbersToMask(mask))
        applyDemoData(user?.id ?? null)
      } else {
        await unwrap(
          await api.rooms({ id: data.room.id }).availability.post({
            nickname: name,
            availabilityMask: numbersToMask(mask),
          }),
        )
        await fetchRoom(true)
      }
      nicknameStore.set(name)
      notifications.show({ color: 'brand', message: '时间偏好已提交，全员热力图已同步' })
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '提交失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleInjectMock = async () => {
    if (!data) return
    setInjecting(true)
    try {
      if (isDemoRoom) {
        injectDemoMock()
        applyDemoData(user?.id ?? null)
      } else {
        for (const name of MOCK_NAMES) {
          await unwrap(
            await api.rooms({ id: data.room.id }).availability.post({
              nickname: name,
              availabilityMask: generateMockMask(data.room, `${data.room.id}:${name}`),
            }),
          )
        }
        await fetchRoom(true)
      }
      notifications.show({ color: 'brand', message: `已注入${MOCK_NAMES.length}位模拟参与者的冲突日程` })
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : 'Mock注入失败' })
    } finally {
      setInjecting(false)
    }
  }

  const handleResetDemo = async () => {
    if (!data) return
    setResetting(true)
    try {
      if (isDemoRoom) {
        resetDemo()
        maskInitRef.current = false
        setMask(null)
        applyDemoData(user?.id ?? null)
      } else {
        await unwrap(await api.demo.reset.post())
        maskInitRef.current = false
        setMask(null)
        await fetchRoom(true)
      }
      notifications.show({ color: 'brand', message: '演示数据已重置为初始示例状态' })
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '重置失败' })
    } finally {
      setResetting(false)
    }
  }

  const isParticipant =
    data?.participants.some((p) => p.isSelf) ||
    (Boolean(nickname.trim()) && Boolean(data?.participants.some((p) => !p.isSelf && p.nickname === nickname.trim())))

  const handleDeleteRoom = async () => {
    if (!data) return
    setActing(true)
    try {
      await unwrap(await api.rooms({ id: data.room.id }).delete())
      notifications.show({ color: 'brand', message: `房间「${data.room.title}」已删除` })
      setConfirmAction(null)
      navigate('/')
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '删除失败' })
    } finally {
      setActing(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!data) return
    setActing(true)
    try {
      if (isDemoRoom) {
        leaveDemo(user?.id ?? null, (nickname.trim() || user?.username || '').slice(0, 20))
      } else {
        await unwrap(
          await api.rooms({ id: data.room.id }).leave.post(
            user ? {} : { nickname: nickname.trim().slice(0, 20) || undefined },
          ),
        )
      }
      notifications.show({ color: 'brand', message: `已退出「${data.room.title}」` })
      setConfirmAction(null)
      maskInitRef.current = false
      setMask(null)
      navigate('/')
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '退出失败' })
    } finally {
      setActing(false)
    }
  }

  const handleFinalize = async (w: ScoredWindow) => {
    if (!data) return
    const range = windowRange(data.room, w.dayIndex, w.startSlot, w.slotCount)
    const selectedSlot = JSON.stringify({
      date: range.date.toString(),
      startTime: range.startTime,
      endTime: range.endTime,
    })
    setFinalizing(w)
    try {
      if (isDemoRoom) {
        finalizeDemo(selectedSlot)
        applyDemoData(user?.id ?? null)
      } else {
        await unwrap(
          await api.rooms({ id: data.room.id }).finalize.post({ selectedSlot }),
        )
        await fetchRoom(true)
      }
      celebrate()
      setDrawerOpen(true)
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof ApiError ? err.message : '定案失败' })
    } finally {
      setFinalizing(null)
    }
  }

  if (notFound) {
    return (
      <Stack maw={640} mx="auto" py="xl" gap="md">
        <Alert color="red" title="房间不存在">
          {notFound}
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} variant="light" onClick={() => navigate('/')}>
          返回首页
        </Button>
      </Stack>
    )
  }

  if (!data || !mask) {
    return (
      <Text ta="center" c="dimmed" py="xl">
        正在加载房间时空配置…
      </Text>
    )
  }

  const { room, participants, isOwner } = data
  const isDemo = user?.id === DEMO_USER_ID
  const inviteLink = `${window.location.origin}/#/room/${room.id}`
  const myNickname = nickname.trim() || user?.username
  const dateSpan = `${room.startDate}~${room.endDate}（${daysOf(room)}天）`

  return (
    <Stack gap="md" maw={1180} mx="auto" w="100%">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Group gap="sm" wrap="wrap">
          <Button variant="subtle" size="compact-sm" leftSection={<IconArrowLeft size={14} />} onClick={() => navigate('/')}>
            首页
          </Button>
          <Title order={3} lineClamp={1}>
            {room.title}
          </Title>
          {isDemo && (
            <Badge color="grape" variant="light">
              演示会话
            </Badge>
          )}
          {finalized ? (
            <Badge color="brand" variant="light" leftSection={<IconLock size={11} />}>
              已定案
            </Badge>
          ) : (
            <Badge color="green" variant="light">
              协同中
            </Badge>
          )}
        </Group>
        <Group gap="sm" wrap="wrap">
          {/* 演示会话随时可重置（含定案后），保证示例流程可反复体验 */}
          {isDemo && (
            <Button
              variant="light"
              color="gray"
              leftSection={<IconRefresh size={16} />}
              loading={resetting}
              onClick={() => void handleResetDemo()}
            >
              重置演示
            </Button>
          )}
          {!finalized && (
            <Button
              variant="light"
              color="grape"
              leftSection={<IconFlask size={16} />}
              loading={injecting}
              onClick={() => void handleInjectMock()}
            >
              注入Mock数据
            </Button>
          )}
          {isOwner && !isDemo && (
            <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => setConfirmAction('delete')}>
              删除房间
            </Button>
          )}
          {!isOwner && isParticipant && (
            <Button variant="light" color="red" leftSection={<IconDoorExit size={16} />} onClick={() => setConfirmAction('leave')}>
              退出房间
            </Button>
          )}
          <SharePopover roomId={room.id} />
        </Group>
      </Group>

      <Modal
        opened={confirmAction != null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === 'delete' ? '删除房间' : '退出房间'}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {confirmAction === 'delete'
              ? `将永久删除「${room.title}」及全部${participants.length}位参与者的时间数据，不可恢复。确认删除？`
              : `退出后你的时间偏好将从「${room.title}」移除，可重新加入。确认退出？`}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" color="gray" onClick={() => setConfirmAction(null)}>
              取消
            </Button>
            <Button
              color="red"
              loading={acting}
              onClick={() => void (confirmAction === 'delete' ? handleDeleteRoom() : handleLeaveRoom())}
            >
              {confirmAction === 'delete' ? '永久删除' : '确认退出'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Card shadow="sm" padding="sm" radius="md" withBorder>
        <Group gap="lg" wrap="wrap">
          <Group gap={6} wrap="nowrap">
            <IconCalendar size={15} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {dateSpan}
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconClock size={15} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              每日{room.startHour}:00–{room.endHour}:00
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconHourglass size={15} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              时长{room.durationMinutes}分钟
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <IconUsers size={15} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {participants.length}人已提交
            </Text>
          </Group>
          {isOwner && !isDemo && (
            <Text size="sm" c="brand" fw={600}>
              你是房主
            </Text>
          )}
        </Group>
      </Card>

      {finalized && (
        <Card shadow="sm" padding="lg" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-brand-4)' }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>
                <Group gap={6}>
                  <IconLock size={15} />
                  定案时段
                </Group>
              </Text>
              {isOwner && (
                <Button variant="light" size="compact-sm" onClick={() => setDrawerOpen(true)}>
                  查看导出
                </Button>
              )}
            </Group>
            <FinalizedPanel room={room} slot={finalized} participants={participants} inviteLink={inviteLink} />
          </Stack>
        </Card>
      )}

      <Tabs defaultValue="paint" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="paint" disabled={false}>
            我的时间
          </Tabs.Tab>
          <Tabs.Tab value="heat">全员热力图</Tabs.Tab>
          <Tabs.Tab value="agent">决策建议</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="paint" pt="md">
          <Stack gap="md">
            {finalized && (
              <Alert color="brand" variant="light" icon={<IconLock size={16} />}>
                房间已定案锁定，时间矩阵仅供回看。
              </Alert>
            )}
            <Group align="flex-end" gap="sm">
              <TextInput
                label="我的昵称"
                placeholder="展示在热力图与名单中"
                value={nickname}
                onChange={(e) => setNickname(e.currentTarget.value)}
                w={220}
                maxLength={20}
              />
              <Button
                loading={saving}
                disabled={finalized != null}
                onClick={() => void handleSave()}
              >
                保存我的时间
              </Button>
              <Text size="xs" c="dimmed" mb="calc(0.375rem)">
                掩码将序列化为等长位图传输（当前{mask.length}槽位）
              </Text>
            </Group>
            <TimeSlotPainter
              room={room}
              mask={mask}
              onMaskChange={setMask}
              locked={finalized != null}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="heat" pt="md">
          <HeatmapBoard room={room} participants={participants} myNickname={myNickname} />
        </Tabs.Panel>

        <Tabs.Panel value="agent" pt="md">
          <AgentDecisionDeck
            room={room}
            participants={participants}
            isOwner={isOwner}
            finalizedJson={room.finalizedSlot}
            onFinalize={(w) => void handleFinalize(w)}
            finalizing={finalizing}
          />
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <Group gap={6} wrap="nowrap">
            <IconConfetti size={16} color="var(--mantine-color-brand-6)" />
            <span>定案完成</span>
          </Group>
        }
        position="right"
        size="lg"
      >
        {finalized ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              房间「{room.title}」已锁定，以下为派发入口：
            </Text>
            <FinalizedPanel room={room} slot={finalized} participants={participants} inviteLink={inviteLink} />
            <Divider label="后续" labelPosition="left" />
            <Text size="xs" c="dimmed">
              共 {daysOf(room)} 天窗口 · {participants.length} 位参与者完成涂抹；定案数据持久化于房间记录，可随时回看。
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed">暂无定案数据</Text>
        )}
      </Drawer>
    </Stack>
  )
}
