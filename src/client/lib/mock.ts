// 客户端 Mock 注入包装：复用共享生成器（与服务端演示种子同一算法）
import { generateMockMask as gen, MOCK_NAMES as names } from '../../shared/mock'
import { daysOf, slotsPerDay, type RoomDTO } from './room'

export const MOCK_NAMES = names

export function generateMockMask(room: RoomDTO, seedKey: string): string {
  return gen({ startHour: room.startHour, days: daysOf(room), slotsPerDay: slotsPerDay(room) }, seedKey)
}
