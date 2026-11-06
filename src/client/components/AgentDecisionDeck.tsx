// 智能体决策甲板：Top-3 最优排程窗口 + 解释性加扣分指标 + 房主采纳
import { useMemo } from 'react'
import { Alert, Badge, Button, Card, Group, RingProgress, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconCrown, IconMedal, IconMedal2, IconSparkles, IconTrophy } from '@tabler/icons-react'
import { computeTopWindows, scoreBreakdownText, windowTags } from '../lib/scheduler'
import { windowRange, type ParticipantDTO, type RoomDTO, type ScoredWindow } from '../lib/room'
import { fmtDateFull } from '../lib/temporal'

/** Top-3 排名图标（Tabler，替代 emoji） */
const RANK_ICONS = [IconTrophy, IconMedal2, IconMedal] as const

interface AgentDecisionDeckProps {
  room: RoomDTO
  participants: ParticipantDTO[]
  isOwner: boolean
  finalizedJson: string | null
  onFinalize: (w: ScoredWindow) => void
  finalizing: ScoredWindow | null
}


export function AgentDecisionDeck({
  room,
  participants,
  isOwner,
  finalizedJson,
  onFinalize,
  finalizing,
}: AgentDecisionDeckProps) {
  const windows = useMemo(() => computeTopWindows(room, participants, 3), [room, participants])

  if (participants.length === 0) {
    return (
      <Alert color="brand" variant="light" title="等待群体时空数据">
        目前还没有人提交时间偏好。先在「我的时间」标签页涂抹你的空闲时段，或点击顶部「注入Mock数据」一键生成多方冲突演示。
      </Alert>
    )
  }

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconSparkles size={18} color="var(--mantine-color-brand-6)" />
        <Text size="sm" c="dimmed">
          端侧启发式约束规划已遍历全部候选窗口（到场率×100/餐时−25/夜间−40/连续性+8），以下为全局最优Top 3：
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 1, md: 3 }}>
        {windows.map((w, i) => {
          const range = windowRange(room, w.dayIndex, w.startSlot, w.slotCount)
          const tags = windowTags(w, i)
          const RankIcon = RANK_ICONS[i] ?? IconMedal
          const payload = {
            date: range.date.toString(),
            startTime: range.startTime,
            endTime: range.endTime,
          }
          const adopted = finalizedJson != null && finalizedJson === JSON.stringify(payload)
          const busy = finalizing != null && finalizing.dayIndex === w.dayIndex && finalizing.startSlot === w.startSlot
          return (
            <Card
              key={`${w.dayIndex}-${w.startSlot}`}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={i === 0 ? { borderColor: 'var(--mantine-color-brand-4)', borderWidth: 2 } : undefined}
            >
              <Stack gap="sm" h="100%">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap={6} wrap="nowrap">
                    <RankIcon size={18} color={i === 0 ? 'var(--mantine-color-brand-6)' : 'var(--mantine-color-dimmed)'} />
                    <Text fw={700} size="lg">
                      {fmtDateFull(range.date)}
                    </Text>
                  </Group>
                  {adopted && <Badge color="brand" variant="filled">已采纳</Badge>}
                </Group>
                <Text fw={700} fz="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {range.startTime} – {range.endTime}
                </Text>
                <Group gap={6}>
                  {tags.map((tag) => (
                    <Badge key={tag.label} size="sm" variant="light" color={tag.color}>
                      {tag.label}
                    </Badge>
                  ))}
                </Group>
                <Group justify="space-between" align="center" mt="auto" wrap="nowrap">
                  <RingProgress
                    size={86}
                    thickness={8}
                    roundCaps
                    sections={[{ value: Math.round(w.avgR * 100), color: 'brand', tooltip: '平均到场率' }]}
                    label={
                      <Text ta="center" fz="sm" fw={700}>
                        {Math.round(w.avgR * 100)}%
                      </Text>
                    }
                  />
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text size="xs" c="dimmed">
                      平均到场率{Math.round(w.avgR * 100)}%
                    </Text>
                    <Text size="xs" c="dimmed">
                      {scoreBreakdownText(w)}
                    </Text>
                  </Stack>
                </Group>
                {isOwner && finalizedJson == null && (
                  <Button
                    leftSection={<IconCrown size={15} />}
                    variant={i === 0 ? 'filled' : 'light'}
                    loading={busy}
                    onClick={() => onFinalize(w)}
                    fullWidth
                  >
                    采纳此方案
                  </Button>
                )}
              </Stack>
            </Card>
          )
        })}
      </SimpleGrid>
      {!isOwner && finalizedJson == null && (
        <Text size="xs" c="dimmed" ta="center">
          推荐方案由房间所有者确认定案；当前你以参与者身份查看。
        </Text>
      )}
    </Stack>
  )
}
