// Elysia 2 API 接口契约
// 依据《SynchroCampus 需求规格说明书》§4.2，并补充前端渲染所需的读取接口与演示模式
// Elysia 2 约定：schema 位于 handler 之前（.post(path, schema, handler)）
// 使用 status() 辅助返回错误，保证 Eden 全链路类型精确（data 仅含成功形态）
import { Elysia, t, status } from 'elysia'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { Temporal } from 'temporal-polyfill'
import { db } from './db'
import { participants, rooms, users, type RoomRow } from './db/schema'
import { clientIp, currentUser, type AuthUser } from './auth'
import { signJwt } from './jwt'
import { verifyTurnstileToken } from './turnstile'
import { DEMO_ROOM_ID, DEMO_USER_ID, DEMO_USERNAME, ensureDemoData, resetDemoData } from './demo'

/** 受保护表面的稳定 action（与前端 TurnstileWidget 的 action 一一对应） */
const TURNSTILE_ACTIONS = { register: 'signup', login: 'login' } as const

const MAX_ROOM_DAYS = 14
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MASK_RE = /^[012]+$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type Headers = Record<string, string | undefined>
type ErrStatus = 400 | 401 | 403 | 404 | 409 | 503

function err(code: ErrStatus, message: string) {
  return status(code, { error: message })
}

function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  try {
    Temporal.PlainDate.from(value)
    return true
  } catch {
    return false
  }
}

function roomGeometry(room: { startDate: string; endDate: string; startHour: number; endHour: number }) {
  const start = Temporal.PlainDate.from(room.startDate)
  const end = Temporal.PlainDate.from(room.endDate)
  const days = start.until(end).days + 1
  const slotsPerDay = (room.endHour - room.startHour) * 2
  return { days, slotsPerDay, totalSlots: days * slotsPerDay }
}

function publicRoom(row: RoomRow) {
  return {
    id: row.id,
    title: row.title,
    durationMinutes: row.durationMinutes,
    startDate: row.startDate,
    endDate: row.endDate,
    startHour: row.startHour,
    endHour: row.endHour,
    finalizedSlot: row.finalizedSlot,
    createdAt: row.createdAt,
  }
}

function issueToken(user: AuthUser): Promise<string> {
  return signJwt({ sub: user.id, username: user.username })
}

export const app = new Elysia({ prefix: '/api' })
  .derive(async ({ headers }) => ({ user: await currentUser(headers as Headers) }))

  .get('/health', () => ({ ok: true }))

  // 1. 用户注册（带 Turnstile 验证）
  .post(
    '/auth/register',
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 20 }),
        password: t.String({ minLength: 6, maxLength: 32 }),
        turnstileToken: t.String(),
      }),
    },
    async ({ body, headers }) => {
      const verdict = await verifyTurnstileToken({
        token: body.turnstileToken,
        action: TURNSTILE_ACTIONS.register,
        remoteIp: clientIp(headers as Headers),
      })
      if (!verdict.ok) return err(verdict.status, verdict.message)
      const existing = db.select().from(users).where(eq(users.username, body.username)).get()
      if (existing) return err(409, '用户名已被注册，请换一个试试。')
      const passwordHash = await Bun.password.hash(body.password, { algorithm: 'argon2id' })
      const id = nanoid(12)
      db.insert(users)
        .values({
          id,
          username: body.username,
          passwordHash,
          registerIp: clientIp(headers as Headers) ?? null,
          createdAt: new Date(),
        })
        .run()
      const token = await issueToken({ id, username: body.username })
      return { token, user: { id, username: body.username } }
    },
  )

  // 2. 用户登录（带 Turnstile 验证）
  .post(
    '/auth/login',
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        turnstileToken: t.String(),
      }),
    },
    async ({ body, headers }) => {
      const verdict = await verifyTurnstileToken({
        token: body.turnstileToken,
        action: TURNSTILE_ACTIONS.login,
        remoteIp: clientIp(headers as Headers),
      })
      if (!verdict.ok) return err(verdict.status, verdict.message)
      const user = db.select().from(users).where(eq(users.username, body.username)).get()
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        return err(401, '用户名或密码错误。')
      }
      const token = await issueToken({ id: user.id, username: user.username })
      return { token, user: { id: user.id, username: user.username } }
    },
  )

  // 当前登录态校验（前端恢复会话用）
  .get('/auth/me', ({ user }) => {
    if (!user) return err(401, '未登录或会话已过期。')
    return { user: { id: user.id, username: user.username } }
  })

  // 演示模式：免登录进入示例房间（签发演示房主会话）
  .post('/demo/enter', async () => {
    ensureDemoData()
    const token = await issueToken({ id: DEMO_USER_ID, username: DEMO_USERNAME })
    return { token, roomId: DEMO_ROOM_ID, username: DEMO_USERNAME }
  })

  // 演示模式：重置示例数据（仅演示会话）
  .post('/demo/reset', ({ user }) => {
    if (!user || user.id !== DEMO_USER_ID) return err(403, '仅演示会话可重置演示数据。')
    resetDemoData()
    return { ok: true }
  })

  // 3. 房间创建
  .post(
    '/rooms',
    {
      body: t.Object({
        title: t.String({ minLength: 2, maxLength: 50 }),
        durationMinutes: t.Number({ minimum: 30, maximum: 240 }),
        startDate: t.String(),
        endDate: t.String(),
        startHour: t.Number({ minimum: 0, maximum: 23 }),
        endHour: t.Number({ minimum: 1, maximum: 24 }),
      }),
    },
    ({ body, user }) => {
      if (!user) return err(401, '请先登录后再创建房间。')
      if (user.id === DEMO_USER_ID) return err(403, '演示会话仅操作演示房间，请注册正式账号创建房间。')
      if (!isIsoDate(body.startDate) || !isIsoDate(body.endDate)) {
        return err(400, '起止日期必须为合法的YYYY-MM-DD格式。')
      }
      if (body.startDate > body.endDate) return err(400, '起始日期不能晚于结束日期。')
      const { days } = roomGeometry(body)
      if (days > MAX_ROOM_DAYS) return err(400, `日期跨度最多${MAX_ROOM_DAYS}天（当前${days}天）。`)
      if (body.startHour >= body.endHour) return err(400, '每日时段的结束小时必须大于起始小时。')
      if (body.durationMinutes % 30 !== 0) return err(400, '会议时长必须为30分钟的整数倍。')
      if (body.durationMinutes > (body.endHour - body.startHour) * 60) {
        return err(400, '会议时长不能超过每日排程窗口。')
      }
      const row = {
        id: nanoid(8),
        ownerId: user.id,
        title: body.title,
        durationMinutes: body.durationMinutes,
        startDate: body.startDate,
        endDate: body.endDate,
        startHour: body.startHour,
        endHour: body.endHour,
        finalizedSlot: null,
        createdAt: new Date(),
      }
      db.insert(rooms).values(row).run()
      return { room: { ...publicRoom(row as RoomRow), createdAt: row.createdAt } }
    },
  )

  // 我创建的房间列表
  .get('/rooms', ({ user }) => {
    if (!user) return err(401, '请先登录。')
    const list = db
      .select()
      .from(rooms)
      .where(eq(rooms.ownerId, user.id))
      .orderBy(desc(rooms.createdAt))
      .all()
    const counts = new Map(
      db
        .select({ roomId: participants.roomId, count: sql<number>`count(*)`.as('count') })
        .from(participants)
        .groupBy(participants.roomId)
        .all()
        .map((r) => [r.roomId, Number(r.count)]),
    )
    return {
      rooms: list.map((row) => ({
        ...publicRoom(row),
        participantCount: counts.get(row.id) ?? 0,
      })),
    }
  })

  // 房间详情（含全员时间掩码，用于热力图与决策引擎）
  .get(
    '/rooms/:id',
    { params: t.Object({ id: t.String() }) },
    ({ params: { id }, user }) => {
      const room = db.select().from(rooms).where(eq(rooms.id, id)).get()
      if (!room) return err(404, '房间不存在，请检查邀请链接是否正确。')
      const parts = db
        .select()
        .from(participants)
        .where(eq(participants.roomId, id))
        .orderBy(asc(participants.updatedAt))
        .all()
      return {
        room: publicRoom(room),
        participants: parts.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          availabilityMask: p.availabilityMask,
          isSelf: Boolean(user && user.id === p.userId),
        })),
        isOwner: Boolean(user && user.id === room.ownerId),
      }
    },
  )

  // 4. 提交/更新个人时间掩码
  .post(
    '/rooms/:id/availability',
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        nickname: t.String({ minLength: 1, maxLength: 20 }),
        availabilityMask: t.String(),
      }),
    },
    ({ params: { id }, body, user }) => {
      const room = db.select().from(rooms).where(eq(rooms.id, id)).get()
      if (!room) return err(404, '房间不存在。')
      if (room.finalizedSlot) return err(403, '房间已定案锁定，无法再修改时间。')
      const { totalSlots } = roomGeometry(room)
      if (!MASK_RE.test(body.availabilityMask) || body.availabilityMask.length !== totalSlots) {
        return err(400, `时间掩码格式非法：应为长度${totalSlots}、仅含0/1/2的字符串。`)
      }
      const now = new Date()
      const existing = user
        ? db
            .select()
            .from(participants)
            .where(and(eq(participants.roomId, id), eq(participants.userId, user.id)))
            .get()
        : db
            .select()
            .from(participants)
            .where(
              and(eq(participants.roomId, id), isNull(participants.userId), eq(participants.nickname, body.nickname)),
            )
            .get()

      if (existing) {
        db.update(participants)
          .set({ nickname: body.nickname, availabilityMask: body.availabilityMask, updatedAt: now })
          .where(eq(participants.id, existing.id))
          .run()
        return {
          participant: { id: existing.id, nickname: body.nickname, availabilityMask: body.availabilityMask },
        }
      }
      const pid = nanoid(12)
      db.insert(participants)
        .values({
          id: pid,
          roomId: id,
          userId: user?.id ?? null,
          nickname: body.nickname,
          availabilityMask: body.availabilityMask,
          updatedAt: now,
        })
        .run()
      return { participant: { id: pid, nickname: body.nickname, availabilityMask: body.availabilityMask } }
    },
  )

  // 5. 房主定案锁定
  .post(
    '/rooms/:id/finalize',
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ selectedSlot: t.String() }),
    },
    ({ params: { id }, body, user }) => {
      const room = db.select().from(rooms).where(eq(rooms.id, id)).get()
      if (!room) return err(404, '房间不存在。')
      if (!user || user.id !== room.ownerId) return err(403, '仅房主可以定案。')
      if (room.finalizedSlot) return err(409, '房间已定案，无需重复操作。')
      let slot: { date: string; startTime: string; endTime: string }
      try {
        slot = JSON.parse(body.selectedSlot)
      } catch {
        return err(400, '定案时段JSON解析失败。')
      }
      if (
        !isIsoDate(slot.date) ||
        !TIME_RE.test(slot.startTime) ||
        !TIME_RE.test(slot.endTime) ||
        slot.startTime >= slot.endTime
      ) {
        return err(400, '定案时段参数非法（需要YYYY-MM-DD与HH:MM，且结束晚于开始）。')
      }
      if (slot.date < room.startDate || slot.date > room.endDate) {
        return err(400, '定案日期超出房间日期范围。')
      }
      const toMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))
      const startMin = toMinutes(slot.startTime)
      const endMin = toMinutes(slot.endTime)
      if (startMin % 30 !== 0 || endMin % 30 !== 0) {
        return err(400, '定案时段必须与30分钟槽位对齐。')
      }
      if (startMin < room.startHour * 60 || endMin > room.endHour * 60) {
        return err(400, '定案时段超出每日排程窗口。')
      }
      if (endMin - startMin !== room.durationMinutes) {
        return err(400, `定案时长应等于会议时长（${room.durationMinutes}分钟）。`)
      }
      const normalized = JSON.stringify({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })
      db.update(rooms).set({ finalizedSlot: normalized }).where(eq(rooms.id, id)).run()
      return { room: { ...publicRoom(room), finalizedSlot: normalized } }
    },
  )

export type App = typeof app
