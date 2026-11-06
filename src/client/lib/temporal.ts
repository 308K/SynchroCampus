// TC39 Temporal API 统一入口：原生优先，低版本浏览器按需加载 temporal-polyfill
export const Temporal: typeof import('temporal-polyfill').Temporal =
  (globalThis as { Temporal?: typeof import('temporal-polyfill').Temporal }).Temporal ??
  (await import('temporal-polyfill')).Temporal

/** Temporal 标准类型别名（类型层引用 polyfill 的规范类型定义） */
export type PlainDate = import('temporal-polyfill').Temporal.PlainDate
export type PlainTime = import('temporal-polyfill').Temporal.PlainTime

const WEEKDAYS_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "11-07 周四" 风格的短标签（横轴表头） */
export function fmtDateLabel(d: PlainDate): string {
  return `${pad2(d.month)}-${pad2(d.day)} ${WEEKDAYS_ZH[d.dayOfWeek - 1]}`
}

/** "2026年11月7日 周六" 风格完整日期 */
export function fmtDateFull(d: PlainDate): string {
  return `${d.year}年${d.month}月${d.day}日 ${WEEKDAYS_ZH[d.dayOfWeek - 1]}`
}

/** 分钟数 → "HH:MM" */
export function fmtTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** 起止日期闭区间列表 */
export function dateRange(startISO: string, endISO: string): PlainDate[] {
  const start = Temporal.PlainDate.from(startISO)
  const end = Temporal.PlainDate.from(endISO)
  const days = start.until(end).days + 1
  return Array.from({ length: days }, (_, i) => start.add({ days: i }))
}

export function isWeekend(d: PlainDate): boolean {
  return d.dayOfWeek >= 6
}

export function todayISO(): string {
  return Temporal.Now.plainDateISO().toString()
}
