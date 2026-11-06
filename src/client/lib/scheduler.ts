// 自决策排程引擎（Agentic Scheduler）
// Score(W) = W_attend·R̄(W) − W_meal·P_meal(W) − W_late·P_late(W) + W_contig·B_contig(W)
//   W_attend = 100（平均到场率）
//   W_meal   = 25（11:30–12:30 / 17:30–18:30 就餐惩罚）
//   W_late   = 40（超过 21:30 的作息健康惩罚）
//   W_contig = 8（窗口前后紧邻槽位亦有人空闲的缓冲收益）
import { availabilityRatios } from './mask'
import { slotsPerDay, daysOf, slotMinutes, type ParticipantDTO, type RoomDTO, type ScoredWindow } from './room'

export const WEIGHTS = { attend: 100, meal: 25, late: 40, contig: 8 } as const

const MEAL_WINDOWS: Array<[number, number]> = [
  [11 * 60 + 30, 12 * 60 + 30],
  [17 * 60 + 30, 18 * 60 + 30],
]
const LATE_THRESHOLD = 21 * 60 + 30

const overlaps = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2

/** 滑动遍历所有候选时间窗口，返回按适宜度排序的 Top-K（互不重叠） */
export function computeTopWindows(
  room: RoomDTO,
  participants: ParticipantDTO[],
  topK = 3,
): ScoredWindow[] {
  const n = participants.length
  if (n === 0) return []
  const R = availabilityRatios(participants, slotsPerDay(room) * daysOf(room))
  const spd = slotsPerDay(room)
  const K = Math.round(room.durationMinutes / 30)
  if (K > spd) return []

  const candidates: ScoredWindow[] = []
  for (let d = 0; d < daysOf(room); d++) {
    for (let s = 0; s + K <= spd; s++) {
      const base = d * spd
      let sum = 0
      for (let k = 0; k < K; k++) sum += R[base + s + k]
      const avgR = sum / K

      const startMin = slotMinutes(room, s)
      const endMin = startMin + K * 30
      const meal = MEAL_WINDOWS.some(([m1, m2]) => overlaps(startMin, endMin, m1, m2))
      const late = endMin > LATE_THRESHOLD

      const before = s > 0 ? R[base + s - 1] : 0
      const after = s + K < spd ? R[base + s + K] : 0
      const contig = ((before > 0 ? 1 : 0) + (after > 0 ? 1 : 0)) / 2

      const score =
        WEIGHTS.attend * avgR -
        (meal ? WEIGHTS.meal : 0) -
        (late ? WEIGHTS.late : 0) +
        WEIGHTS.contig * contig

      candidates.push({
        dayIndex: d,
        startSlot: s,
        slotCount: K,
        score,
        avgR,
        mealPenalty: meal,
        latePenalty: late,
        contigBonus: contig,
      })
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.dayIndex - b.dayIndex || a.startSlot - b.startSlot)

  const picked: ScoredWindow[] = []
  for (const w of candidates) {
    if (picked.length >= topK) break
    const clash = picked.some((p) => p.dayIndex === w.dayIndex && Math.abs(p.startSlot - w.startSlot) < w.slotCount)
    if (!clash) picked.push(w)
  }
  return picked
}

export interface WindowTag {
  label: string
  color: string
}

/** 决策卡片的解释性标签 */
export function windowTags(w: ScoredWindow, rank: number): WindowTag[] {
  const tags: WindowTag[] = []
  if (rank === 0) tags.push({ label: '黄金时段', color: 'yellow' })
  if (w.avgR >= 0.999) tags.push({ label: '全员到齐', color: 'brand' })
  if (!w.mealPenalty) tags.push({ label: '避开饭点', color: 'teal' })
  if (!w.latePenalty) tags.push({ label: '作息友好', color: 'green' })
  if (w.contigBonus >= 1) tags.push({ label: '前后有缓冲', color: 'grape' })
  return tags.slice(0, 4)
}

export function scoreBreakdownText(w: ScoredWindow): string {
  const parts = [`到场率 ${(w.avgR * 100).toFixed(0)}%`]
  if (w.mealPenalty) parts.push(`餐时冲突 −${WEIGHTS.meal}`)
  if (w.latePenalty) parts.push(`夜间惩罚 −${WEIGHTS.late}`)
  if (w.contigBonus > 0) parts.push(`连续缓冲 +${(WEIGHTS.contig * w.contigBonus).toFixed(0)}`)
  return `${parts.join(' · ')} → 综合 ${w.score.toFixed(1)}`
}
