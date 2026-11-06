// OKLCH 知觉均匀热力色阶：无人空闲（红）→ 全员有空（绿）
// 在 OKLCH 空间对 L / C / H 三通道按空闲率 R(t) 线性插值：
//   Lightness(t) = L_min + R·(L_max − L_min)
//   Chroma(t)    = C_min + R·(C_max − C_min)
//   Hue(t)       = H_red + R·(H_green − H_red)（29° 红 → 142° 绿，中途经过黄，知觉平滑）
export interface HeatPalette {
  lMin: number
  lMax: number
  cMin: number
  cMax: number
  hMin: number
  hMax: number
}

/** 浅色模式：R=0 → oklch(0.63 0.15 29) 红；R=1 → oklch(0.72 0.16 142) 绿 */
export const HEAT_LIGHT: HeatPalette = { lMin: 0.63, lMax: 0.72, cMin: 0.15, cMax: 0.16, hMin: 29, hMax: 142 }

/** 深色模式自适应：压低起点明度、提亮终点，保持暗底可辨 */
export const HEAT_DARK: HeatPalette = { lMin: 0.5, lMax: 0.8, cMin: 0.13, cMax: 0.17, hMin: 29, hMax: 142 }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** 计算槽位 OKLCH 分量（L / C / H），供 CSS 变量 --cell-l / --cell-c / --cell-h 使用 */
export function heatComponents(r: number, dark: boolean): { l: number; c: number; h: number } {
  const p = dark ? HEAT_DARK : HEAT_LIGHT
  const t = Math.min(Math.max(r, 0), 1)
  return {
    l: round3(p.lMin + t * (p.lMax - p.lMin)),
    c: round3(p.cMin + t * (p.cMax - p.cMin)),
    h: round3(p.hMin + t * (p.hMax - p.hMin)),
  }
}

/** 无参与数据时的低对比底色（避免整版红色误导） */
export function neutralHeat(dark: boolean): { l: number; c: number; h: number } {
  return dark ? { l: 0.22, c: 0.02, h: 330 } : { l: 0.96, c: 0.01, h: 330 }
}

export function heatColor(r: number, dark: boolean): string {
  const { l, c, h } = heatComponents(r, dark)
  return `oklch(${l} ${c} ${h})`
}

/** 图例渐变条（红 → 黄 → 绿） */
export function heatGradient(dark: boolean): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((r) => heatColor(r, dark)).join(', ')
  return `linear-gradient(90deg, ${stops})`
}
