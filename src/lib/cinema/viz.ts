import type { Box, Palette, VizShapeId } from './types'

export const VIZ_SHAPES: { id: VizShapeId; name: string; circular: boolean; recommended?: boolean }[] = [
  { id: 'dots', name: '도트', circular: false },
  { id: 'bars-reflect', name: '막대와 반사', circular: false },
  { id: 'wave-line', name: '단선 파형', circular: false },
  { id: 'wave-dual', name: '이중 파형', circular: false },
  { id: 'area-soft', name: '부드러운 면', circular: false },
  { id: 'area-mirror', name: '대칭 면', circular: false },
  { id: 'ribbon', name: '리본', circular: false },
  { id: 'ring-bars', name: '원형 막대', circular: true },
  { id: 'ring-line', name: '원형 선', circular: true, recommended: true },
  { id: 'ring-dual', name: '이중 링', circular: true },
  { id: 'radial-dots', name: '방사 도트', circular: true },
  { id: 'ring-oval', name: '타원 링', circular: true },
]
export const isCircular = (s: VizShapeId) => VIZ_SHAPES.find(v => v.id === s)?.circular ?? false

const TAU = Math.PI * 2
const MIN_V = 0.04

function hexRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  const n = parseInt(f, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** 팔레트 위 u(0..1) 위치의 색 */
function colorAt(p: Palette, u: number): string {
  const cs = p.colors
  if (cs.length === 1) return cs[0]
  const x = Math.min(Math.max(u, 0), 1) * (cs.length - 1)
  const i = Math.min(Math.floor(x), cs.length - 2)
  const f = x - i
  const a = hexRgb(cs[i]), b = hexRgb(cs[i + 1])
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`
}
function grad(ctx: CanvasRenderingContext2D, p: Palette, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  const n = p.colors.length
  p.colors.forEach((c, i) => g.addColorStop(n === 1 ? 0 : i / (n - 1), c))
  return g
}
/** bars(64) 를 u(0..1) 위치에서 선형 보간해 읽는다. 최소 높이 보장 */
function sample(bars: Float32Array, u: number, level: number): number {
  const n = bars.length
  if (n === 0) return MIN_V
  const x = Math.min(Math.max(u, 0), 1) * (n - 1)
  const i = Math.floor(x), f = x - i
  const v = bars[i] + ((bars[Math.min(i + 1, n - 1)] - bars[i]) * f)
  return MIN_V + Math.min(Math.max(v, 0), 1) * (1 - MIN_V) * (0.85 + 0.15 * level)
}
/** 원형 각도 → 좌우 대칭(이음매 없음) 샘플 위치 */
const mirrorU = (a01: number) => (a01 < 0.5 ? a01 * 2 : (1 - a01) * 2)

export function drawViz(ctx: CanvasRenderingContext2D, shape: VizShapeId, palette: Palette, bars: Float32Array, level: number, t: number, boxes: { bar: Box; ring: Box }) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const b = boxes.bar
  const ring = boxes.ring
  const cx = ring.x + ring.w / 2, cy = ring.y + ring.h / 2
  const R = Math.max(1, Math.min(ring.w, ring.h) / 2)
  const maxLen = R * 0.35
  const smp = (u: number) => sample(bars, u, level)

  /** 직선형: 가로 u 위치에서 상하 파형 변위(-1..1) */
  const waveY = (u: number, phase: number) => (smp(u) - 0.3) * Math.sin(u * 18 + t * 2 + phase) * 0.9
  const linePath = (n: number, f: (u: number) => number) => {
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const x = b.x + u * b.w, y = f(u)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
  }
  const midY = b.y + b.h / 2

  switch (shape) {
    case 'dots': {
      const cols = 32, step = b.w / cols, r = Math.max(1.2, Math.min(step * 0.3, b.h / 24))
      const rows = Math.max(1, Math.floor(b.h / (r * 2.8)))
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols
        const k = Math.max(1, Math.round(smp(u) * rows))
        ctx.fillStyle = colorAt(palette, u)
        for (let j = 0; j < k; j++) {
          ctx.beginPath()
          ctx.arc(b.x + (c + 0.5) * step, b.y + b.h - r - j * r * 2.8, r, 0, TAU)
          ctx.fill()
        }
      }
      break
    }
    case 'bars-reflect': {
      const n = 48, step = b.w / n, w = step * 0.62, base = b.y + b.h * 0.62
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const h = smp(u) * b.h * 0.6
        const x = b.x + i * step + (step - w) / 2
        ctx.globalAlpha = 1
        ctx.fillStyle = colorAt(palette, u)
        ctx.fillRect(x, base - h, w, h)
        ctx.globalAlpha = 0.28
        ctx.fillRect(x, base + 2, w, h * 0.6)
      }
      break
    }
    case 'wave-line': {
      ctx.strokeStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.lineWidth = Math.max(2, b.h / 40)
      linePath(96, u => midY + waveY(u, 0) * b.h * 0.5)
      ctx.stroke()
      break
    }
    case 'wave-dual': {
      ctx.strokeStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.lineWidth = Math.max(2, b.h / 48)
      linePath(96, u => midY + waveY(u, 0) * b.h * 0.5)
      ctx.stroke()
      ctx.globalAlpha = 0.55
      linePath(96, u => midY + waveY(u, Math.PI) * b.h * 0.5)
      ctx.stroke()
      break
    }
    case 'area-soft': {
      const base = b.y + b.h
      const top = (u: number) => base - smp(u) * b.h * (0.85 + 0.1 * Math.sin(u * 7 + t))
      linePath(96, top)
      ctx.lineTo(b.x + b.w, base); ctx.lineTo(b.x, base); ctx.closePath()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.lineWidth = Math.max(2, b.h / 50)
      linePath(96, top)
      ctx.stroke()
      break
    }
    case 'area-mirror': {
      const n = 96
      ctx.beginPath()
      for (let i = 0; i <= n; i++) { const u = i / n; const x = b.x + u * b.w, y = midY - smp(u) * b.h * 0.48; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
      for (let i = n; i >= 0; i--) { const u = i / n; ctx.lineTo(b.x + u * b.w, midY + smp(u) * b.h * 0.48) }
      ctx.closePath()
      ctx.globalAlpha = 0.8
      ctx.fillStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.fill()
      break
    }
    case 'ribbon': {
      const n = 96
      const twist = (u: number) => Math.sin(u * 9 + t * 1.5)
      ctx.beginPath()
      for (let i = 0; i <= n; i++) { const u = i / n; const x = b.x + u * b.w, y = midY + twist(u) * b.h * 0.18 - smp(u) * b.h * 0.3; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
      for (let i = n; i >= 0; i--) { const u = i / n; ctx.lineTo(b.x + u * b.w, midY + twist(u) * b.h * 0.18 + smp(u) * b.h * 0.3) }
      ctx.closePath()
      ctx.globalAlpha = 0.7
      ctx.fillStyle = grad(ctx, palette, b.x, 0, b.x + b.w, 0)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.accent
      ctx.lineWidth = Math.max(1.5, b.h / 80)
      ctx.stroke()
      break
    }
    case 'ring-bars': {
      const n = 96
      ctx.lineWidth = Math.max(2, (TAU * R) / n * 0.55)
      for (let i = 0; i < n; i++) {
        const a01 = i / n
        const a = -Math.PI / 2 + t * 0.05 + a01 * TAU
        const len = smp(mirrorU(a01)) * maxLen
        ctx.strokeStyle = colorAt(palette, mirrorU(a01))
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * R * 1.03, cy + Math.sin(a) * R * 1.03)
        ctx.lineTo(cx + Math.cos(a) * (R * 1.03 + len), cy + Math.sin(a) * (R * 1.03 + len))
        ctx.stroke()
      }
      break
    }
    case 'ring-line':
    case 'ring-dual':
    case 'ring-oval': {
      const rx = shape === 'ring-oval' ? 1.25 : 1, ry = shape === 'ring-oval' ? 0.92 : 1
      const rot = shape === 'ring-oval' ? t * 0.1 : 0
      const n = 128
      const closed = (inner: number, amp: number, phase: number) => {
        ctx.beginPath()
        for (let i = 0; i <= n; i++) {
          const a01 = i / n
          const a = -Math.PI / 2 + t * 0.05 + a01 * TAU
          const r = R * inner + smp(mirrorU((a01 + phase) % 1)) * maxLen * amp
          const ex = Math.cos(a) * r * rx, ey = Math.sin(a) * r * ry
          const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot)
          const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot)
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
      }
      ctx.strokeStyle = grad(ctx, palette, cx - R, cy - R, cx + R, cy + R)
      ctx.lineWidth = Math.max(2, R / 28)
      closed(1.04, 1, 0)
      ctx.stroke()
      if (shape === 'ring-dual') {
        ctx.globalAlpha = 0.55
        closed(1.04, 0.55, 0.25)
        ctx.stroke()
      }
      break
    }
    case 'radial-dots': {
      const spokes = 48, rows = 5, r = Math.max(1.2, R * 0.022)
      for (let i = 0; i < spokes; i++) {
        const a01 = i / spokes
        const a = -Math.PI / 2 + t * 0.05 + a01 * TAU
        const k = Math.max(1, Math.round(smp(mirrorU(a01)) * rows))
        ctx.fillStyle = colorAt(palette, mirrorU(a01))
        for (let j = 0; j < k; j++) {
          const d = R * 1.06 + (j / rows) * maxLen * 1.1
          ctx.beginPath()
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, TAU)
          ctx.fill()
        }
      }
      break
    }
  }
  ctx.restore()
}
