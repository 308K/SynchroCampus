// 演示模式：免登录示例房间种子数据（滚动日期 + 幂等注入）
import { eq } from 'drizzle-orm'
import { Temporal } from 'temporal-polyfill'
import { db } from './db'
import { participants, rooms, users } from './db/schema'
import { generateMockMask, MOCK_NAMES } from '../shared/mock'

export const DEMO_USER_ID = 'demo-owner'
export const DEMO_USERNAME = '演示房主'
export const DEMO_ROOM_ID = 'demo'

const DEMO_ROOM = {
  title: '演示房间·社团例会排期',
  durationMinutes: 90,
  startHour: 8,
  endHour: 22,
  spanDays: 7,
}

function seedParticipants(roomId: string, startDate: string): void {
  const start = Temporal.PlainDate.from(startDate)
  const days = DEMO_ROOM.spanDays
  const slotsPerDay = (DEMO_ROOM.endHour - DEMO_ROOM.startHour) * 2
  const now = new Date()
  MOCK_NAMES.forEach((name, i) => {
    db.insert(participants)
      .values({
        id: `demo-p${i}`,
        roomId,
        userId: null,
        nickname: name,
        availabilityMask: generateMockMask(
          { startHour: DEMO_ROOM.startHour, days, slotsPerDay },
          `${roomId}:${name}`,
        ),
        updatedAt: now,
      })
      .run()
  })
  void start
}

/** 确保演示数据存在；日期过期或已定案时滚动重置 */
export function ensureDemoData(): void {
  const today = Temporal.Now.plainDateISO().toString()
  const endDate = Temporal.PlainDate.from(today).add({ days: DEMO_ROOM.spanDays - 1 }).toString()

  const user = db.select().from(users).where(eq(users.id, DEMO_USER_ID)).get()
  if (!user) {
    db.insert(users)
      .values({
        id: DEMO_USER_ID,
        username: DEMO_USERNAME,
        passwordHash: 'demo-account-not-password-login',
        createdAt: new Date(),
      })
      .run()
  }

  let room = db.select().from(rooms).where(eq(rooms.id, DEMO_ROOM_ID)).get()
  if (!room) {
    db.insert(rooms)
      .values({
        id: DEMO_ROOM_ID,
        ownerId: DEMO_USER_ID,
        title: DEMO_ROOM.title,
        durationMinutes: DEMO_ROOM.durationMinutes,
        startDate: today,
        endDate,
        startHour: DEMO_ROOM.startHour,
        endHour: DEMO_ROOM.endHour,
        finalizedSlot: null,
        createdAt: new Date(),
      })
      .run()
    seedParticipants(DEMO_ROOM_ID, today)
    return
  }

  const count = db.select().from(participants).where(eq(participants.roomId, DEMO_ROOM_ID)).all().length
  const stale = room.startDate !== today || room.finalizedSlot != null
  if (stale) {
    db.delete(participants).where(eq(participants.roomId, DEMO_ROOM_ID)).run()
    db.update(rooms)
      .set({ startDate: today, endDate, finalizedSlot: null })
      .where(eq(rooms.id, DEMO_ROOM_ID))
      .run()
    seedParticipants(DEMO_ROOM_ID, today)
  } else if (count === 0) {
    seedParticipants(DEMO_ROOM_ID, room.startDate)
  }
}

/** 演示会话手动重置：清空涂抹与定案，重新注入示例数据 */
export function resetDemoData(): void {
  db.delete(participants).where(eq(participants.roomId, DEMO_ROOM_ID)).run()
  const today = Temporal.Now.plainDateISO().toString()
  const endDate = Temporal.PlainDate.from(today).add({ days: DEMO_ROOM.spanDays - 1 }).toString()
  db.update(rooms)
    .set({ startDate: today, endDate, finalizedSlot: null })
    .where(eq(rooms.id, DEMO_ROOM_ID))
    .run()
  seedParticipants(DEMO_ROOM_ID, today)
}
