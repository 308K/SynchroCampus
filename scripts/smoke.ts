// 端到端业务流冒烟测试：直接注入测试用户（绕过 Turnstile 环节），走完整 API 生命周期
// 用法：bun scripts/smoke.ts（需 API 已在 :3001 运行）
import { eq } from 'drizzle-orm'
import { db } from '../src/server/db'
import { users, rooms } from '../src/server/db/schema'
import { signJwt, getJwtSecret } from '../src/server/jwt'

const BASE = 'http://localhost:3001/api'
let failures = 0

function check(name: string, ok: boolean, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL'
  if (!ok) failures++
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const stamp = Date.now().toString(36)
  const username = `smoke_${stamp}`
  const uid = `smoke_${stamp}`

  // 0) 直注测试用户 + 签发 JWT
  const passwordHash = await Bun.password.hash('test123456', { algorithm: 'argon2id' })
  db.insert(users).values({ id: uid, username, passwordHash, createdAt: new Date() }).run()
  const token = await signJwt({ sub: uid, username }, getJwtSecret())
  const authHeaders = { 'content-type': 'application/json', authorization: `Bearer ${token}` }

  try {
    // 1) 健康检查
    const health = await fetch(`${BASE}/health`).then((r) => r.json())
    check('GET /health', health.ok === true)

    // 2) 密码校验（argon2id verify）
    const stored = db.select().from(users).where(eq(users.id, uid)).get()
    check('argon2id 密码哈希与校验', stored ? await Bun.password.verify('test123456', stored.passwordHash) : false)

    // 3) 创建房间（2026-11-09 ~ 10 两天 × 8–22 点 → 56 槽位）
    const roomRes = await fetch(`${BASE}/rooms`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: '冒烟测试房间',
        durationMinutes: 60,
        startDate: '2026-11-09',
        endDate: '2026-11-10',
        startHour: 8,
        endHour: 22,
      }),
    })
    const room = (await roomRes.json()) as { room: { id: string } }
    check('POST /rooms 创建房间', roomRes.status === 200 && !!room.room?.id, `roomId=${room.room?.id}`)
    const roomId = room.room.id

    // 4) 匿名成员 A 提交掩码（空闲：第 1 天 19:00-21:00 → day0 slot 22-25 = 索引 22..25）
    const maskA = '0'.repeat(56).split('').map((_, i) => (i >= 22 && i < 26 ? '1' : '0')).join('')
    const availA = await fetch(`${BASE}/rooms/${roomId}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·小A', availabilityMask: maskA }),
    })
    check('POST availability 成员A', availA.status === 200)

    // 5) 匿名成员 B 提交掩码（勉强：同时段 → 索引 22..25 = 2）
    const maskB = '0'.repeat(56).split('').map((_, i) => (i >= 22 && i < 26 ? '2' : '1')).join('')
    const availB = await fetch(`${BASE}/rooms/${roomId}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·小B', availabilityMask: maskB }),
    })
    check('POST availability 成员B', availB.status === 200)

    // 6) 房间详情：参与者与 isOwner
    const detail = (await fetch(`${BASE}/rooms/${roomId}`).then((r) => r.json())) as {
      room: { finalizedSlot: string | null; startHour: number }
      participants: Array<{ nickname: string; availabilityMask: string }>
      isOwner: boolean
    }
    check(
      'GET /rooms/:id 参与者聚合',
      detail.participants.length === 2 && detail.participants.every((p) => p.availabilityMask.length === 56),
      `participants=${detail.participants.length}`,
    )
    check('GET /rooms/:id isOwner=false（无凭据）', detail.isOwner === false)

    // 7) 错误掩码被拒（长度不符）
    const badMask = await fetch(`${BASE}/rooms/${roomId}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·坏数据', availabilityMask: '0011' }),
    })
    check('availability 非法掩码被拒（400）', badMask.status === 400)

    // 8) 房主定案（选 2026-11-09 19:00–20:00）
    const fin = await fetch(`${BASE}/rooms/${roomId}/finalize`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        selectedSlot: JSON.stringify({ date: '2026-11-09', startTime: '19:00', endTime: '20:00' }),
      }),
    })
    const finBody = (await fin.json()) as { room?: { finalizedSlot: string } }
    check('POST finalize 房主定案', fin.status === 200 && !!finBody.room?.finalizedSlot?.includes('19:00'))

    // 9) 定案后拒绝继续修改掩码
    const locked = await fetch(`${BASE}/rooms/${roomId}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·迟到', availabilityMask: maskA }),
    })
    check('定案后掩码提交被拒（403）', locked.status === 403)

    // 10) 非房主不能定案
    const anonFin = await fetch(`${BASE}/rooms/${roomId}/finalize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selectedSlot: '{"date":"2026-11-09","startTime":"19:00","endTime":"20:00"}' }),
    })
    check('匿名用户定案被拒（403）', anonFin.status === 403)

    // 11) Turnstile 缺失 secret 的注册被拒（503）
    const ts = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'someone', password: 'secret123', turnstileToken: 'dummy' }),
    })
    check('未配置 TURNSTILE_SECRET 时注册返回引导（503）', ts.status === 503)
  } finally {
    // 清理：删除测试用户（级联清理其房间与参与者）
    db.delete(rooms).where(eq(rooms.ownerId, uid)).run()
    db.delete(users).where(eq(users.id, uid)).run()
    console.log('[cleanup] 冒烟测试数据已清理')
  }

  console.log(failures === 0 ? '\n全部通过 ✅' : `\n${failures} 项失败 ❌`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
