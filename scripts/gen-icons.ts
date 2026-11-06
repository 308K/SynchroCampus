// 生成 PWA 图标：圆角方形紫蓝渐变底 + 白色时钟环与指针
// 用法：bun scripts/gen-icons.ts（依赖 pngjs，仅开发期）
import { writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const C1 = [0x9c, 0x73, 0xff] // #9c73ff
const C2 = [0x5a, 0x29, 0xbf] // #5a29bf
const WHITE = [0xff, 0xff, 0xff]

function lerp(a: number[], b: number[], t: number): number[] {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))
}

/** 点到线段距离 */
function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function render(size: number, maskable: boolean): PNG {
  const png = new PNG({ width: size, height: size })
  const s = size
  const corner = maskable ? 0 : s * 0.24
  const cx = s / 2
  const cy = s / 2
  // maskable 安全区：内容缩放到 80%
  const scale = maskable ? 0.8 : 1
  const ringR = s * 0.3 * scale
  const ringW = s * 0.055 * scale
  const handW = s * 0.05 * scale
  const handUp = s * 0.17 * scale
  const handSide = s * 0.13 * scale

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const idx = (y * s + x) << 2
      // 圆角矩形遮罩（SDF）
      let alpha = 255
      if (!maskable) {
        const qx = Math.max(Math.abs(x - cx) - (s / 2 - corner), 0)
        const qy = Math.max(Math.abs(y - cy) - (s / 2 - corner), 0)
        const d = Math.hypot(qx, qy) - corner
        if (d > 0.5) {
          png.data[idx + 3] = 0
          continue
        }
        if (d > -0.5) alpha = Math.round(255 * (0.5 - d))
      }
      const t = (x + y) / (2 * s)
      let color = lerp(C1, C2, t)
      // 时钟环
      const ring = Math.abs(Math.hypot(x - cx, y - cy) - ringR)
      // 指针：向上 + 向右下
      const hand1 = segDist(x, y, cx, cy, cx, cy - handUp)
      const hand2 = segDist(x, y, cx, cy, cx + handSide, cy + handSide * 0.62)
      if (ring < ringW / 2 || hand1 < handW / 2 || hand2 < handW / 2) {
        color = WHITE
      }
      png.data[idx] = color[0]
      png.data[idx + 1] = color[1]
      png.data[idx + 2] = color[2]
      png.data[idx + 3] = alpha
    }
  }
  return png
}

function save(png: PNG, path: string) {
  writeFileSync(path, PNG.sync.write(png))
  console.log(`[icons] wrote ${path} (${png.width}x${png.height})`)
}

save(render(192, false), 'public/icon-192.png')
save(render(512, false), 'public/icon-512.png')
save(render(512, true), 'public/icon-maskable-512.png')
