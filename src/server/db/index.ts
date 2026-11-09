// SQLite 连接与建库（Bun 原生 SQLite 驱动 + Drizzle ORM）
import { mkdirSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const DB_PATH = process.env.DB_PATH ?? 'data/synchro.db'

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  register_ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_hour INTEGER NOT NULL DEFAULT 8,
  end_hour INTEGER NOT NULL DEFAULT 22,
  finalized_slot TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  availability_mask TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
`

export function initDb() {
  const dir = DB_PATH.split('/').slice(0, -1).join('/')
  if (dir) mkdirSync(dir, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec(DDL)
  // 存量库迁移：users.register_ip（SQLite 的 ALTER TABLE 无 IF NOT EXISTS，先探测列）
  const userCols = sqlite.query('PRAGMA table_info(users)').all() as Array<{ name: string }>
  if (!userCols.some((c) => c.name === 'register_ip')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN register_ip TEXT')
  }
  return drizzle(sqlite, { schema })
}

export const db = initDb()
