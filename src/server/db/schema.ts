// 数据库模式（Drizzle ORM + SQLite）
// 依据《SynchroCampus 需求规格说明书》§4.1
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  // 注册时的客户端 IP（合规审计用；经 CF 时为 CF-Connecting-IP/X-Forwarded-For 首段）
  registerIp: text('register_ip'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), // NanoID 短码
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  startDate: text('start_date').notNull(), // ISO-8601 日期: YYYY-MM-DD
  endDate: text('end_date').notNull(), // ISO-8601 日期: YYYY-MM-DD
  startHour: integer('start_hour').notNull().default(8),
  endHour: integer('end_hour').notNull().default(22),
  finalizedSlot: text('finalized_slot'), // 定案时段描述 JSON 字符串
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  nickname: text('nickname').notNull(),
  // 离散时空槽位掩码（0:忙碌, 1:空闲, 2:勉强）
  availabilityMask: text('availability_mask').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// 已吊销令牌黑名单（审计 M-01）：登出时把当前 JWT 的 jti 写入，
// currentUser 命中即拒绝。只存被吊销的 jti（非全量会话表），fail-open：
// 查无记录放行，历史令牌（无 jti）与部署重启不受影响
export const revokedSessions = sqliteTable('revoked_sessions', {
  jti: text('jti').primaryKey(),
  userId: text('user_id').notNull(),
  // 令牌自身的 exp 过期时间；过期后黑名单条目即无意义（可被登出时的顺手清理删除）
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }).notNull(),
})

export type UserRow = typeof users.$inferSelect
export type RoomRow = typeof rooms.$inferSelect
export type ParticipantRow = typeof participants.$inferSelect
