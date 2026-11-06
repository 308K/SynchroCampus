// 群通知 Markdown 生成（一键复制粘贴至微信群 / QQ 群）
import { Temporal, fmtDateFull } from './temporal'
import type { FinalizedSlot, RoomDTO } from './room'

export function buildNoticeMarkdown(
  room: RoomDTO,
  slot: FinalizedSlot,
  participantNames: string[],
): string {
  const date = fmtDateFull(Temporal.PlainDate.from(slot.date))
  const names = participantNames.length > 0 ? participantNames.join('、') : '全体群成员'
  return [
    `## 🗓️「${room.title}」时间定案通知`,
    '',
    `经全员空闲时段碰撞协商，本次安排最终定案如下：`,
    '',
    `- **时间**：${date} ${slot.startTime} – ${slot.endTime}（北京时间）`,
    `- **时长**：${room.durationMinutes} 分钟`,
    `- **参与**：${participantNames.length} 人（${names}）`,
    '- **提醒**：已内置日历提醒，将提前 15 分钟提示就位',
    '',
    '> 请各位把该时段加入个人日历；如临时有事，请尽快在群内发起改期。',
    '> —— 本通知由「序时 SynchroCampus」群体日程自协同智能体自动生成',
  ].join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
