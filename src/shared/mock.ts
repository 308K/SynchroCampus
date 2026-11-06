// 共享 Mock 数据生成器（服务端种子与前端注入共用）
// 以种子键生成确定性伪随机日程：课程块 + 午餐 + 偶发晚间自习
export const MOCK_NAMES = ['模拟·小张', '模拟·小李', '模拟·小王', '模拟·小赵', '模拟·小刘', '模拟·小陈']

export interface MockGeometry {
  startHour: number
  days: number
  slotsPerDay: number
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 生成一位模拟参与者的时间掩码（0忙碌 / 1空闲 / 2勉强） */
export function generateMockMask(geo: MockGeometry, seedKey: string): string {
  const rng = mulberry32(hashSeed(seedKey))
  const { startHour, days, slotsPerDay: spd } = geo
  const out: number[] = []
  for (let d = 0; d < days; d++) {
    const day: number[] = new Array<number>(spd).fill(1)
    // 1~3个课程/个人事务块（1~3小时）
    const blocks = 1 + Math.floor(rng() * 3)
    for (let b = 0; b < blocks; b++) {
      const len = 2 + Math.floor(rng() * 5)
      const start = Math.floor(rng() * Math.max(1, spd - len))
      day.fill(0, start, start + len)
    }
    // 午餐时段12:00–13:30：六成忙碌、四成勉强
    const lunchStart = Math.floor((12 * 60 - startHour * 60) / 30)
    for (let i = lunchStart; i < lunchStart + 3 && i < spd; i++) {
      if (i >= 0) day[i] = rng() < 0.6 ? 0 : 2
    }
    // 部分同学晚间自习（可调课让步）
    if (rng() < 0.35) {
      const evStart = Math.floor((19 * 60 - startHour * 60) / 30)
      for (let i = evStart; i < evStart + 5 && i < spd; i++) {
        if (i >= 0 && day[i] === 1) day[i] = 2
      }
    }
    out.push(...day)
  }
  return out.join('')
}
