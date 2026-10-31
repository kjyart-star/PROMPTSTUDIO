/** 템플릿 내부 공용 도구(레이아웃 판정·팔레트 그라데이션·진행바·가사/제목 자리). 템플릿끼리 import 하지 않고 여기만 쓴다. */
import type { Box, CinemaFrame } from '../types'
import { FONT, clamp01, drawLyricBlock, fitText, progressOf, roundRectPath } from '../helpers'
import { withEl } from '../layout'

export { FONT }

/** 짧은 쪽 길이 — 글자 크기·여백의 기준 */
export const unit = (f: CinemaFrame) => Math.min(f.w, f.h)
/** 세로로 긴 화면(9:16)이면 true. 1:1·4:3·16:9 는 false */
export const isTall = (f: CinemaFrame) => f.h > f.w * 1.15
export const isInst = (f: CinemaFrame) => f.kind !== 'lyrics' || !f.lines.length

/** 결정적 난수(같은 시드 → 같은 수열) */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

/** 팔레트 색을 균등 정지점으로 갖는 선형 그라데이션 */
export function paletteGrad(ctx: CanvasRenderingContext2D, f: CinemaFrame, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  const cs = f.palette.colors.length ? f.palette.colors : [f.palette.accent, f.palette.accent]
  cs.forEach((c, i) => g.addColorStop(cs.length === 1 ? 0 : i / (cs.length - 1), c))
  return g
}

/** 곡 진행바(팔레트 그라데이션). track 은 빈 부분 색 */
export function progressBar(ctx: CanvasRenderingContext2D, f: CinemaFrame, b: Box, track = 'rgba(255,255,255,0.22)', knob = true) {
  withEl(ctx, 'progress', { x: b.x, y: b.y - b.h * 1.5, w: b.w, h: b.h * 4 }, () => paintProgress(ctx, f, b, track, knob))
}
function paintProgress(ctx: CanvasRenderingContext2D, f: CinemaFrame, b: Box, track: string, knob: boolean) {
  const p = progressOf(f)
  ctx.save()
  ctx.fillStyle = track
  roundRectPath(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.fill()
  if (p > 0) {
    ctx.fillStyle = paletteGrad(ctx, f, b.x, 0, b.x + b.w, 0)
    roundRectPath(ctx, b.x, b.y, Math.max(b.h, b.w * p), b.h, b.h / 2); ctx.fill()
  }
  if (knob) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(b.x + b.w * p, b.y + b.h / 2, b.h * 1.1, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

export const trackNo = (f: CinemaFrame) =>
  `${String(f.trackIndex + 1).padStart(2, '0')} / ${String(f.trackCount).padStart(2, '0')}`

/** 밝은 배경 위에서도 원형 형태가 보이도록 뒤에 까는 어두운 원판 */
export function ringSpot(ctx: CanvasRenderingContext2D, ring: Box, color = 'rgba(16,14,20,0.9)', k = 1.42) {
  const R = Math.min(ring.w, ring.h) / 2
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(ring.x + ring.w / 2, ring.y + ring.h / 2, R * k, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/** 원형 형태의 막대 끝(반지름의 약 1.36배)이 화면 밖으로 나가지 않도록 크기를 줄인 정사각 박스 */
export function fitRing(f: CinemaFrame, cx: number, cy: number, side: number): Box {
  const room = Math.min(cx, cy, f.w - cx, f.h - cy)
  const s = Math.min(side, (2 * room) / 1.4)
  return { x: cx - s / 2, y: cy - s / 2, w: s, h: s }
}

/** 정사각 박스(센터 기준) */
export const squareAt = (cx: number, cy: number, side: number): Box => ({ x: cx - side / 2, y: cy - side / 2, w: side, h: side })

/**
 * 가사 자리. 가사 영상이면 싱크 가사 블록, 경음악이면 곡 제목을 크게(titleInst=true 일 때).
 * 반환: 가사를 그렸으면 true
 */
export function lyricSlot(
  ctx: CanvasRenderingContext2D, f: CinemaFrame,
  o: { cx: number; cy: number; maxW: number; size: number; around?: number; align?: CanvasTextAlign; color?: string; accent?: string; titleInst?: boolean; titleColor?: string },
): boolean {
  if (!isInst(f)) {
    drawLyricBlock(ctx, f, { cx: o.cx, cy: o.cy, maxW: o.maxW, size: o.size, around: o.around, align: o.align, color: o.color, accent: o.accent })
    return true
  }
  if (o.titleInst) {
    fitText(ctx, f.trackTitle, o.cx, o.cy, o.maxW, o.size * 1.5, { weight: 800, color: o.titleColor ?? o.color ?? '#fff', align: o.align ?? 'center', baseline: 'middle', minSize: 10 })
  }
  return false
}

export { clamp01 }
