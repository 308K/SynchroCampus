// 定案面板：.ics 日历导出 + Markdown 通告一键复制
import { Badge, Button, CopyButton, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCalendarDown, IconClipboardText } from '@tabler/icons-react'
import { buildIcs, downloadIcs } from '../lib/ics'
import { buildNoticeMarkdown } from '../lib/notice'
import { Temporal, fmtDateFull } from '../lib/temporal'
import type { FinalizedSlot, ParticipantDTO, RoomDTO } from '../lib/room'

interface FinalizedPanelProps {
  room: RoomDTO
  slot: FinalizedSlot
  participants: ParticipantDTO[]
  inviteLink: string
}

export function FinalizedPanel({ room, slot, participants, inviteLink }: FinalizedPanelProps) {
  const date = Temporal.PlainDate.from(slot.date)
  const names = participants.map((p) => p.nickname)
  const icsContent = buildIcs({
    uid: `${room.id}-${slot.date}-${slot.startTime.replace(':', '')}@synchrocampus`,
    title: room.title,
    description: `由「序时 SynchroCampus」群体日程自协同智能体定案 · 参与人：${names.join('、')} · 房间：${inviteLink}`,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    alarmMinutes: 15,
  })
  const notice = buildNoticeMarkdown(room, slot, names)

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={2}>
          <Text fw={700} fz="lg">
            {fmtDateFull(date)} {slot.startTime} – {slot.endTime}
          </Text>
          <Text size="xs" c="dimmed">
            时区 Asia/Shanghai · 内置提前 15 分钟提醒
          </Text>
        </Stack>
        <Badge color="brand" variant="light" size="lg">
          {room.durationMinutes} 分钟
        </Badge>
      </Group>
      <Group gap="sm">
        <Button
          leftSection={<IconCalendarDown size={16} />}
          onClick={() => downloadIcs(`synchrocampus-${room.id}.ics`, icsContent)}
        >
          下载日历（.ics）
        </Button>
        <CopyButton value={notice} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? '已复制' : '复制群通告 Markdown'}>
              <Button variant="light" leftSection={<IconClipboardText size={16} />} onClick={copy}>
                {copied ? '已复制' : '复制群通告'}
              </Button>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Text size="xs" c="dimmed">
        .ics 为 RFC 5545 标准格式，点击即可唤起 Apple Calendar、Google Calendar、华为/小米日历；通告文本可直接粘贴至微信或
        QQ 群。
      </Text>
    </Stack>
  )
}
