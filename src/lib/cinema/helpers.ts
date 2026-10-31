/** 템플릿 공용 그리기 도구. 모든 템플릿은 여기 함수로 커버·글자·가사를 그린다. */
import type { CinemaFrame, Box } from './types'
import { curAdj, curKey, textKey, withEl, activeFrame } from './layout'

export const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif'

/** 사용자가 고른 글꼴(글자 탭) → 실제 서체. 'auto' 면 템플릿 기본 */
export const STYLE_FONT: Record<'serif' | 'sans' | 'hand', string> = {
  serif: '"Noto Serif KR", "Nanum Myeongjo", AppleMyungjo, serif',
  sans: `"IBM Plex Sans KR", ${FONT}`,
  hand: '"Nanum Pen Script", "Noto Serif KR", cursive',
}
export const userFont = (f: Pick<CinemaFrame, 'fontStyle'>, base: string) => (f.fontStyle && f.fontStyle !== 'auto' ? STYLE_FONT[f.fontStyle] : base)

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** 커버가 없을 때 쓰는 곡별 고정 그라데이션 색 */
export function seedColors(seed: string): [string, string] {
  const h = hash(seed) % 360
  return [`hsl(${h} 55% 42%)`, `hsl(${(h + 48) % 360} 60% 22%)`]
}

/** 박스 안에 커버를 꽉 차게(cover-fit) 그린다. 이미지가 없으면 시드 그라데이션. 둥근 모서리 r(px). */
let ownShadow = false
/** 커버 그림자를 직접 그리는 그리기(탁자 위 커버 등)는 이 동안 drawCover 의 그림자 조정을 끈다 */
export function withOwnCoverShadow(fn: () => void) { ownShadow = true; try { fn() } finally { ownShadow = false } }

export function drawCover(ctx: CanvasRenderingContext2D, f: Pick<CinemaFrame, 'cover' | 'coverSeed'>, b: Box, r = 0) {
  const a = curKey() === 'cover' ? curAdj() : undefined
  if (a?.radius !== undefined) r = a.radius * Math.min(b.w, b.h)
  if (a?.shadow && !ownShadow) {
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${0.75 * a.shadow})`; ctx.shadowBlur = Math.min(b.w, b.h) * 0.12 * a.shadow; ctx.shadowOffsetY = Math.min(b.w, b.h) * 0.03 * a.shadow
    ctx.fillStyle = '#000'; roundRectPath(ctx, b.x, b.y, b.w, b.h, r); ctx.fill()
    ctx.restore()
  }
  ctx.save()
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r)
  ctx.clip()
  paintCover(ctx, f, b)
  ctx.restore()
}

export function paintCover(ctx: CanvasRenderingContext2D, f: Pick<CinemaFrame, 'cover' | 'coverSeed'>, b: Box) {
  const img = f.cover
  const iw = img ? sizeOf(img).w : 0
  const ih = img ? sizeOf(img).h : 0
  if (img && iw > 0 && ih > 0) {
    const s = Math.max(b.w / iw, b.h / ih)
    const dw = iw * s, dh = ih * s
    ctx.drawImage(img, b.x + (b.w - dw) / 2, b.y + (b.h - dh) / 2, dw, dh)
    return
  }
  const [c1, c2] = seedColors(f.coverSeed)
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
  g.addColorStop(0, c1); g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath(); ctx.arc(b.x + b.w * 0.68, b.y + b.h * 0.34, Math.min(b.w, b.h) * 0.22, 0, Math.PI * 2); ctx.fill()
}

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  const a = img as unknown as { width?: number; height?: number; videoWidth?: number; naturalWidth?: number }
  return { w: a.naturalWidth || a.videoWidth || a.width || 0, h: a.height ? (a as { naturalHeight?: number }).naturalHeight || a.height : 0 }
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 커버를 크게 확대해 블러·어둡게 깐 전체 배경. dim 0..1 */
export function drawBlurBackdrop(ctx: CanvasRenderingContext2D, f: CinemaFrame, dim = 0.55, blurPx?: number) {
  const { w, h } = f
  ctx.save()
  ctx.fillStyle = '#0a0b0e'
  ctx.fillRect(0, 0, w, h)
  const blur = blurPx ?? Math.round(Math.min(w, h) * 0.04)
  if ('filter' in ctx) ctx.filter = `blur(${blur}px) saturate(1.2)`
  const pad = blur * 2
  paintCover(ctx, f, { x: -pad, y: -pad, w: w + pad * 2, h: h + pad * 2 })
  if ('filter' in ctx) ctx.filter = 'none'
  ctx.fillStyle = `rgba(0,0,0,${dim})`
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function pad2(n: number): string { return String(n).padStart(2, '0') }

/** 한 줄에 들어가도록 글자 크기를 줄이며 가운데/왼쪽 정렬로 그린다. 그린 글자 폭을 돌려준다 */
export function fitText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number,
  opts: { weight?: number | string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; minSize?: number; font?: string } = {},
): number {
  const { weight = 700, align = 'left', baseline = 'alphabetic', minSize = 8 } = opts
  // 직접 조정: 곡 제목·타이틀 문구는 자동으로 요소가 된다(템플릿 코드 그대로)
  const auto = textKey(text)
  const adj = auto ? activeFrame()?.layout?.[auto] : curKey() && curKey() !== 'cover' ? curAdj() : undefined
  const font = adj?.font && adj.font !== 'auto' ? STYLE_FONT[adj.font] : (opts.font ?? FONT)
  const color = adj?.color ?? opts.color ?? '#fff'
  let s = size
  ctx.font = `${weight} ${s}px ${font}`
  let tw = ctx.measureText(text).width
  while (tw > maxW && s > minSize) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; tw = ctx.measureText(text).width }
  let out = text
  if (tw > maxW) { while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1); out += '…'; tw = ctx.measureText(out).width }
  const paint = () => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline
    if (adj?.shadow) {
      ctx.save(); ctx.shadowColor = `rgba(0,0,0,${0.8 * adj.shadow})`; ctx.shadowBlur = s * 0.5 * adj.shadow; ctx.shadowOffsetY = s * 0.06 * adj.shadow
      ctx.fillText(out, x, y); ctx.restore()
    } else ctx.fillText(out, x, y)
  }
  if (auto) {
    const bx = align === 'center' ? x - tw / 2 : align === 'right' || align === 'end' ? x - tw : x
    const top = baseline === 'middle' ? y - s * 0.6 : baseline === 'top' || baseline === 'hanging' ? y : y - s * 0.85
    withEl(ctx, auto, { x: bx, y: top, w: tw, h: s * 1.2 }, paint)
  } else paint()
  return tw
}

/** 글자를 maxW 안에서 여러 줄로 나눈다(한글은 글자 단위, 공백 있으면 단어 단위 우선) */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 3): string[] {
  const out: string[] = []
  let cur = ''
  const tokens = text.includes(' ') ? text.split(/(\s+)/) : Array.from(text)
  for (const tk of tokens) {
    const next = cur + tk
    if (ctx.measureText(next).width > maxW && cur) { out.push(cur.trim()); cur = tk.trimStart() } else cur = next
  }
  if (cur.trim()) out.push(cur.trim())
  if (out.length > maxLines) { const keep = out.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/.{0,1}$/, '…'); return keep }
  return out
}

export interface LyricBlockOpts {
  /** 가운데 기준 x, 세로 중심 y */
  cx: number; cy: number; maxW: number
  /** 현재 줄 글자 크기(px). 앞뒤 줄은 0.62배 */
  size: number
  /** 앞뒤로 보이는 줄 수 */
  around?: number
  align?: CanvasTextAlign
  color?: string
  /** 현재 줄 강조색 */
  accent?: string
  font?: string
  weight?: number
}

/**
 * 싱크 가사 블록: 현재 줄 크게·밝게, 앞뒤 줄 흐리게. 현재 줄이 바뀔 때 부드럽게 미끄러지게(시간 기반 보간).
 * 가사 영상이 아니면(lines 비어 있음) 아무것도 그리지 않는다.
 */
export function drawLyricBlock(ctx: CanvasRenderingContext2D, f: CinemaFrame, o: LyricBlockOpts) {
  if (f.kind !== 'lyrics' || !f.lines.length) return
  const around = f.lyricLines === 'one' ? 0 : f.lyricLines === 'three' ? 1 : (o.around ?? 1)
  const align = o.align ?? 'center'
  const lineH0 = o.size * 1.55
  const bx = align === 'center' ? o.cx - o.maxW / 2 : align === 'right' || align === 'end' ? o.cx - o.maxW : o.cx
  withEl(ctx, 'lyrics', { x: bx, y: o.cy - lineH0 * (around + 0.6), w: o.maxW, h: lineH0 * (around * 2 + 1.2) }, () => paintLyricBlock(ctx, f, o, around))
  if (f.lyricsEstimated) drawEstimatedBadge(ctx, f)
}

function paintLyricBlock(ctx: CanvasRenderingContext2D, f: CinemaFrame, o: LyricBlockOpts, around: number) {
  const adj = curKey() === 'lyrics' ? curAdj() : undefined
  const align = o.align ?? 'center'
  const color = adj?.color ?? o.color ?? '#fff'
  const font = adj?.font && adj.font !== 'auto' ? STYLE_FONT[adj.font] : userFont(f, o.font ?? FONT)
  if (adj?.shadow) { ctx.save(); ctx.shadowColor = `rgba(0,0,0,${0.8 * adj.shadow})`; ctx.shadowBlur = o.size * 0.5 * adj.shadow }
  const weight = o.weight ?? 700
  const act = f.activeIndex
  // 줄 전환 보간: 현재 줄 시작 후 0.35초 동안 0→1
  const startT = act >= 0 ? f.lines[act].start : 0
  const k = act >= 0 ? Math.min(1, Math.max(0, (f.t - startT) / 0.35)) : 1
  const ease = 1 - Math.pow(1 - k, 3)
  const lineH = o.size * 1.55
  ctx.save()
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const first = act < 0 ? 0 : act - around - 1
  for (let idx = first; idx <= (act < 0 ? around + 1 : act + around + 1); idx++) {
    if (idx < 0 || idx >= f.lines.length) continue
    // 현재 줄이 바뀌면 이전 줄 자리에서 가운데로 미끄러져 들어온다
    const rel = act < 0 ? idx + 1 : idx - act + (1 - ease)
    const dist = Math.abs(rel)
    if (dist > around + 1) continue
    const isCur = idx === act
    const sz = isCur ? o.size : o.size * 0.62
    const alpha = isCur ? 1 : 0.45 * Math.max(0, Math.min(1, around + 1 - dist))
    ctx.font = `${weight} ${sz}px ${font}`
    ctx.globalAlpha = alpha
    ctx.fillStyle = isCur ? (adj?.color ?? o.accent ?? color) : color
    let text = f.lines[idx].text
    while (text.length > 2 && ctx.measureText(text).width > o.maxW) text = text.slice(0, -1)
    if (text !== f.lines[idx].text) text += '…'
    ctx.fillText(text, o.cx, o.cy + rel * lineH)
  }
  ctx.restore()
  if (adj?.shadow) ctx.restore()
}

export function drawEstimatedBadge(ctx: CanvasRenderingContext2D, f: CinemaFrame, x?: number, y?: number) {
  const s = Math.max(10, Math.round(Math.min(f.w, f.h) * 0.016))
  ctx.save()
  ctx.font = `600 ${s}px ${FONT}`
  ctx.textAlign = x === undefined ? 'right' : 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillText('가사 시간 추정', x ?? f.w - s * 1.6, y ?? f.h - s * 1.4)
  ctx.restore()
}

/** 짧은 구간 보간 도구 */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** 곡 진행 0..1 */
export const progressOf = (f: CinemaFrame) => (f.duration > 0 ? clamp01(f.t / f.duration) : 0)
