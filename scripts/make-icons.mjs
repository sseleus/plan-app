// 用 pngjs 生成 PWA 图标（192/512）：蓝底圆角方块 + 白色对勾
import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

const ACCENT = { r: 0x3b, g: 0x82, b: 0xf6 }
const WHITE = { r: 0xff, g: 0xff, b: 0xff }

function insideRoundedRect(x, y, size, radius, pad) {
  const min = pad
  const max = size - pad
  if (x < min || x > max || y < min || y > max) return false
  const cx = Math.max(min + radius, Math.min(x, max - radius))
  const cy = Math.max(min + radius, Math.min(y, max - radius))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function makeIcon(size) {
  const png = new PNG({ width: size, height: size })
  const pad = Math.round(size * 0.004)
  const radius = Math.round(size * 0.2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      if (insideRoundedRect(x, y, size, radius, pad)) {
        png.data[idx] = ACCENT.r
        png.data[idx + 1] = ACCENT.g
        png.data[idx + 2] = ACCENT.b
        png.data[idx + 3] = 255
      } else {
        png.data[idx + 3] = 0
      }
    }
  }
  // 白色对勾：沿折线逐点画圆，形成圆头粗线
  const pts = [
    [size * 0.29, size * 0.52],
    [size * 0.44, size * 0.67],
    [size * 0.72, size * 0.34]
  ]
  const thick = size * 0.075
  const half = thick / 2
  for (let seg = 0; seg < pts.length - 1; seg++) {
    const [x1, y1] = pts[seg]
    const [x2, y2] = pts[seg + 1]
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1))
    for (let i = 0; i <= steps; i++) {
      const cx = x1 + ((x2 - x1) * i) / steps
      const cy = y1 + ((y2 - y1) * i) / steps
      for (let dy = -Math.ceil(half); dy <= Math.ceil(half); dy++) {
        for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
          if (dx * dx + dy * dy > half * half) continue
          const px = Math.round(cx + dx)
          const py = Math.round(cy + dy)
          if (px < 0 || py < 0 || px >= size || py >= size) continue
          const idx = (size * py + px) << 2
          png.data[idx] = WHITE.r
          png.data[idx + 1] = WHITE.g
          png.data[idx + 2] = WHITE.b
          png.data[idx + 3] = 255
        }
      }
    }
  }
  return PNG.sync.write(png)
}

writeFileSync(join(outDir, 'pwa-192.png'), makeIcon(192))
writeFileSync(join(outDir, 'pwa-512.png'), makeIcon(512))
console.log('icons generated: public/pwa-192.png, public/pwa-512.png')
