// 房间时空几何：离散槽位（Slot）建模
import { dateRange, fmtTime, type PlainDate } from './temporal'

export const MAX_ROOM_DAYS = 14

export interface RoomDTO {
  id: string
  title: string
  durationMinutes: number
  startDate: string
  endDate: string
  startHour: number
  endHour: number
  finalizedSlot: string | null
}

export interface ParticipantDTO {
  id: string
  nickname: string
  availabilityMask: string
  isSelf?: boolean
}

export interface FinalizedSlot {
  date: string
  startTime: string
  endTime: string
}

export interface ScoredWindow {
  dayIndex: number
  startSlot: number
  slotCount: number
  score: number
  avgR: number
  mealPenalty: boolean
  latePenalty: boolean
  contigBonus: number
}

export function datesOf(room: RoomDTO): PlainDate[] {
  return dateRange(room.startDate, room.endDate)
}

export function daysOf(room: RoomDTO): number {
  return datesOf(room).length
}

export function slotsPerDay(room: RoomDTO): number {
  return (room.endHour - room.startHour) * 2
}

export function totalSlots(room: RoomDTO): number {
  return slotsPerDay(room) * daysOf(room)
}

/** 槽位索引 → 当日分钟数（自 00:00 计） */
export function slotMinutes(room: RoomDTO, slotIndex: number): number {
  return room.startHour * 60 + slotIndex * 30
}

export function slotLabel(room: RoomDTO, slotIndex: number): string {
  return fmtTime(slotMinutes(room, slotIndex))
}

/** 全局槽位索引 → (天序号, 当日槽序号) */
export function locateSlot(room: RoomDTO, globalIndex: number): { dayIndex: number; daySlot: number } {
  const spd = slotsPerDay(room)
  return { dayIndex: Math.floor(globalIndex / spd), daySlot: globalIndex % spd }
}

/** 推荐窗口 → 人类可读时间范围 */
export function windowRange(
  room: RoomDTO,
  dayIndex: number,
  startSlot: number,
  count: number,
): { date: PlainDate; startTime: string; endTime: string } {
  const date = datesOf(room)[dayIndex]
  const startMin = slotMinutes(room, startSlot)
  return {
    date,
    startTime: fmtTime(startMin),
    endTime: fmtTime(startMin + count * 30),
  }
}

export function parseFinalized(json: string | null | undefined): FinalizedSlot | null {
  if (!json) return null
  try {
    const v = JSON.parse(json) as FinalizedSlot
    if (typeof v.date === 'string' && typeof v.startTime === 'string' && typeof v.endTime === 'string') return v
    return null
  } catch {
    return null
  }
}
