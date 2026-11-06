// 核心 2D 手势拖拽涂抹网格：记录个人三态时空偏好（0 忙碌 / 1 空闲 / 2 勉强）
// 桌面：鼠标按住连续划选；移动端：触控涂抹（touch-action: none + elementFromPoint 命中检测）
import { useRef, useState } from 'react'
import { Box, Button, Group, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core'
import { IconEraser } from '@tabler/icons-react'
import { SlotGrid } from './SlotGrid'
import type { RoomDTO } from '../lib/room'

interface TimeSlotPainterProps {
  room: RoomDTO
  mask: number[]
  onMaskChange: (next: number[]) => void
  locked?: boolean
}

const BRUSHES = [
  { value: '1', label: '空闲', hint: '完全有空' },
  { value: '2', label: '勉强', hint: '可调课让步' },
  { value: '0', label: '忙碌', hint: '有课/有事' },
]

const cellClass = (v: number) =>
  v === 1 ? 'sc-cell sc-cell--available' : v === 2 ? 'sc-cell sc-cell--tentative' : 'sc-cell sc-cell--busy'

export function TimeSlotPainter({ room, mask, onMaskChange, locked }: TimeSlotPainterProps) {
  const [brush, setBrush] = useState('1')
  const paintingRef = useRef(false)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const paintIndex = (idx: number) => {
    const value = Number(brush)
    if (mask[idx] === value) return
    const next = [...mask]
    next[idx] = value
    onMaskChange(next)
  }

  const cellFromPoint = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y)
    return el ? (el.closest<HTMLElement>('[data-slot]') ?? null) : null
  }

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (locked) return
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]')
    if (!target) return
    paintingRef.current = true
    try {
      gridRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* 某些浏览器在被动事件下不允许捕获 */
    }
    paintIndex(Number(target.dataset.slot))
  }

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!paintingRef.current || locked) return
    const target = cellFromPoint(e.clientX, e.clientY)
    if (target) paintIndex(Number(target.dataset.slot))
  }

  const stopPainting = () => {
    paintingRef.current = false
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <SegmentedControl
          value={brush}
          onChange={setBrush}
          data={BRUSHES.map((b) => ({
            value: b.value,
            label: (
              <Group gap={6} wrap="nowrap">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    display: 'inline-block',
                    background:
                      b.value === '1'
                        ? 'var(--sc-brand-5)'
                        : b.value === '2'
                          ? 'var(--sc-amber-2)'
                          : 'var(--mantine-color-gray-4)',
                  }}
                />
                {b.label}
              </Group>
            ),
          }))}
        />
        <Tooltip label="全部重置为忙碌">
          <Button
            size="compact-sm"
            variant="light"
            color="gray"
            leftSection={<IconEraser size={14} />}
            onClick={() => onMaskChange(mask.map(() => 0))}
            disabled={locked}
          >
            清空
          </Button>
        </Tooltip>
      </Group>

      <Box>
        <SlotGrid
          room={room}
          paintable={!locked}
          gridRef={gridRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPainting}
          onPointerCancel={stopPainting}
          renderCell={(_di, _s, maskIndex) => (
            <div
              data-slot={maskIndex}
              className={locked ? `sc-cell ${cellClass(mask[maskIndex]).replace('sc-cell', 'sc-cell')}` : `${cellClass(mask[maskIndex])} sc-cell--paint`}
              style={locked ? { cursor: 'not-allowed' } : undefined}
            />
          )}
        />
      </Box>

      <Text size="xs" c="dimmed">
        按住鼠标或手指拖动即可连续涂抹；当前画刷「
        {BRUSHES.find((b) => b.value === brush)?.label}」（{BRUSHES.find((b) => b.value === brush)?.hint}
        ），槽位粒度 30 分钟。
      </Text>
    </Stack>
  )
}
