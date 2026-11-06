// 房间创建配置：标题 / 时长 / 日期范围（Temporal）/ 每日窗口
import { useState } from 'react'
import { Box, Button, Card, Grid, Group, RangeSlider, Slider, Stack, Text, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { api, unwrap, ApiError } from '../api/client'
import { MAX_ROOM_DAYS, type RoomDTO } from '../lib/room'
import { dateRange, todayISO } from '../lib/temporal'

interface RoomConfigFormProps {
  onCreated: (room: RoomDTO) => void
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function RoomConfigForm({ onCreated }: RoomConfigFormProps) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  const [dates, setDates] = useState<[Date | null, Date | null]>([null, null])
  const [hours, setHours] = useState<[number, number]>([8, 22])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const [start, end] = dates
    if (title.trim().length < 2) {
      notifications.show({ color: 'red', message: '请填写至少 2 个字符的房间标题。' })
      return
    }
    if (!start || !end) {
      notifications.show({ color: 'red', message: '请选择日期范围。' })
      return
    }
    const startISO = toISO(start)
    const endISO = toISO(end)
    if (startISO > endISO) {
      notifications.show({ color: 'red', message: '起始日期不能晚于结束日期。' })
      return
    }
    const days = dateRange(startISO, endISO).length
    if (days > MAX_ROOM_DAYS) {
      notifications.show({ color: 'red', message: `日期跨度最多${MAX_ROOM_DAYS}天（当前${days}天）。` })
      return
    }
    const [startHour, endHour] = hours
    if (endHour - startHour < 1 || duration > (endHour - startHour) * 60) {
      notifications.show({ color: 'red', message: '会议时长超出每日排程窗口，请扩大窗口或缩短时长。' })
      return
    }
    setSubmitting(true)
    try {
      const data = await unwrap(
        await api.rooms.post({
          title: title.trim(),
          durationMinutes: duration,
          startDate: startISO,
          endDate: endISO,
          startHour,
          endHour,
        }),
      )
      notifications.show({ color: 'brand', message: `房间「${data.room.title}」已创建` })
      onCreated(data.room)
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof ApiError ? err.message : '创建失败，请稍后重试。',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <TextInput
          label="房间标题"
          placeholder="例如：软件工程大作业每周例会"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          maxLength={50}
        />
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <DatePickerInput
              type="range"
              label="日期范围"
              placeholder="选择起止日期"
              value={dates}
              onChange={setDates}
              minDate={new Date(`${todayISO()}T00:00:00`)}
              clearable
              allowSingleDateInRange
            />
            <Text size="xs" c="dimmed" mt={4}>
              横轴将按Temporal.PlainDate展开为离散日期列
            </Text>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Text size="sm" fw={500}>
              每日排程窗口
            </Text>
            {/* pt 为拖拽浮动标签留白；pb 为轨道下方的 mark 标签留白（Mantine mark 为绝对定位，不占组件高度） */}
            <Box pt="lg" pb="xl">
              <RangeSlider
                min={0}
                max={24}
                step={1}
                minRange={1}
                value={hours}
                onChange={setHours}
                marks={[
                  { value: 0, label: '0点' },
                  { value: 8, label: '8点' },
                  { value: 12, label: '12点' },
                  { value: 18, label: '18点' },
                  { value: 24, label: '24点' },
                ]}
                label={(v) => `${v}:00`}
              />
            </Box>
            <Text size="xs" c="dimmed" mt={2}>
              纵轴按30分钟粒度离散化为槽位（Slot）
            </Text>
          </Grid.Col>
        </Grid>
        <div>
          <Text size="sm" fw={500}>
            会议时长
          </Text>
          <Box pt="lg" pb="xl">
            <Slider
              min={30}
              max={240}
              step={30}
              value={duration}
              onChange={setDuration}
              marks={[
                { value: 30, label: '30分' },
                { value: 60, label: '1时' },
                { value: 120, label: '2时' },
                { value: 180, label: '3时' },
                { value: 240, label: '4时' },
              ]}
              label={(v) => `${v}分钟`}
            />
          </Box>
        </div>
        <Group justify="flex-end">
          <Button loading={submitting} onClick={() => void handleSubmit()}>
            创建协同房间
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
