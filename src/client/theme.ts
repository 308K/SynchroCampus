// Mantine 主题：品牌色阶由 OKLCH 亮度分层程序化生成（锚点 #ddaacc）
// 色阶不再手工挑色：固定 #ddaacc 的色相/彩度，按亮度等差展开 10 级（Mantine shade 0 最浅 → 9 最深）
import { createTheme, type MantineColorsTuple } from '@mantine/core'

// ---------- OKLCH ↔ sRGB 纯数学转换（Björn Ottosson 的标准矩阵） ----------
type OKLCH = { l: number; c: number; h: number }

function oklchToOklab({ l, c, h }: OKLCH): [number, number, number] {
  const hr = (h * Math.PI) / 180
  return [l, Math.cos(hr) * c, Math.sin(hr) * c]
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const gamma = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055)

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const invGamma = (u: number) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4))

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

function oklchToHex(oklch: OKLCH): string {
  const [L, a, b] = oklchToOklab(oklch)
  let [r, g, b2] = oklabToLinearSrgb(L, a, b)
  // 色域收缩：超界时降彩度直至回到 sRGB（保持亮度与色相）
  let chroma = oklch.c
  for (let i = 0; i < 24 && (r < -0.001 || r > 1.001 || g < -0.001 || g > 1.001 || b2 < -0.001 || b2 > 1.001); i++) {
    chroma *= 0.94
    const [L2, a2, b3] = oklchToOklab({ l: oklch.l, c: chroma, h: oklch.h })
    ;[r, g, b2] = oklabToLinearSrgb(L2, a2, b3)
  }
  const to255 = (u: number) => Math.round(Math.min(Math.max(u, 0), 1) * 255)
  const toHex = (u: number) => to255(u).toString(16).padStart(2, '0')
  return `#${toHex(gamma(Math.min(Math.max(r, 0), 1)))}${toHex(gamma(Math.min(Math.max(g, 0), 1)))}${toHex(gamma(Math.min(Math.max(b2, 0), 1)))}`
}

function hexToOklch(hex: string): OKLCH {
  const [r, g, b] = hexToRgb(hex).map(invGamma) as [number, number, number]
  const [L, a, b2] = linearSrgbToOklab(r, g, b)
  return { l: L, c: Math.hypot(a, b2), h: ((Math.atan2(b2, a) * 180) / Math.PI + 360) % 360 }
}

// ---------- WCAG 对比度 ----------
function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(invGamma) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relLuminance(hexA)
  const lb = relLuminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ---------- 品牌色阶生成 ----------
// Mantine 约定：shade 0 最浅 → 9 最深（填充按钮浅色用 7、深色用 7，需对白字 ≥4.5:1）
const ANCHOR = '#ddaacc' // shade 3 精确等于锚点色
const anchor = hexToOklch(ANCHOR)
// 亮度分层：以锚点亮度为中心、每级 0.06 等差向深处推进；彩度向两端轻微收敛（浅端/深端略降饱和更耐看）
const brandShades: string[] = Array.from({ length: 10 }, (_, i) => {
  const l = Math.min(Math.max(anchor.l - (i - 3) * 0.06, 0.25), 0.985)
  const chroma = anchor.c * (1 - Math.abs(i - 4) * 0.045)
  return oklchToHex({ l, c: Math.max(chroma, 0.01), h: anchor.h })
})
// 色域收缩的转换会有 ±1/255 的往返误差：shade 3 精确锚定为 #ddaacc
brandShades[3] = ANCHOR
const BRAND_TUPLE = brandShades as unknown as MantineColorsTuple

/** 浅色模式大标题色：从色阶中选对 #F3F0EE 页面底对比度 ≥3:1 的最浅一级（保持品牌色相） */
export const PAGE_BG_LIGHT = '#f3f0ee'
export const HERO_TITLE_LIGHT = BRAND_TUPLE.find((hex) => contrastRatio(hex, PAGE_BG_LIGHT) >= 3) ?? BRAND_TUPLE[6]
/** 深色模式大标题色：锚点本色（对暗底对比度充裕） */
export const HERO_TITLE_DARK = ANCHOR

export const theme = createTheme({
  colors: {
    brand: BRAND_TUPLE,
  },
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 7 },
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, "Microsoft YaHei UI", sans-serif',
  headings: {
    fontWeight: '700',
  },
  components: {
    Modal: {
      styles: {
        title: { fontWeight: 700 },
      },
    },
  },
})
