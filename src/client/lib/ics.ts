// RFC 5545 标准日历（.ics）构造
// - TZID:Asia/Shanghai（固定 +08:00，无夏令时偏移）
// - VALARM 提前 15 分钟提醒
// - 严格 CRLF 行结束 + 75 字节折叠（UTF-8 边界安全）
export interface IcsEventOptions {
  uid: string
  title: string
  description?: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  startTime: string
  /** HH:MM */
  endTime: string
  tzid?: string
  alarmMinutes?: number
}

const crlf = '\r\n'

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n')
}

function compactDateTime(date: string, time: string): string {
  return `${date.replaceAll('-', '')}T${time.replaceAll(':', '')}00`
}

function utcNowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** 依据 RFC 5545 在 75 八位字节边界处折行（避免切断 UTF-8 多字节序列） */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const chunks: string[] = []
  const decoder = new TextDecoder()
  let start = 0
  while (start < bytes.length) {
    let end = Math.min(start + 74, bytes.length)
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    chunks.push(decoder.decode(bytes.slice(start, end)))
    start = end
  }
  return chunks.join(`${crlf} `)
}

export function buildIcs(opts: IcsEventOptions): string {
  const tzid = opts.tzid ?? 'Asia/Shanghai'
  const alarm = opts.alarmMinutes ?? 15
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SynchroCampus//序时 群体日程协同智能体//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${tzid}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${utcNowStamp()}`,
    `DTSTART;TZID=${tzid}:${compactDateTime(opts.date, opts.startTime)}`,
    `DTEND;TZID=${tzid}:${compactDateTime(opts.date, opts.endTime)}`,
    `SUMMARY:${escapeText(opts.title)}`,
  ]
  if (opts.description) lines.push(`DESCRIPTION:${escapeText(opts.description)}`)
  lines.push(
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    `TRIGGER:-PT${alarm}M`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`提前${alarm}分钟提醒：${opts.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )
  return lines.map(foldLine).join(crlf) + crlf
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
