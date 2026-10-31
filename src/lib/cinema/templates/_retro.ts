/**
 * 레트로 오디오 장면(리얼 카세트·LP 턴테이블·80년대 전축·붐박스·진공관 라디오) 공용 그리기.
 * 원칙: 물체는 코드로 그리되 빛 방향을 한 장면 안에서 고정하고, 접지 그림자·금속 결·나무 결·천 직조·그레인으로 사진처럼 보이게 한다.
 * 질감 타일은 한 번만 만들어 캐시한다. 캔버스를 못 만드는 곳(테스트)에서는 질감만 빠지고 모양은 그대로 그려진다.
 * 상태를 들고 있지 않다 — 같은 프레임은 언제 다시 그려도 같은 그림(내보내기·되감기 결정성).
 */
import type { Box, CinemaFrame } from '../types'
import { fitText, mmss, roundRectPath } from '../helpers'
import { isInst, isTall, rng, unit } from './_kit'
import { HAND, LATIN, SANS, SERIF, hairline, offscreen, rgba, serifLyrics, shadowText, type RGB, type Tones } from './_scene'

type Ctx = CanvasRenderingContext2D
type Canvasish = OffscreenCanvas | HTMLCanvasElement
export const TAU = Math.PI * 2
export { HAND, LATIN, SANS, SERIF }
export const rr = roundRectPath

export const mixc = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
/** k>0 이면 밝게, k<0 이면 어둡게 */
export const shade = (c: RGB, k: number): RGB => (k >= 0 ? mixc(c, [255, 255, 255], k) : mixc(c, [0, 0, 0], -k))
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

// ── 질감 타일(한 번만 만든다) ──────────────────────────────────
const tiles = new Map<string, Canvasish | null>()
function tile(key: string, w: number, h: number, paint: (d: Uint8ClampedArray, w: number, h: number) => void): Canvasish | null {
  if (tiles.has(key)) return tiles.get(key) ?? null
  const o = offscreen(w, h)
  let c: Canvasish | null = null
  if (o) {
    try {
      const img = o.x.createImageData(w, h)
      paint(img.data, w, h)
      o.x.putImageData(img, 0, 0)
      c = o.c
    } catch { c = null }
  }
  tiles.set(key, c)
  return c
}
const put = (d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a = 255) => { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a }

/** 헤어라인 알루미늄: 가로 줄무늬(중간 회색 기준이라 overlay 로 깐다) */
const streakTile = () => tile('streak', 256, 64, (d, w, h) => {
  const r = rng(11)
  for (let y = 0; y < h; y++) {
    const rv = (r() - 0.5) * 84
    for (let x = 0; x < w; x++) { const v = 128 + rv + (r() - 0.5) * 30; put(d, (y * w + x) * 4, v, v, v) }
  }
})
/** 나무 결: 위아래로 이어 붙는 물결 무늬(overlay) */
export const woodTile = () => tile('wood', 256, 256, (d, w, h) => {
  const r = rng(5)
  const n = new Float32Array(256).map(() => r())
  const n2 = new Float32Array(256).map(() => r())
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const warp = 1.8 * Math.sin((x / w) * TAU + (y / h) * TAU * 2) + 0.7 * Math.sin((x / w) * TAU * 3)
      const g = (((y + warp) % 256) + 256) % 256
      const gi = Math.floor(g), fr = g - gi
      const k = n[gi] * (1 - fr) + n[(gi + 1) & 255] * fr
      const g2 = (g * 3) % 256, g2i = Math.floor(g2), f2 = g2 - g2i
      const k2 = n2[g2i] * (1 - f2) + n2[(g2i + 1) & 255] * f2
      const v = 128 + (k - 0.5) * 70 + (k2 - 0.5) * 70 + (r() - 0.5) * 14
      put(d, (y * w + x) * 4, v, v, v)
    }
  }
})
/** 스피커 천 직조(overlay) */
export const weaveTile = () => tile('weave', 8, 8, (d, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (x >> 1) & 1, b = (y >> 1) & 1
    const v = (a ^ b ? 58 : 182) + (((x & 1) + (y & 1)) * 9 - 9)
    put(d, (y * w + x) * 4, v, v, v)
  }
})
/** 타공망 한 칸(구멍 + 아래쪽 안벽에 걸리는 빛). 알파가 있는 타일이라 그대로 얹는다 */
export const perfTile = () => tile('perf', 12, 12, (d, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2, dist = Math.hypot(dx, dy), i = (y * w + x) * 4
    if (dist < 3.5) {
      const lit = dx + dy > 0 && dist > 2.0 ? Math.min(1, (dist - 2.0) / 1.5) : 0
      const v = 8 + lit * 105
      put(d, i, v, v * 0.97, v * 0.93)
    } else if (dist < 4.6) { const v = dx + dy < 0 ? 255 : 0; put(d, i, v, v, v, dx + dy < 0 ? 46 : 64) }
    else put(d, i, 0, 0, 0, 0)
  }
})

/** 질감 타일을 박스에 깐다(호출 쪽에서 모양대로 clip 해 둔다) */
export function texFill(ctx: Ctx, tl: Canvasish | null, b: Box, alpha: number, mode: GlobalCompositeOperation = 'overlay', sc = 1) {
  if (!tl) return
  const pat = ctx.createPattern(tl as CanvasImageSource, 'repeat')
  if (!pat) return
  ctx.save()
  ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode
  ctx.translate(b.x, b.y); ctx.scale(sc, sc)
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, b.w / sc, b.h / sc)
  ctx.restore()
}

// ── 그림자·빛 ────────────────────────────────────────────────
/** 불투명한 물체 뒤에 깔리는 드리운 그림자(물체를 이 위에 그린다) */
export function castShadow(ctx: Ctx, b: Box, r: number, o: { dx: number; dy: number; blur: number; a?: number }) {
  ctx.save()
  ctx.shadowColor = `rgba(6,4,3,${o.a ?? 0.6})`; ctx.shadowBlur = o.blur; ctx.shadowOffsetX = o.dx; ctx.shadowOffsetY = o.dy
  ctx.fillStyle = '#000'
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.fill()
  ctx.restore()
}

/** 모서리 빛: lx -1 이면 왼쪽 위에서, 1 이면 오른쪽 위에서 빛이 온다 */
export function edgeLight(ctx: Ctx, b: Box, r: number, o: { k?: number; a?: number; lx?: number } = {}) {
  const k = o.k ?? 1.2, a = o.a ?? 0.5, lx = o.lx ?? -1
  ctx.save()
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.clip()
  ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(b.x, b.y, b.w, k)
  ctx.fillStyle = `rgba(255,255,255,${a * 0.65})`; ctx.fillRect(lx < 0 ? b.x : b.x + b.w - k, b.y, k, b.h)
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(b.x, b.y + b.h - k, b.w, k)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(lx < 0 ? b.x + b.w - k : b.x, b.y, k, b.h)
  ctx.restore()
}

/** 헤어라인 알루미늄 패널(좌측 광원 기준 가로 반사 + 줄무늬) */
export function metalPanel(ctx: Ctx, b: Box, r: number, base: RGB, o: { tex?: number; lx?: number; sc?: number } = {}) {
  const lx = o.lx ?? -1
  ctx.save()
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.clip()
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y)
  const st: [number, number][] = [[0, 0.2], [0.16, 0.04], [0.4, 0.15], [0.58, -0.02], [0.8, -0.1], [1, -0.17]]
  for (const [p, k] of st) g.addColorStop(lx < 0 ? p : 1 - p, rgba(shade(base, k)))
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h)
  const v = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  v.addColorStop(0, 'rgba(255,255,255,0.22)'); v.addColorStop(0.1, 'rgba(255,255,255,0)'); v.addColorStop(0.9, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = v; ctx.fillRect(b.x, b.y, b.w, b.h)
  texFill(ctx, streakTile(), b, o.tex ?? 0.34, 'overlay', o.sc ?? 1)
  ctx.restore()
  edgeLight(ctx, b, r, { a: 0.55, k: Math.max(1, b.h * 0.02), lx })
  ctx.save(); rr(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, r); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore()
}

/** 나무 패널(결 텍스처 + 위쪽 빛) */
export function woodPanel(ctx: Ctx, b: Box, r: number, base: RGB, o: { tex?: number; sc?: number; lx?: number; rot?: boolean } = {}) {
  ctx.save()
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.clip()
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.6, b.y + b.h)
  g.addColorStop(0, rgba(shade(base, 0.16))); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.3)))
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h)
  texFill(ctx, woodTile(), b, o.tex ?? 0.55, 'overlay', o.sc ?? 1)
  const v = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  v.addColorStop(0, 'rgba(255,225,180,0.14)'); v.addColorStop(0.25, 'rgba(255,225,180,0)'); v.addColorStop(0.8, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = v; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.restore()
  edgeLight(ctx, b, r, { a: 0.28, k: Math.max(1, b.h * 0.012), lx: o.lx })
}

/** 둥근 직사각형 위의 은은한 광택 사선 */
export function glassSheen(ctx: Ctx, b: Box, r: number, a = 0.2) {
  ctx.save()
  rr(ctx, b.x, b.y, b.w, b.h, r); ctx.clip()
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ctx.beginPath()
  ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w * 0.62, b.y); ctx.lineTo(b.x + b.w * 0.22, b.y + b.h); ctx.lineTo(b.x, b.y + b.h)
  ctx.closePath(); ctx.fill()
  const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h * 0.5)
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h * 0.5)
  ctx.restore()
}

// ── 부품 ────────────────────────────────────────────────────
export function screw(ctx: Ctx, x: number, y: number, r: number, ang = 0, lx = -1) {
  const g = ctx.createRadialGradient(x + lx * r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
  g.addColorStop(0, '#e6e4de'); g.addColorStop(0.6, '#aaa7a1'); g.addColorStop(1, '#5c5a56')
  ctx.save()
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = r * 0.14; ctx.stroke()
  ctx.translate(x, y); ctx.rotate(ang)
  ctx.strokeStyle = 'rgba(24,21,19,0.85)'; ctx.lineWidth = r * 0.26; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(-r * 0.62, 0); ctx.lineTo(r * 0.62, 0); ctx.moveTo(0, -r * 0.62); ctx.lineTo(0, r * 0.62); ctx.stroke()
  ctx.restore()
}

/** 금속·베이클라이트 노브. ang 은 지시선 각도(라디안, 위쪽 기준 시계방향) */
export function knob(ctx: Ctx, cx: number, cy: number, r: number, ang: number, o: { base?: RGB; ridges?: number; mark?: string; lx?: number; cap?: number } = {}) {
  const base = o.base ?? [150, 150, 148]
  const lx = o.lx ?? -1
  const ridges = o.ridges ?? 28
  ctx.save()
  ctx.shadowColor = 'rgba(6,4,3,0.6)'; ctx.shadowBlur = r * 0.45; ctx.shadowOffsetX = -lx * r * 0.2; ctx.shadowOffsetY = r * 0.3
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill()
  ctx.restore()
  const g = ctx.createRadialGradient(cx + lx * r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r)
  g.addColorStop(0, rgba(shade(base, 0.6))); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.5)))
  ctx.save()
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill()
  // 가장자리 홈: 빛 쪽 절반은 밝게, 반대쪽은 어둡게
  if (ridges > 0 && r > 5) {
    ctx.lineWidth = Math.max(1, r * 0.05)
    for (let i = 0; i < ridges; i++) {
      const a = (i / ridges) * TAU
      const lit = Math.max(0, Math.cos(a - (lx < 0 ? -2.35 : -0.8)))
      ctx.strokeStyle = `rgba(${lit > 0.5 ? '255,255,255' : '0,0,0'},${0.12 + 0.3 * Math.abs(lit - 0.4)})`
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); ctx.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98); ctx.stroke()
    }
  }
  // 윗면 캡
  const capR = r * (o.cap ?? 0.72)
  const cg = ctx.createRadialGradient(cx + lx * capR * 0.3, cy - capR * 0.35, capR * 0.05, cx, cy, capR)
  cg.addColorStop(0, rgba(shade(base, 0.5))); cg.addColorStop(1, rgba(shade(base, -0.28)))
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, capR, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, r * 0.04); ctx.stroke()
  // 지시선
  ctx.strokeStyle = o.mark ?? 'rgba(20,16,14,0.85)'; ctx.lineWidth = Math.max(1.2, r * 0.1); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx + Math.sin(ang) * capR * 0.25, cy - Math.cos(ang) * capR * 0.25); ctx.lineTo(cx + Math.sin(ang) * capR * 0.82, cy - Math.cos(ang) * capR * 0.82); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.beginPath(); ctx.ellipse(cx - lx * -r * 0.28, cy - r * 0.34, r * 0.22, r * 0.12, lx * 0.6, 0, TAU); ctx.fill()
  ctx.restore()
}

/** 릴 허브(흰 플라스틱 + 안쪽 톱니). 회전하는 부품 */
export function reelHub(ctx: Ctx, x: number, y: number, r: number, ang: number) {
  ctx.save()
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r)
  g.addColorStop(0, '#f0ede6'); g.addColorStop(1, '#a7a39a')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = r * 0.07; ctx.stroke()
  ctx.fillStyle = '#0d0b0a'; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.fill()
  ctx.translate(x, y); ctx.rotate(ang)
  ctx.fillStyle = '#d9d5cb'
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate((i / 6) * TAU)
    ctx.fillRect(-r * 0.12, -r * 0.66, r * 0.24, r * 0.26)
    ctx.restore()
  }
  ctx.restore()
}

/** 은은하게 빛나는 글자(진공 형광 표시창 등) */
export function glowText(ctx: Ctx, text: string, x: number, y: number, maxW: number, size: number, c: RGB, o: { align?: CanvasTextAlign; font?: string; weight?: number; a?: number } = {}) {
  ctx.save()
  ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = size * 0.7
  fitText(ctx, text, x, y, maxW, size, { color: rgba(c, o.a ?? 0.95), align: o.align ?? 'left', baseline: 'middle', weight: o.weight ?? 500, font: o.font ?? SANS, minSize: Math.max(4, size * 0.4) })
  ctx.restore()
}

/** LED 막대(아래에서 위로 차오른다). 켜진 칸은 번짐을 더한다 */
export function ledColumn(ctx: Ctx, x: number, y: number, w: number, h: number, v: number, n: number, color: (i: number, n: number) => RGB) {
  const gap = (h / n) * 0.24
  const sh = (h - gap * (n - 1)) / n
  const lit = Math.round(clamp(v) * n)
  for (let i = 0; i < n; i++) {
    const yy = y + h - (i + 1) * sh - i * gap
    const c = color(i, n)
    ctx.fillStyle = i < lit ? rgba(shade(c, 0.12)) : rgba(mixc(c, [8, 8, 10], 0.84))
    ctx.fillRect(x, yy, w, sh)
  }
  if (lit > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < lit; i++) {
      const yy = y + h - (i + 1) * sh - i * gap
      ctx.fillStyle = rgba(color(i, n), 0.16); ctx.fillRect(x - w * 0.25, yy - sh * 0.35, w * 1.5, sh * 1.7)
    }
    ctx.restore()
  }
}

/** 따뜻한 백라이트의 바늘 VU 미터. val 0..1, 눈금만(글자는 채널 표시 하나) */
export function vuMeter(ctx: Ctx, b: Box, val: number, o: { label?: string; lx?: number } = {}) {
  const lx = o.lx ?? -1
  const bz = Math.min(b.w, b.h) * 0.07
  const fx = b.x + bz, fy = b.y + bz, fw = b.w - bz * 2, fh = b.h - bz * 2
  castShadow(ctx, b, b.h * 0.08, { dx: -lx * b.h * 0.03, dy: b.h * 0.05, blur: b.h * 0.1, a: 0.55 })
  const bg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
  bg.addColorStop(0, '#5a5855'); bg.addColorStop(0.5, '#26241f'); bg.addColorStop(1, '#14120f')
  ctx.save(); ctx.fillStyle = bg; rr(ctx, b.x, b.y, b.w, b.h, b.h * 0.08); ctx.fill(); ctx.restore()
  ctx.save()
  rr(ctx, fx, fy, fw, fh, fh * 0.05); ctx.clip()
  const px = fx + fw / 2, py = fy + fh * 1.02, R = fh * 0.86
  const fg = ctx.createRadialGradient(px, fy + fh * 0.9, fh * 0.05, px, fy + fh * 0.9, fw * 0.78)
  fg.addColorStop(0, 'rgb(255,238,176)'); fg.addColorStop(0.55, 'rgb(246,204,116)'); fg.addColorStop(1, 'rgb(158,104,44)')
  ctx.fillStyle = fg; ctx.fillRect(fx, fy, fw, fh)
  // 눈금
  const sweep = 0.62
  const dir = (th: number, rad: number): [number, number] => [px + Math.sin(th) * rad, py - Math.cos(th) * rad]
  ctx.lineCap = 'butt'
  ctx.strokeStyle = 'rgba(48,32,18,0.85)'; ctx.lineWidth = Math.max(1, fh * 0.012)
  ctx.beginPath(); ctx.arc(px, py, R * 0.95, -Math.PI / 2 - sweep, -Math.PI / 2 + sweep); ctx.stroke()
  ctx.strokeStyle = 'rgba(170,32,20,0.85)'; ctx.lineWidth = Math.max(2, fh * 0.034)
  ctx.beginPath(); ctx.arc(px, py, R * 0.885, -Math.PI / 2 + sweep * 0.44, -Math.PI / 2 + sweep); ctx.stroke()
  for (let i = 0; i <= 20; i++) {
    const u = i / 20, th = -sweep + u * sweep * 2, major = i % 4 === 0
    const [x0, y0] = dir(th, R * 0.95), [x1, y1] = dir(th, R * (major ? 0.82 : 0.88))
    ctx.strokeStyle = u > 0.72 ? 'rgba(150,26,16,0.95)' : 'rgba(48,32,18,0.9)'
    ctx.lineWidth = Math.max(1, fh * (major ? 0.022 : 0.012))
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  if (o.label) fitText(ctx, o.label, fx + fw * 0.13, fy + fh * 0.8, fw * 0.2, fh * 0.17, { font: SANS, weight: 700, color: 'rgba(48,32,18,0.7)', align: 'center', baseline: 'middle', minSize: 4 })
  // 바늘(그림자 먼저)
  const th = -sweep + clamp(val) * sweep * 2
  const [nx, ny] = dir(th, R * 1.0), [tx, ty] = dir(th + Math.PI, R * 0.08)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(70,40,10,0.28)'; ctx.lineWidth = Math.max(1.5, fh * 0.02)
  ctx.beginPath(); ctx.moveTo(tx - lx * fw * 0.012, ty + fh * 0.03); ctx.lineTo(nx - lx * fw * 0.012, ny + fh * 0.03); ctx.stroke()
  ctx.strokeStyle = 'rgb(22,16,12)'; ctx.lineWidth = Math.max(1.2, fh * 0.014)
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(nx, ny); ctx.stroke()
  // 아래 가림판 + 피벗
  const cg = ctx.createLinearGradient(0, fy + fh * 0.86, 0, fy + fh)
  cg.addColorStop(0, '#3a3530'); cg.addColorStop(1, '#171512')
  ctx.fillStyle = cg; ctx.fillRect(fx, fy + fh * 0.88, fw, fh * 0.12)
  // 윗부분 안쪽 그늘 + 유리 광택
  const ig = ctx.createLinearGradient(0, fy, 0, fy + fh * 0.2)
  ig.addColorStop(0, 'rgba(0,0,0,0.38)'); ig.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ig; ctx.fillRect(fx, fy, fw, fh * 0.2)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fw * 0.66, fy); ctx.lineTo(fx + fw * 0.12, fy + fh * 0.92); ctx.lineTo(fx, fy + fh * 0.92); ctx.closePath(); ctx.fill()
  ctx.restore()
  edgeLight(ctx, b, b.h * 0.08, { a: 0.35, k: Math.max(1, b.h * 0.02), lx })
  // 백라이트가 둘레로 번진다
  ctx.save(); ctx.globalCompositeOperation = 'screen'
  const bl = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, b.h * 0.2, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.85)
  bl.addColorStop(0, 'rgba(255,170,70,0.1)'); bl.addColorStop(1, 'rgba(255,170,70,0)')
  ctx.fillStyle = bl; ctx.fillRect(b.x - b.w * 0.4, b.y - b.h * 0.6, b.w * 1.8, b.h * 2.2)
  ctx.restore()
}

/** 카세트 창 속 두 릴: 면적이 보존되도록 감긴 양을 정한다(p 0 → 1 이면 테이프가 왼쪽에서 오른쪽으로). 호출 쪽에서 창 모양으로 clip 한다 */
export function tapeReels(ctx: Ctx, o: { cx: number; cy: number; dx: number; hubR: number; rMin: number; rMax: number; p: number; ang: number }) {
  const rl = Math.sqrt(o.rMax * o.rMax * (1 - o.p) + o.rMin * o.rMin * o.p)
  const rg = Math.sqrt(o.rMin * o.rMin * (1 - o.p) + o.rMax * o.rMax * o.p)
  for (const [sx, rad] of [[-1, rl], [1, rg]] as const) {
    const x = o.cx + sx * o.dx
    const g = ctx.createRadialGradient(x, o.cy, o.rMin * 0.6, x, o.cy, rad)
    g.addColorStop(0, '#1d130d'); g.addColorStop(0.7, '#3a271a'); g.addColorStop(1, '#5a422e')
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, o.cy, rad, 0, TAU); ctx.fill()
    ctx.strokeStyle = 'rgba(255,230,200,0.2)'; ctx.lineWidth = Math.max(0.5, rad * 0.03)
    ctx.beginPath(); ctx.arc(x, o.cy, Math.max(1, rad - 0.3), Math.PI * 1.05, Math.PI * 1.45); ctx.stroke()
  }
  reelHub(ctx, o.cx - o.dx, o.cy, o.hubR, o.ang); reelHub(ctx, o.cx + o.dx, o.cy, o.hubR, o.ang)
}

/**
 * 선반·턱 위 장면(전축·붐박스·라디오)의 공통 글자 자리.
 * 넓은 화면: 왼쪽에 번호·제목·진행선·시간, 오른쪽에 싱크 가사. 세로 화면: 가운데 정렬로 쌓는다.
 */
export function bandInfo(ctx: Ctx, f: CinemaFrame, tn: Tones, o: { y0: number; tallY: number; ink?: RGB; glow?: RGB; shadow?: boolean; headlineInk?: RGB }) {
  const { w, h } = f
  const u = unit(f)
  const ink = o.ink ?? tn.ink
  const glow = o.glow ?? tn.glow
  const inst = isInst(f)
  const sh = o.shadow === false ? 0 : 0.55
  const st = (text: string, x: number, y: number, maxW: number, size: number, opts: Parameters<typeof fitText>[6]) =>
    shadowText(ctx, text, x, y, maxW, size, { ...opts, glow: sh })
  if (isTall(f)) {
    // 가사 세 줄이 화면 아래로 넘치거나 시간 글자와 겹치지 않게 블록 전체를 올린다
    const y0 = Math.min(o.tallY, h - u * (inst ? 0.22 : 0.42))
    st(`No. ${f.trackIndex + 1}`, w / 2, y0, w * 0.8, u * 0.042, { font: LATIN, color: rgba(glow), align: 'center', baseline: 'middle' })
    st(f.trackTitle, w / 2, y0 + u * 0.075, w * 0.88, u * 0.062, { font: SERIF, weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
    hairline(ctx, f, w * 0.2, y0 + u * 0.125, w * 0.6, ink)
    fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, w / 2, y0 + u * 0.16, w * 0.6, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.75), align: 'center', baseline: 'middle' })
    if (!inst) serifLyrics(ctx, f, { cx: w / 2, cy: y0 + u * 0.3, maxW: w * 0.88, size: u * 0.042, ink, around: 1, shadow: o.shadow })
    if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.032, w * 0.8, u * 0.026, { font: SANS, weight: 400, color: rgba(o.headlineInk ?? ink, 0.75), align: 'center', baseline: 'middle' })
    return
  }
  const lx = u * 0.07
  st(`No. ${f.trackIndex + 1}`, lx, o.y0, w * 0.4, u * 0.038, { font: LATIN, color: rgba(glow), baseline: 'middle' })
  st(f.trackTitle, lx, o.y0 + u * 0.065, inst ? w * 0.86 : w * 0.44, u * (inst ? 0.07 : 0.056), { font: SERIF, weight: 300, color: rgba(ink), baseline: 'middle', minSize: 12 })
  hairline(ctx, f, lx, o.y0 + u * 0.115, Math.min(w * 0.3, u * 0.5), ink)
  fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, lx, o.y0 + u * 0.145, w * 0.4, u * 0.022, { font: SANS, weight: 300, color: rgba(ink, 0.75), baseline: 'middle' })
  if (!inst) serifLyrics(ctx, f, { cx: w * 0.72, cy: o.y0 + u * 0.07, maxW: w * 0.46, size: u * 0.04, ink, around: 1, shadow: o.shadow })
  if (f.headline) fitText(ctx, f.headline, w - lx, u * 0.06, w * 0.5, u * 0.026, { font: SANS, weight: 400, color: rgba(o.headlineInk ?? ink, 0.75), align: 'right', baseline: 'middle' })
}

/** 오디오 신호 → 바늘·막대용 값(저음 평균, 고음 평균, 전체). 과거 프레임을 읽지 않는다 */
export function bandsOf(f: CinemaFrame) {
  const n = f.bars.length
  let lo = 0, hi = 0, mid = 0
  const a = Math.max(1, Math.floor(n * 0.2)), b = Math.floor(n * 0.55)
  for (let i = 0; i < a; i++) lo += f.bars[i]
  for (let i = a; i < b; i++) mid += f.bars[i]
  for (let i = b; i < n; i++) hi += f.bars[i]
  lo /= a; mid /= Math.max(1, b - a); hi /= Math.max(1, n - b)
  return { lo: clamp(lo * 1.35), mid: clamp(mid * 1.5), hi: clamp(hi * 1.8), level: clamp(f.level) }
}

/**
 * 바늘의 관성처럼 보이는 값. 이전 프레임 상태 없이 지금 값에 시각 기반 잔진동을 더해
 * 되감기·내보내기에서도 같은 프레임이 같게 그려지도록 한다.
 */
export function needleValue(raw: number, t: number, seed = 0) {
  const wob = Math.sin(t * 9.1 + seed) * 0.025 + Math.sin(t * 15.7 + seed * 2.3) * 0.012
  return clamp(Math.pow(clamp(raw), 0.85) * 0.94 + wob * (0.4 + raw))
}

// ── 글자 블록(곡 번호·제목·진행선·시간·가사) ──────────────────────
/**
 * 책상 위 장면 두 개(리얼 카세트·턴테이블)의 공통 글자 자리.
 * 넓은 화면: 왼쪽 아래에 번호·제목·진행선·시간, 오른쪽 아래에 싱크 가사. 세로 화면: 가운데 정렬로 아래에 쌓는다.
 */
export function deskInfo(ctx: Ctx, f: CinemaFrame, tn: Tones, o: { tallY: number }) {
  const { w, h } = f
  const u = unit(f)
  const tall = isTall(f)
  const ink = tn.ink
  const inst = isInst(f)
  if (tall) {
    const y0 = Math.min(o.tallY, h - u * (inst ? 0.25 : 0.48))
    shadowText(ctx, `No. ${f.trackIndex + 1}`, w / 2, y0, w * 0.8, u * 0.045, { font: LATIN, color: rgba(tn.glow), align: 'center', baseline: 'middle' })
    shadowText(ctx, f.trackTitle, w / 2, y0 + u * 0.08, w * 0.88, u * 0.066, { font: SERIF, weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
    hairline(ctx, f, w * 0.2, y0 + u * 0.15, w * 0.6, ink)
    fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, w / 2, y0 + u * 0.19, w * 0.6, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.7), align: 'center', baseline: 'middle' })
    if (!inst) serifLyrics(ctx, f, { cx: w / 2, cy: y0 + u * 0.36, maxW: w * 0.88, size: u * 0.043, ink, around: 1 })
    if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.032, w * 0.8, u * 0.026, { font: SANS, weight: 400, color: rgba(ink, 0.7), align: 'center', baseline: 'middle' })
    return
  }
  const lx = u * 0.07, by = h * 0.835
  shadowText(ctx, `No. ${f.trackIndex + 1}`, lx, by - u * 0.075, w * 0.4, u * 0.04, { font: LATIN, color: rgba(tn.glow), baseline: 'middle' })
  shadowText(ctx, f.trackTitle, lx, by, inst ? w * 0.86 : w * 0.44, u * (inst ? 0.075 : 0.06), { font: SERIF, weight: 300, color: rgba(ink), baseline: 'middle', minSize: 12 })
  hairline(ctx, f, lx, by + u * 0.07, Math.min(w * 0.3, u * 0.5), ink)
  fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, lx, by + u * 0.105, w * 0.4, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.7), baseline: 'middle' })
  if (!inst) serifLyrics(ctx, f, { cx: w * 0.74, cy: by + u * 0.02, maxW: w * 0.44, size: u * 0.042, ink, around: 1 })
  if (f.headline) fitText(ctx, f.headline, w - lx, u * 0.06, w * 0.5, u * 0.026, { font: SANS, weight: 400, color: rgba(ink, 0.7), align: 'right', baseline: 'middle' })
}

/** 사진이 없을 때의 책상 대체 배경(나무 결) */
export function deskFallback(ctx: Ctx, f: CinemaFrame) {
  const g = ctx.createLinearGradient(0, 0, f.w, f.h)
  g.addColorStop(0, '#8a5d3a'); g.addColorStop(0.45, '#4d3020'); g.addColorStop(1, '#24150d')
  ctx.fillStyle = g; ctx.fillRect(0, 0, f.w, f.h)
  texFill(ctx, woodTile(), { x: 0, y: 0, w: f.w, h: f.h }, 0.5, 'overlay', Math.max(1, unit(f) / 700))
}

/** 사진이 없을 때의 벽·선반 대체 배경: 위 벽, 가로 선반 한 단 */
export function shelfFallback(ctx: Ctx, f: CinemaFrame, wall: RGB, shelf: RGB, shelfY: number) {
  const g = ctx.createLinearGradient(0, 0, 0, shelfY)
  g.addColorStop(0, rgba(shade(wall, -0.25))); g.addColorStop(1, rgba(wall))
  ctx.fillStyle = g; ctx.fillRect(0, 0, f.w, f.h)
  const sg = ctx.createLinearGradient(0, shelfY, 0, f.h)
  sg.addColorStop(0, rgba(shade(shelf, 0.1))); sg.addColorStop(1, rgba(shade(shelf, -0.45)))
  ctx.fillStyle = sg; ctx.fillRect(0, shelfY, f.w, f.h - shelfY)
}

export { clamp as clampN }
export { isTall, isInst, unit, rng }
export type { RGB, Tones }
