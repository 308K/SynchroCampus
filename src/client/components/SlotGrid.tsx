// 离散时空网格骨架：横轴 Temporal.PlainDate，纵轴 30 分钟槽位
// 涂抹网格与热力图共用；支持 sticky 表头/时间列与移动端涂抹手势
import { Fragment, type ReactNode, type RefObject } from 'react'
import { datesOf, slotsPerDay } from '../lib/room'
import { fmtDateLabel, fmtTime, isWeekend } from '../lib/temporal'

interface SlotGridProps {
  room: import('../lib/room').RoomDTO
  renderCell: (dayIndex: number, daySlot: number, maskIndex: number) => ReactNode
  paintable?: boolean
  gridRef?: RefObject<HTMLDivElement | null>
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>
}

export function SlotGrid({ room, renderCell, paintable, gridRef, ...handlers }: SlotGridProps) {
  const days = datesOf(room)
  const spd = slotsPerDay(room)
  const children: ReactNode[] = []

  children.push(<div key="corner" className="sc-grid-corner" />)
  days.forEach((d, di) => {
    children.push(
      <div
        key={`day-${di}`}
        className="sc-grid-day"
        style={isWeekend(d) ? { color: 'var(--mantine-color-brand-6)' } : undefined}
      >
        {fmtDateLabel(d)}
      </div>,
    )
  })

  for (let s = 0; s < spd; s++) {
    const minutes = room.startHour * 60 + s * 30
    children.push(
      <div key={`time-${s}`} className={`sc-grid-time${minutes % 60 === 0 ? ' sc-grid-time--hour' : ''}`}>
        {fmtTime(minutes)}
      </div>,
    )
    for (let di = 0; di < days.length; di++) {
      const maskIndex = di * spd + s
      children.push(<Fragment key={`cell-${di}-${s}`}>{renderCell(di, s, maskIndex)}</Fragment>)
    }
  }

  return (
    <div className="sc-grid-wrap">
      <div
        ref={gridRef}
        className="sc-grid"
        data-paintable={paintable ? 'true' : 'false'}
        style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(46px, 1fr))` }}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      >
        {children}
      </div>
    </div>
  )
}
