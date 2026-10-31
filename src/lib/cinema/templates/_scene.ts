/**
 * 실사 장면 템플릿 공용 도구(비 오는 창가·새벽 드라이브·카페 테이블·새벽 책상·글래스 커버·타이포 그리드·필름 스트립).
 * 원칙: 색은 커버에서 뽑고, 빛·그림자·심도·그레인으로 실제 물체처럼 보이게 한다. 무거운 블러는 한 번만 만들어 캐시한다.
 * 브라우저가 아닌 곳(테스트)에서는 캐시 캔버스를 만들 수 없으므로 단순한 대체 그림으로 그린다.
 */
import type { Box, CinemaFrame } from '../types'
import { STYLE_FONT, drawCover, drawLyricBlock, fitText, hash, paintCover, roundRectPath, userFont } from '../helpers'
import { scenePlate } from '../scene'
import { drawViz } from '../viz'

export const SERIF = STYLE_FONT.serif
export const SANS = STYLE_FONT.sans
export const HAND = STYLE_FONT.hand
/** 제목 서체: 사용자가 글꼴을 골랐으면 그것, 아니면 템플릿 기본 */
export const tf = (f: CinemaFrame, base: string) => userFont(f, base)
export const LATIN = '"Instrument Serif", "Noto Serif KR", serif'

export type RGB = [number, number, number]
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

type Canvasish = OffscreenCanvas | HTMLCanvasElement
type Ctx2D = CanvasRenderingContext2D

/** 캐시용 캔버스. 테스트 등 캔버스가 없는 곳이면 null */
export function offscreen(w: number, h: number): { c: Canvasish; x: Ctx2D } | null {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h))
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h); const x = c.getContext('2d') as unknown as Ctx2D | null
      return x ? { c, x } : null
    }
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d'); return x ? { c, x } : null
    }
  } catch { /* 캔버스를 못 만들면 대체 그림 */ }
  return null
}

// ── 커버에서 뽑은 색 ────────────────────────────────────────────
export interface Tones {
  /** 가장 어두운 바탕 톤(순검정 아님) */
  deep: RGB
  /** 중간 톤 */
  mid: RGB
  /** 강조로 쓸 채도 있는 밝은 톤 */
  glow: RGB
  /** 글자색(커버 색이 살짝 섞인 흰색) */
  ink: RGB
}
const toneCache = new WeakMap<object, Tones>()
const seedToneCache = new Map<string, Tones>()

function hslRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
function finishTones(avg: RGB, dark: RGB, vivid: RGB): Tones {
  const deep = mix(dark, [8, 8, 10], 0.55)
  const glow = mix(vivid, [255, 255, 255], 0.25)
  return { deep, mid: mix(avg, deep, 0.35), glow, ink: mix([244, 240, 232], glow, 0.08) }
}

export function coverTones(f: Pick<CinemaFrame, 'cover' | 'coverSeed'>): Tones {
  if (f.cover) {
    const hit = toneCache.get(f.cover as object)
    if (hit) return hit
    const o = offscreen(24, 24)
    if (o) {
      try {
        paintCover(o.x, f, { x: 0, y: 0, w: 24, h: 24 })
        const d = o.x.getImageData(0, 0, 24, 24).data
        let sum: RGB = [0, 0, 0]; let dark: RGB = [255, 255, 255]; let darkL = 1e9; let vivid: RGB = [200, 200, 200]; let best = -1
        for (let i = 0; i < d.length; i += 4) {
          const c: RGB = [d[i], d[i + 1], d[i + 2]]
          sum = [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]]
          const mx = Math.max(...c), mn = Math.min(...c), l = (mx + mn) / 2
          if (l < darkL && l > 6) { darkL = l; dark = c }
          const score = (mx - mn) * (1 - Math.abs(l - 150) / 150)
          if (score > best) { best = score; vivid = c }
        }
        const n = d.length / 4
        const t = finishTones([sum[0] / n, sum[1] / n, sum[2] / n], dark, vivid)
        toneCache.set(f.cover as object, t)
        return t
      } catch { /* 읽을 수 없는 그림이면 시드 색 */ }
    }
  }
  const hit = seedToneCache.get(f.coverSeed)
  if (hit) return hit
  const h = hash(f.coverSeed) % 360
  const t = finishTones(hslRgb(h, 0.45, 0.35), hslRgb((h + 40) % 360, 0.5, 0.1), hslRgb(h, 0.7, 0.62))
  seedToneCache.set(f.coverSeed, t)
  return t
}

// ── 배경 사진 ──────────────────────────────────────────────────
export interface PlateMap {
  /** 사진 좌표(0..1) → 화면 좌표 */
  x: (u: number) => number
  y: (v: number) => number
  /** 사진 높이 1 이 화면에서 몇 px 인지 */
  scale: number
}

/**
 * 배경 사진을 화면에 꽉 차게 그린다. focus(0..1)는 화면이 좁을 때 남길 사진 위치, zoom 은 확대(1 이상).
 * 사진이 없으면 null(템플릿이 대체 그림을 그린다).
 */
export function drawPlate(ctx: Ctx2D, f: CinemaFrame, name: string, o: { fx?: number; fy?: number; zoom?: number; panX?: number } = {}): PlateMap | null {
  const img = scenePlate(name)
  if (!img) return null
  const iw = (img as ImageBitmap).width, ih = (img as ImageBitmap).height
  if (!iw || !ih) return null
  const s = Math.max(f.w / iw, f.h / ih) * (o.zoom ?? 1)
  const dw = iw * s, dh = ih * s
  const fx = o.panX ?? o.fx ?? 0.5, fy = o.fy ?? 0.5
  const dx = Math.min(0, Math.max(f.w - dw, f.w / 2 - fx * dw))
  const dy = Math.min(0, Math.max(f.h - dh, f.h / 2 - fy * dh))
  ctx.drawImage(img, dx, dy, dw, dh)
  return { x: u => dx + u * dw, y: v => dy + v * dh, scale: dh }
}

/** 사진이 없을 때 쓰는 커버 색 대체 배경(위는 어둡고 아래로 갈수록 커버 색) */
export function fallbackBackdrop(ctx: Ctx2D, f: CinemaFrame, tn: Tones) {
  const g = ctx.createLinearGradient(0, 0, 0, f.h)
  g.addColorStop(0, rgba(tn.deep)); g.addColorStop(1, rgba(tn.mid))
  ctx.fillStyle = g; ctx.fillRect(0, 0, f.w, f.h)
}

// ── 커버 캐시(정사각·블러) ───────────────────────────────────────
const sqCache = new WeakMap<object, Map<number, Canvasish>>()
const seedSq = new Map<string, Canvasish>()
/** 커버를 정사각 캔버스로(원근 그리기·반사용). 없으면 null */
export function coverSquare(f: CinemaFrame, size: number): Canvasish | null {
  size = Math.max(16, Math.round(size / 64) * 64)
  const key = f.cover as object | null
  if (key) { const m = sqCache.get(key)?.get(size); if (m) return m } else { const m = seedSq.get(f.coverSeed + size); if (m) return m }
  const o = offscreen(size, size); if (!o) return null
  paintCover(o.x, f, { x: 0, y: 0, w: size, h: size })
  if (key) { const m = sqCache.get(key) ?? new Map(); m.set(size, o.c); sqCache.set(key, m) } else seedSq.set(f.coverSeed + size, o.c)
  return o.c
}

const blurCache = new WeakMap<object, Map<string, Canvasish>>()
const seedBlur = new Map<string, Canvasish>()
/** 커버를 크게 흐린 배경(한 번만 만들어 둔다). 없으면 null */
export function coverBlur(f: CinemaFrame, w: number, h: number, amount = 0.05): Canvasish | null {
  const sw = Math.max(32, Math.round(w / 6)), sh = Math.max(32, Math.round(h / 6))
  const k = `${sw}x${sh}:${amount}`
  const key = f.cover as object | null
  if (key) { const m = blurCache.get(key)?.get(k); if (m) return m } else { const m = seedBlur.get(f.coverSeed + k); if (m) return m }
  const o = offscreen(sw, sh); if (!o) return null
  const b = Math.max(2, Math.round(Math.min(sw, sh) * amount))
  o.x.filter = `blur(${b}px) saturate(1.15)`
  paintCover(o.x, f, { x: -b * 3, y: -b * 3, w: sw + b * 6, h: sh + b * 6 })
  o.x.filter = 'none'
  if (key) { const m = blurCache.get(key) ?? new Map(); m.set(k, o.c); blurCache.set(key, m) } else seedBlur.set(f.coverSeed + k, o.c)
  return o.c
}

// ── 필름 그레인·비네트 ──────────────────────────────────────────
let noiseTile: Canvasish | null | undefined
function noise(): Canvasish | null {
  if (noiseTile !== undefined) return noiseTile
  const o = offscreen(192, 192)
  if (!o) { noiseTile = null; return null }
  const img = o.x.createImageData(192, 192)
  let s = 0x2f6b9d1
  for (let i = 0; i < img.data.length; i += 4) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const v = 128 + ((s >>> 24) - 128) * 0.9
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255
  }
  o.x.putImageData(img, 0, 0)
  noiseTile = o.c
  return o.c
}

/** 필름 그레인. 프레임마다 위치가 바뀌어 살아 있는 입자처럼 보인다(결정적: 시각 → 위치) */
export function grain(ctx: Ctx2D, f: CinemaFrame, amount = 0.07) {
  const n = noise(); if (!n) return
  const pat = ctx.createPattern(n as CanvasImageSource, 'repeat'); if (!pat) return
  const fr = Math.floor(f.t * 24)
  const ox = (hash('gx' + fr) % 192), oy = (hash('gy' + fr) % 192)
  const sc = Math.max(1, Math.min(f.w, f.h) / 900)
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = amount
  ctx.translate(-ox * sc, -oy * sc)
  ctx.scale(sc, sc)
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, (f.w + 192 * sc * 2) / sc, (f.h + 192 * sc * 2) / sc)
  ctx.restore()
}

export function vignette(ctx: Ctx2D, f: CinemaFrame, strength = 0.55, tint: RGB = [6, 6, 8]) {
  const r = Math.hypot(f.w, f.h) / 2
  const g = ctx.createRadialGradient(f.w / 2, f.h / 2, r * 0.35, f.w / 2, f.h / 2, r)
  g.addColorStop(0, rgba(tint, 0)); g.addColorStop(1, rgba(tint, strength))
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, f.w, f.h); ctx.restore()
}

/** 아래(또는 위)로 어두워지는 띠 — 글자 받침 */
export function scrim(ctx: Ctx2D, f: CinemaFrame, from: number, to: number, c: RGB, a = 0.75) {
  const g = ctx.createLinearGradient(0, from, 0, to)
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, a))
  ctx.save(); ctx.fillStyle = g
  if (to >= from) ctx.fillRect(0, from, f.w, f.h - from); else ctx.fillRect(0, 0, f.w, from)
  ctx.restore()
}

// ── 실제 물체처럼 서 있는 커버 ─────────────────────────────────────
/** 바닥에 닿는 그림자(블러 없이 방사 그라데이션) */
export function contactShadow(ctx: Ctx2D, cx: number, cy: number, rx: number, ry: number, a = 0.55) {
  ctx.save()
  ctx.translate(cx, cy); ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(10,7,4,${a})`); g.addColorStop(0.55, `rgba(10,7,4,${a * 0.45})`); g.addColorStop(1, 'rgba(10,7,4,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/**
 * 탁자·창턱 위에 서 있는 커버. b 는 커버 면, light 는 빛이 오는 쪽(-1 왼쪽 … 1 오른쪽).
 * kind: 'sleeve' 종이 슬리브 / 'frame' 나무 액자+매트 / 'print' 얇은 인화지
 */
export function standingCover(ctx: Ctx2D, f: CinemaFrame, b: Box, o: { light?: number; kind?: 'sleeve' | 'frame' | 'print'; warm?: RGB; shadow?: number } = {}) {
  const light = o.light ?? -1
  const kind = o.kind ?? 'sleeve'
  const warm = o.warm ?? [255, 214, 160]
  const u = b.w
  // 바닥 접지 그림자 + 빛 반대편으로 길게 떨어지는 그림자
  contactShadow(ctx, b.x + b.w / 2 - light * u * 0.08, b.y + b.h, b.w * 0.62, u * 0.05, o.shadow ?? 0.6)
  ctx.save()
  ctx.shadowColor = 'rgba(8,6,4,0.45)'; ctx.shadowBlur = u * 0.07; ctx.shadowOffsetX = -light * u * 0.05; ctx.shadowOffsetY = u * 0.02
  let face = b
  if (kind === 'frame') {
    const fw = u * 0.055
    const wood = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
    wood.addColorStop(0, '#5a3d27'); wood.addColorStop(0.5, '#3e2818'); wood.addColorStop(1, '#2a1a10')
    ctx.fillStyle = wood; ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#ece6da'
    ctx.fillRect(b.x + fw, b.y + fw, b.w - fw * 2, b.h - fw * 2)
    const m = fw + u * 0.07
    const fs = b.w - m * 2
    face = { x: b.x + m, y: b.y + m, w: fs, h: Math.min(fs, b.h - m * 2) }
    // 매트 안쪽 베벨 그림자
    ctx.fillStyle = 'rgba(40,30,20,0.25)'; ctx.fillRect(face.x - 2, face.y - 2, face.w + 4, 3)
  } else {
    ctx.fillStyle = '#1a1612'; ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.shadowColor = 'transparent'
  }
  drawCover(ctx, f, face, kind === 'print' ? u * 0.004 : 0)
  ctx.restore()
  // 빛: 빛이 오는 쪽은 따뜻하게 밝고 반대쪽은 가라앉는다
  ctx.save()
  const lg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y)
  const near = rgba(warm, 0.16), far = 'rgba(10,8,6,0.32)'
  lg.addColorStop(0, light < 0 ? near : far); lg.addColorStop(1, light < 0 ? far : near)
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = lg; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.globalCompositeOperation = 'source-over'
  const vg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  vg.addColorStop(0, 'rgba(255,255,255,0.06)'); vg.addColorStop(0.7, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = vg; ctx.fillRect(b.x, b.y, b.w, b.h)
  // 종이 모서리 하이라이트(빛 쪽 세로 모서리, 윗모서리)
  ctx.fillStyle = rgba(warm, 0.35)
  ctx.fillRect(light < 0 ? b.x : b.x + b.w - 1.5, b.y, 1.5, b.h)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(b.x, b.y, b.w, 1)
  ctx.restore()
}

/**
 * 원근(세로축 회전) 커버. 정사각 커버를 세로 조각으로 나눠 가까운 쪽은 크게, 먼 쪽은 작게 그린다.
 * 캐시 캔버스를 못 만들면 평면 커버로 대신한다. 반환: 화면에 그려진 대략의 박스
 */
export function perspectiveCover(ctx: Ctx2D, f: CinemaFrame, cx: number, cy: number, size: number, angle: number, o: { reflect?: number; radius?: number; fade?: RGB } = {}): Box & { quad: [number, number][] } {
  const src = coverSquare(f, Math.min(1024, size * 1.2))
  const half = size / 2
  const focal = size * 2.6
  const sin = Math.sin(angle), cos = Math.cos(angle)
  const proj = (x: number) => { const z = x * sin; const k = focal / (focal + z); return { X: cx + x * cos * k, k } }
  const L = proj(-half), R = proj(half)
  const box = { x: Math.min(L.X, R.X), y: cy - half * Math.max(L.k, R.k), w: Math.abs(R.X - L.X), h: size * Math.max(L.k, R.k) }
  const quad: [number, number][] = [[L.X, cy - half * L.k], [R.X, cy - half * R.k], [R.X, cy + half * R.k], [L.X, cy + half * L.k]]
  if (!src) {
    drawCover(ctx, f, { x: cx - half, y: cy - half, w: size, h: size }, o.radius ?? 0)
    return { x: cx - half, y: cy - half, w: size, h: size, quad: [[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]] }
  }
  const sw = (src as { width: number }).width
  const N = 72
  const drawSlices = (flip: boolean, alpha: number) => {
    for (let i = 0; i < N; i++) {
      const x0 = -half + (i / N) * size, x1 = -half + ((i + 1) / N) * size
      const a = proj(x0), b = proj(x1)
      const k = (a.k + b.k) / 2
      const hh = half * k
      const sx = (i / N) * sw, sW = sw / N + 0.5
      ctx.globalAlpha = alpha
      if (!flip) ctx.drawImage(src as CanvasImageSource, sx, 0, sW, sw, a.X, cy - hh, b.X - a.X + 0.6, hh * 2)
      else {
        ctx.save(); ctx.translate(0, cy + hh); ctx.scale(1, -1)
        ctx.drawImage(src as CanvasImageSource, sx, 0, sW, sw, a.X, -hh, b.X - a.X + 0.6, hh * 2)
        ctx.restore()
      }
    }
  }
  ctx.save()
  // 바닥 반사(아래로 갈수록 사라짐)
  if (o.reflect) {
    drawSlices(true, o.reflect)
    ctx.globalAlpha = 1
    const g = ctx.createLinearGradient(0, box.y + box.h, 0, box.y + box.h * 1.5)
    g.addColorStop(0, rgba(o.fade ?? [8, 8, 10], 0.2)); g.addColorStop(1, rgba(o.fade ?? [8, 8, 10], 1))
    ctx.fillStyle = g; ctx.fillRect(box.x - 4, box.y + box.h, box.w + 8, box.h * 0.75)
  }
  drawSlices(false, 1)
  ctx.globalAlpha = 1
  ctx.restore()
  return { ...box, quad }
}

// ── 글자 ────────────────────────────────────────────────────────
/** 그림자 진 글자(사진 위에서도 읽히게). fitText 와 같은 인자 */
export function shadowText(ctx: Ctx2D, text: string, x: number, y: number, maxW: number, size: number, opts: Parameters<typeof fitText>[6] & { glow?: number } = {}) {
  ctx.save()
  ctx.shadowColor = `rgba(6,5,4,${opts.glow ?? 0.55})`; ctx.shadowBlur = size * 0.5
  const w = fitText(ctx, text, x, y, maxW, size, opts)
  ctx.restore()
  return w
}

/** 싱크 가사(명조). 경음악이면 아무것도 그리지 않는다 */
export function serifLyrics(ctx: Ctx2D, f: CinemaFrame, o: { cx: number; cy: number; maxW: number; size: number; align?: CanvasTextAlign; ink: RGB; accent?: RGB; around?: number; shadow?: boolean; font?: string; weight?: number }) {
  ctx.save()
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(6,5,4,0.6)'; ctx.shadowBlur = o.size * 0.45 }
  drawLyricBlock(ctx, f, { cx: o.cx, cy: o.cy, maxW: o.maxW, size: o.size, around: o.around ?? 1, align: o.align ?? 'center', color: rgba(o.ink, 0.9), accent: rgba(o.accent ?? o.ink), font: o.font ?? SERIF, weight: o.weight ?? 500 })
  ctx.restore()
}

/** 얇은 진행선 + 지금 위치 점 */
export function hairline(ctx: Ctx2D, f: CinemaFrame, x: number, y: number, w: number, c: RGB, thick = 1.5) {
  const p = f.duration > 0 ? Math.min(1, Math.max(0, f.t / f.duration)) : 0
  ctx.save()
  ctx.fillStyle = rgba(c, 0.22); ctx.fillRect(x, y - thick / 2, w, thick)
  ctx.fillStyle = rgba(c, 0.9); ctx.fillRect(x, y - thick / 2, w * p, thick)
  ctx.beginPath(); ctx.arc(x + w * p, y, thick * 2.2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/** 형태(스펙트럼)를 낮은 불투명도로 — 장면 속 빛처럼 */
export function softViz(ctx: Ctx2D, f: CinemaFrame, bar: Box, ring: Box, alpha = 0.8) {
  ctx.save(); ctx.globalAlpha = alpha
  drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, { bar, ring })
  ctx.restore()
}

export const trackNoLatin = (f: CinemaFrame) => `No. ${f.trackIndex + 1}`
export const ofCount = (f: CinemaFrame) => `${String(f.trackIndex + 1).padStart(2, '0')} — ${String(f.trackCount).padStart(2, '0')}`

/** 글자 박스 안에서 둥근 유리판(배경 블러 캐시를 잘라 깐다) */
export function glassPanel(ctx: Ctx2D, f: CinemaFrame, b: Box, r: number, tn: Tones) {
  const bl = coverBlur(f, f.w, f.h, 0.12)
  ctx.save()
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r)
  ctx.clip()
  if (bl) { ctx.globalAlpha = 0.9; ctx.drawImage(bl as CanvasImageSource, 0, 0, f.w, f.h); ctx.globalAlpha = 1 }
  ctx.fillStyle = rgba(tn.deep, 0.42); ctx.fillRect(b.x, b.y, b.w, b.h)
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.6, b.y + b.h)
  g.addColorStop(0, 'rgba(255,255,255,0.13)'); g.addColorStop(0.45, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, r)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()
}

export { roundRectPath as roundRect }
