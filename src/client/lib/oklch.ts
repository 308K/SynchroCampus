// OKLCH 知觉均匀热力色阶
// Lightness(t) = L_min + R(t)·(L_max − L_min)
// Chroma(t)     = C_min + R(t)·(C_max − C_min)
// Hue           = 280°（固定主题紫蓝基调）
export interface HeatPalette {
  lMin: number
  lMax: number
  cMin: number
  cMax: number
}

/** 浅色模式：R=0 → oklch(0.96 0.01 280)；R=1 → oklch(0.55 0.22 280) */
export const HEAT_LIGHT: HeatPalette = { lMin: 0.96, lMax: 0.55, cMin: 0.01, cMax: 0.22 }

/** 深色模式自适应：底色沉入画布，高值提亮增饱和 */
export const HEAT_DARK: HeatPalette = { lMin: 0.22, lMax: 0.62, cMin: 0.02, cMax: 0.2 }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** 计算槽位 OKLCH 分量（L / C），供 CSS 变量 --cell-l / --cell-c 使用 */
export function heatComponents(r: number, dark: boolean): { l: number; c: number } {
  const p = dark ? HEAT_DARK : HEAT_LIGHT
  const clamped = Math.min(Math.max(r, 0), 1)
  return {
    l: round3(p.lMin + clamped * (p.lMax - p.lMin)),
    c: round3(p.cMin + clamped * (p.cMax - p.cMin)),
  }
}

export function heatColor(r: number, dark: boolean): string {
  const { l, c } = heatComponents(r, dark)
  return `oklch(${l} ${c} 280)`
}

/** 图例渐变条 */
export function heatGradient(dark: boolean): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((r) => heatColor(r, dark)).join(', ')
  return `linear-gradient(90deg, ${stops})`
}
