// 演示模式端侧数据层：进入/恢复/涂抹/Mock注入/重置/定案/退出全链路零后端参与
// 与服务端演示种子同构：同一 Mock 生成器、同样的跨天滚动重置语义；状态持久化于 localStorage
import { nanoid } from 'nanoid'
import { ApiError } from '../api/client'
import { generateMockMask, MOCK_NAMES } from '../../shared/mock'
import type { ParticipantDTO, RoomDTO } from './room'
import { Temporal } from './temporal'

export const DEMO_ROOM_ID = 'demo'
export const DEMO_USER_ID = 'demo-owner'
export const DEMO_USERNAME = '演示房主'
/** 演示会话标记 token：仅存于 localStorage 供端侧恢复识别，绝不发往后端 */
export const DEMO_TOKEN = 'demo-session'

const DEMO_ROOM_TITLE = '演示房间·社团例会排期'
const DEMO_DURATION_MINUTES = 90
const DEMO_START_HOUR = 8
const DEMO_END_HOUR = 22
const DEMO_SPAN_DAYS = 7

const STORAGE_KEY = 'sc_demo_state'

interface DemoParticipant {
  id: string
  /** 登录用户提交时记录其 userId（演示房主为 demo-owner），匿名提交为 null */
  userId: string | null
  nickname: string
  availabilityMask: string
}

interface DemoState {
  /** 种子日期：跨天访问即整体滚动重置（与服务端 ensureDemoData 语义一致） */
  startDate: string
  finalizedSlot: string | null
  participants: DemoParticipant[]
}

export interface DemoRoomData {
  room: RoomDTO
  participants: ParticipantDTO[]
  isOwner: boolean
}

let memoryState: DemoState | null = null

function persist(state: DemoState): void {
  memoryState = state
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* 隐私模式等存储不可用：降级为内存态，本次会话内演示仍可用 */
  }
}

function freshState(): DemoState {
  const slotsPerDay = (DEMO_END_HOUR - DEMO_START_HOUR) * 2
  return {
    startDate: Temporal.Now.plainDateISO().toString(),
    finalizedSlot: null,
    participants: MOCK_NAMES.map((nickname, i) => ({
      id: `demo-p${i}`,
      userId: null,
      nickname,
      availabilityMask: generateMockMask(
        { startHour: DEMO_START_HOUR, days: DEMO_SPAN_DAYS, slotsPerDay },
        `${DEMO_ROOM_ID}:${nickname}`,
      ),
    })),
  }
}

/** 读取状态：种子日期过期（跨天）即滚动重置；存储不可用时退回内存态 */
function loadState(): DemoState {
  const today = Temporal.Now.plainDateISO().toString()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state = JSON.parse(raw) as DemoState
      if (state && state.startDate === today && Array.isArray(state.participants)) return state
    }
  } catch {
    /* 解析失败按缺失处理，重新播种 */
  }
  if (memoryState && memoryState.startDate === today) return memoryState
  const state = freshState()
  persist(state)
  return state
}

function toRoom(state: DemoState): RoomDTO {
  return {
    id: DEMO_ROOM_ID,
    title: DEMO_ROOM_TITLE,
    durationMinutes: DEMO_DURATION_MINUTES,
    startDate: state.startDate,
    endDate: Temporal.PlainDate.from(state.startDate).add({ days: DEMO_SPAN_DAYS - 1 }).toString(),
    startHour: DEMO_START_HOUR,
    endHour: DEMO_END_HOUR,
    finalizedSlot: state.finalizedSlot,
  }
}

/** 读取演示房间数据（isSelf/isOwner 随会话用户联动，匹配语义与服务端一致） */
export function loadDemoRoom(userId: string | null): DemoRoomData {
  const state = loadState()
  return {
    room: toRoom(state),
    participants: state.participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      availabilityMask: p.availabilityMask,
      isSelf: p.userId !== null && p.userId === userId,
    })),
    isOwner: userId === DEMO_USER_ID,
  }
}

function assertEditable(state: DemoState): void {
  if (state.finalizedSlot) throw new ApiError(403, '房间已定案锁定，无法再修改时间。')
}

/** 提交/更新时间掩码：登录用户按 userId 匹配，匿名按昵称匹配 */
export function saveDemoAvailability(userId: string | null, nickname: string, availabilityMask: string): void {
  const state = loadState()
  assertEditable(state)
  const existing = userId
    ? state.participants.find((p) => p.userId === userId)
    : state.participants.find((p) => p.userId === null && p.nickname === nickname)
  if (existing) {
    existing.nickname = nickname
    existing.availabilityMask = availabilityMask
  } else {
    state.participants.push({ id: nanoid(12), userId, nickname, availabilityMask })
  }
  persist(state)
}

/** 一键注入模拟成员的冲突日程（按昵称 upsert 匿名参与者，不影响本人已提交记录） */
export function injectDemoMock(): void {
  const state = loadState()
  assertEditable(state)
  const slotsPerDay = (DEMO_END_HOUR - DEMO_START_HOUR) * 2
  for (const name of MOCK_NAMES) {
    const mask = generateMockMask(
      { startHour: DEMO_START_HOUR, days: DEMO_SPAN_DAYS, slotsPerDay },
      `${DEMO_ROOM_ID}:${name}`,
    )
    const existing = state.participants.find((p) => p.userId === null && p.nickname === name)
    if (existing) existing.availabilityMask = mask
    else state.participants.push({ id: nanoid(12), userId: null, nickname: name, availabilityMask: mask })
  }
  persist(state)
}

/** 重置演示：清空涂抹与定案，滚动到今天并重新注入示例数据 */
export function resetDemo(): void {
  persist(freshState())
}

/** 房主定案锁定（selectedSlot 为序列化后的定案时段 JSON） */
export function finalizeDemo(selectedSlot: string): void {
  const state = loadState()
  if (state.finalizedSlot) throw new ApiError(409, '房间已定案，无需重复操作。')
  state.finalizedSlot = selectedSlot
  persist(state)
}

/** 成员退出：登录按 userId、匿名按昵称移除参与记录 */
export function leaveDemo(userId: string | null, nickname: string): void {
  const state = loadState()
  if (!userId && !nickname) throw new ApiError(400, '匿名成员退出需要提供昵称，或登录后操作。')
  const idx = state.participants.findIndex((p) =>
    userId ? p.userId === userId : p.userId === null && p.nickname === nickname,
  )
  if (idx === -1) throw new ApiError(404, '未找到该昵称的参与记录。')
  state.participants.splice(idx, 1)
  persist(state)
}
