// 端到端业务流冒烟测试：直接注入测试用户（绕过 Turnstile 环节），走完整 API 生命周期
// 用法：bun scripts/smoke.ts（需 API 已在 :3001 运行）
import { eq } from 'drizzle-orm'
import { db } from '../src/server/db'
import { users, rooms } from '../src/server/db/schema'
import { signJwt } from '../src/server/jwt'

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
  const token = await signJwt({ sub: uid, username })
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

    // 11) Turnstile 校验闭环：
    //     未配置 secret → 503 引导；已配置 secret → 假 token 被 siteverify 拒绝（403）
    const ts = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'someone', password: 'secret123', turnstileToken: 'dummy' }),
    })
    const secretConfigured = Boolean(process.env.TURNSTILE_SECRET?.trim())
    check(
      secretConfigured ? '假 Turnstile Token 被 siteverify 拒绝（403）' : '未配置 TURNSTILE_SECRET 时注册返回引导（503）',
      ts.status === (secretConfigured ? 403 : 503),
      `status=${ts.status}`,
    )

    // 12) 演示模式：免登录进入示例房间
    const demo = (await fetch(`${BASE}/demo/enter`, { method: 'POST' }).then((r) => r.json())) as {
      token: string
      roomId: string
      username: string
    }
    check('POST /demo/enter 签发演示会话', Boolean(demo.token) && demo.roomId === 'demo', `roomId=${demo.roomId}`)
    const demoHeaders = { 'content-type': 'application/json', authorization: `Bearer ${demo.token}` }

    // 13) 演示房间含 6 位示例参与者且演示会话为房主
    const demoRoom = (await fetch(`${BASE}/rooms/demo`, { headers: demoHeaders }).then((r) => r.json())) as {
      participants: unknown[]
      isOwner: boolean
    }
    check('演示房间示例数据就绪（6人+房主视角）', demoRoom.participants.length === 6 && demoRoom.isOwner === true)

    // 14) 演示会话可重置示例数据
    const demoReset = await fetch(`${BASE}/demo/reset`, { method: 'POST', headers: demoHeaders })
    check('POST /demo/reset 演示会话可重置', demoReset.status === 200)

    // 15) 演示会话不能创建正式房间
    const demoCreate = await fetch(`${BASE}/rooms`, {
      method: 'POST',
      headers: demoHeaders,
      body: JSON.stringify({
        title: '不应成功',
        durationMinutes: 60,
        startDate: '2026-11-09',
        endDate: '2026-11-10',
        startHour: 8,
        endHour: 22,
      }),
    })
    check('演示会话创建房间被拒（403）', demoCreate.status === 403)

    // 16) 匿名用户不能重置演示数据
    const anonReset = await fetch(`${BASE}/demo/reset`, { method: 'POST' })
    check('匿名用户重置演示被拒（403）', anonReset.status === 403)

    // 17) 非房主删除房间被拒
    const anonDelete = await fetch(`${BASE}/rooms/${roomId}`, { method: 'DELETE' })
    check('匿名用户删除房间被拒（401）', anonDelete.status === 401)

    // 18) 匿名成员按昵称退出
    const leave = await fetch(`${BASE}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·小A' }),
    })
    const afterLeave = (await fetch(`${BASE}/rooms/${roomId}`).then((r) => r.json())) as { participants: Array<{ nickname: string }> }
    check('匿名成员退出房间', leave.status === 200 && afterLeave.participants.length === 1)

    // 19) 再退出一次：记录已不在 → 404
    const leaveAgain = await fetch(`${BASE}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: '冒烟·小A' }),
    })
    check('重复退出被拒（404）', leaveAgain.status === 404)

    // 20) 房主删除房间：级联清理且房间消失
    const del = await fetch(`${BASE}/rooms/${roomId}`, { method: 'DELETE', headers: authHeaders })
    const afterDel = await fetch(`${BASE}/rooms/${roomId}`)
    check('房主删除房间并级联清理（房间404）', del.status === 200 && afterDel.status === 404)
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
