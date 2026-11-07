// OKLCH 动态知觉热力图 + 人员浮层透视
import { useMemo, useState, type CSSProperties } from 'react'
import { Badge, Box, Divider, Group, Popover, Stack, Text, useComputedColorScheme } from '@mantine/core'
import { SlotGrid } from './SlotGrid'
import { availabilityRatios, slotCensus } from '../lib/mask'
import { heatComponents, heatGradient, neutralHeat } from '../lib/oklch'
import { datesOf, slotsPerDay, slotLabel, totalSlots, type ParticipantDTO, type RoomDTO } from '../lib/room'
import { fmtDateLabel } from '../lib/temporal'

interface HeatmapBoardProps {
  room: RoomDTO
  participants: ParticipantDTO[]
  myNickname?: string
}

function NameBadges({ names, color, highlight }: { names: string[]; color: string; highlight?: string }) {
  return (
    <Group gap={4} mt={2}>
      {names.map((n) => (
        <Badge key={n} size="sm" variant="light" color={color} fw={n === highlight ? 700 : 400}>
          {n}
        </Badge>
      ))}
    </Group>
  )
}

export function HeatmapBoard({ room, participants, myNickname }: HeatmapBoardProps) {
  // useComputedColorScheme 解析 auto 为实际生效值（跟随系统时 colorScheme 字面量不可判断）
  const dark = useComputedColorScheme() === 'dark'
  const [active, setActive] = useState<number | null>(null)
  const spd = slotsPerDay(room)
  const days = datesOf(room)
  const R = useMemo(() => availabilityRatios(participants, totalSlots(room)), [participants, room])

  const cellStyle = (r: number): CSSProperties => {
    const comp = participants.length ? heatComponents(r, dark) : neutralHeat(dark)
    return { '--cell-l': String(comp.l), '--cell-c': String(comp.c), '--cell-h': String(comp.h) } as CSSProperties
  }

  return (
    <Stack gap="sm">
      <Box>
        <SlotGrid
          room={room}
          renderCell={(di, s, maskIndex) => {
            const day = days[di]
            const label = `${fmtDateLabel(day)} ${slotLabel(room, s)}`
            const census = participants.length ? slotCensus(participants, maskIndex) : null
            const cell = (
              <div
                className="sc-cell heatmap-cell"
                style={cellStyle(R[maskIndex] ?? 0)}
                onClick={() => setActive(active === maskIndex ? null : maskIndex)}
              />
            )
            if (active !== maskIndex || !census) return cell
            return (
              <Popover opened position="bottom" withinPortal withArrow shadow="md" onChange={(o) => { if (!o) setActive(null) }}>
                <Popover.Target>{cell}</Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs" miw={210}>
                    <Text size="sm" fw={700}>
                      {label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      综合空闲率{((R[maskIndex] ?? 0) * 100).toFixed(0)}%
                    </Text>
                    <Divider my={2} />
                    {census.available.length > 0 && (
                      <div>
                        <Text size="xs" c="brand" fw={600}>
                          空闲（{census.available.length}）
                        </Text>
                        <NameBadges names={census.available} color="brand" highlight={myNickname} />
                      </div>
                    )}
                    {census.tentative.length > 0 && (
                      <div>
                        <Text size="xs" c="orange" fw={600}>
                          勉强（{census.tentative.length}）
                        </Text>
                        <NameBadges names={census.tentative} color="orange" highlight={myNickname} />
                      </div>
                    )}
                    {census.busy.length > 0 && (
                      <div>
                        <Text size="xs" c="dimmed" fw={600}>
                          冲突（{census.busy.length}）
                        </Text>
                        <NameBadges names={census.busy} color="gray" highlight={myNickname} />
                      </div>
                    )}
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            )
          }}
        />
      </Box>

      <Group justify="space-between" gap="md" wrap="wrap">
        <Group gap="sm">
          <div style={{ width: 160, height: 12, borderRadius: 6, background: heatGradient(dark) }} />
          <Text size="xs" c="dimmed">
            无人空闲→全员有空（OKLCH色阶）
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          在场{participants.length}人，点击格子查看人员透视，每8秒自动同步
        </Text>
      </Group>
    </Stack>
  )
}
