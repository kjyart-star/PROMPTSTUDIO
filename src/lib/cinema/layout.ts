/**
 * 화면 요소 직접 조정(위치·크기·글꼴·색·그림자·모서리). 모든 템플릿 공용.
 * 템플릿 코드는 그대로 두고 공용 그리기 도구(fitText·drawLyricBlock·drawViz·progressBar·hairline)가
 * 「지금 그리는 프레임」의 조정값을 읽어 그 요소만 옮기고 키운다. 조정값이 없으면 원래 그림과 똑같다.
 * 그린 요소의 화면 박스는 f.hits 에 모아 미리보기의 선택·드래그에 쓴다.
 */
import type { Box, CinemaFrame, ElAdjust, ElKey } from './types'

export const EL_LABEL: Record<ElKey, string> = {
  headline: '타이틀 문구', title: '곡 제목', lyrics: '가사', cover: '커버', viz: '스펙트럼', progress: '진행바',
}
export const TEXT_ELS: ElKey[] = ['headline', 'title', 'lyrics']

let active: CinemaFrame | null = null
let cur: { key: ElKey; adj: ElAdjust } | null = null
const used = new Set<ElKey>()

/** drawFrame 이 템플릿을 부르기 전후로 부른다 */
export function beginFrame(f: CinemaFrame) { active = f; cur = null; used.clear() }
export function endFrame() { active = null; cur = null; used.clear() }

/** 지금 그리는 요소의 조정값(요소 밖이면 undefined) */
export const curAdj = (): ElAdjust | undefined => cur?.adj
export const curKey = (): ElKey | undefined => cur?.key
export const activeFrame = () => active

/** 자동 판별: 곡 제목·타이틀 문구 글자 */
export function textKey(text: string): ElKey | null {
  if (!active || cur) return null
  // 같은 글자를 두 군데 그리는 템플릿은 처음 그린 쪽만 요소로 삼는다
  if (text && text === active.trackTitle) return used.has('title') ? null : 'title'
  if (active.headline && text === active.headline) return used.has('headline') ? null : 'headline'
  return null
}

/**
 * 요소 하나를 그린다. box 는 조정 전 요소의 화면 박스(가운데를 기준으로 옮기고 키운다).
 * 이미 다른 요소 안이면(중첩) 그대로 그린다.
 */
export function withEl(ctx: CanvasRenderingContext2D, key: ElKey, box: Box, draw: () => void) {
  const f = active
  if (!f || cur) { draw(); return }
  const a = f.layout?.[key] ?? {}
  const k = a.scale ?? 1, dx = (a.dx ?? 0) * f.w, dy = (a.dy ?? 0) * f.h
  used.add(key)
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const moved = dx !== 0 || dy !== 0 || k !== 1
  cur = { key, adj: a }
  if (moved) { ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.scale(k, k); ctx.translate(-cx, -cy) }
  try { draw() } finally { if (moved) ctx.restore(); cur = null }
  if (f.hits) {
    // 템플릿이 회전·이동한 좌표계 안에서 그려도 화면 좌표로 박스를 잡는다
    const gt = (ctx as { getTransform?: () => DOMMatrix | undefined }).getTransform
    const m = typeof gt === 'function' ? gt.call(ctx) : undefined
    let nb: Box = { x: cx + dx - (box.w * k) / 2, y: cy + dy - (box.h * k) / 2, w: box.w * k, h: box.h * k }
    if (m && typeof m.a === 'number' && !(m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0)) {
      const pts = [[nb.x, nb.y], [nb.x + nb.w, nb.y], [nb.x, nb.y + nb.h], [nb.x + nb.w, nb.y + nb.h]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f])
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
      nb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    }
    const o = f.hits[key]
    f.hits[key] = o ? union(o, nb) : nb
  }
}

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}
