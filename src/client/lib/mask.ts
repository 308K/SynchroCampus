// 时间掩码编码：三态位图（0 忙碌 / 1 空闲 / 2 勉强）
import type { ParticipantDTO } from './room'

export function emptyMask(length: number): number[] {
  return new Array<number>(length).fill(0)
}

export function maskToNumbers(mask: string): number[] {
  const out = new Array<number>(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = Number(mask[i])
  return out
}

export function numbersToMask(nums: number[]): string {
  return nums.join('')
}

/** 群体空闲率 R(t) = (N_available + 0.5·N_tentative) / N_total */
export function availabilityRatios(participants: ParticipantDTO[], slots: number): number[] {
  const acc = new Array<number>(slots).fill(0)
  for (const p of participants) {
    const len = Math.min(p.availabilityMask.length, slots)
    for (let i = 0; i < len; i++) {
      const v = p.availabilityMask.charCodeAt(i) - 48
      acc[i] += v === 1 ? 1 : v === 2 ? 0.5 : 0
    }
  }
  const n = participants.length || 1
  for (let i = 0; i < slots; i++) acc[i] /= n
  return acc
}

/** 某槽位的三态人员名单 */
export function slotCensus(participants: ParticipantDTO[], slotIndex: number) {
  const available: string[] = []
  const tentative: string[] = []
  const busy: string[] = []
  for (const p of participants) {
    const v = p.availabilityMask.charCodeAt(Math.min(slotIndex, p.availabilityMask.length - 1)) - 48
    if (v === 1) available.push(p.nickname)
    else if (v === 2) tentative.push(p.nickname)
    else busy.push(p.nickname)
  }
  return { available, tentative, busy }
}
