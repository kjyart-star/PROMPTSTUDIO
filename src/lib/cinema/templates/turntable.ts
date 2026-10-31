import type { CinemaFrame, CinemaTemplate } from '../types'
import { drawCover, fitText, progressOf } from '../helpers'
import { TAU, castShadow, clamp, deskFallback, deskInfo, edgeLight, isTall, knob, lerp, rng, rr, smooth, unit, woodPanel } from './_retro'
import { offscreen, coverTones, drawPlate, grain, scrim, softViz, vignette } from './_scene'

/**
 * 위에서 내려다본 LP 턴테이블. 나무 플린스 위에서 판이 33⅓rpm 으로 돌고(커버가 레이블), 톤암이 처음 1.5초 동안
 * 들려 있다가 판 위로 내려앉아 곡이 진행하는 만큼 안쪽으로 들어간다. 옆에는 커버 슬리브.
 * 빛은 왼쪽 위 — 모든 그림자는 오른쪽 아래. 좌표 단위는 mm(플린스 중심이 원점).
 */
const PW = 430, PH = 350
const C = { x: -48, y: 8 }          // 판 중심
const PIV = { x: 165, y: -112 }     // 톤암 축
const LEFF = 225                    // 톤암 유효 길이
const RV = 152.5                    // LP 반지름
const LABEL_R = 48.5

type Canvasish = OffscreenCanvas | HTMLCanvasElement
const discCache = new Map<number, Canvasish | null>()

/** 홈이 새겨진 판(레이블 자리는 비워 둠). 한 번만 그려 두고 돌려서 쓴다 */
function vinylDisc(px: number): Canvasish | null {
  const key = Math.max(128, Math.min(1024, Math.round(px / 32) * 32))
  if (discCache.has(key)) return discCache.get(key) ?? null
  const o = offscreen(key, key)
  if (!o) { discCache.set(key, null); return null }
  const x = o.x, R = key / 2, labelR = R * (LABEL_R / RV)
  const bg = x.createRadialGradient(R, R, 0, R, R, R)
  bg.addColorStop(0, '#19191c'); bg.addColorStop(1, '#0a0a0b')
  x.fillStyle = bg; x.beginPath(); x.arc(R, R, R, 0, TAU); x.fill()
  const r = rng(77)
  const inner = labelR * 1.3, outer = R * 0.965
  const gaps = [0.27, 0.47, 0.66, 0.84]
  x.lineWidth = 0.7
  for (let rad = inner; rad < outer; rad += 1.15) {
    const fr = (rad - inner) / (outer - inner)
    if (gaps.some(g => Math.abs(fr - g) < 0.012)) continue
    x.strokeStyle = `rgba(255,255,255,${0.018 + r() * 0.06})`
    x.beginPath(); x.arc(R, R, rad, 0, TAU); x.stroke()
  }
  x.lineWidth = Math.max(1.5, R * 0.01)
  for (const g of gaps) { x.strokeStyle = 'rgba(255,255,255,0.1)'; x.beginPath(); x.arc(R, R, inner + (outer - inner) * g, 0, TAU); x.stroke() }
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = R * 0.02
  x.beginPath(); x.arc(R, R, R * 0.985, 0, TAU); x.stroke()
  x.beginPath(); x.arc(R, R, labelR * 1.18, 0, TAU); x.stroke()
  x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1
  x.beginPath(); x.arc(R, R, R - 0.6, 0, TAU); x.stroke()
  // 먼지 한 올과 잔 스크래치(판과 함께 돌아서 회전이 보인다)
  x.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, rad = inner + r() * (outer - inner), len = R * (0.012 + r() * 0.03), a2 = a + (r() - 0.5) * 1.2
    x.strokeStyle = `rgba(214,204,184,${0.22 + r() * 0.3})`; x.lineWidth = 0.8
    x.beginPath(); x.moveTo(R + Math.cos(a) * rad, R + Math.sin(a) * rad); x.lineTo(R + Math.cos(a) * rad + Math.cos(a2) * len, R + Math.sin(a) * rad + Math.sin(a2) * len); x.stroke()
  }
  for (let i = 0; i < 3; i++) {
    const rad = inner + r() * (outer - inner), a = r() * TAU
    x.strokeStyle = 'rgba(255,255,255,0.13)'; x.lineWidth = 0.7
    x.beginPath(); x.arc(R, R, rad, a, a + 0.25 + r() * 0.5); x.stroke()
  }
  discCache.set(key, o.c)
  return o.c
}

/** 판 위의 고정된 홈 반사. createConicGradient 가 없거나 값을 못 주면 그리지 않는다 */
function vinylSheen(ctx: CanvasRenderingContext2D) {
  const mk = (ctx as unknown as { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient | undefined }).createConicGradient
  if (typeof mk !== 'function') return
  const g = ctx.createConicGradient(-Math.PI, C.x, C.y)
  if (!g) return
  const a = (v: number) => `rgba(255,255,255,${v})`
  const stops: [number, number][] = [[0, 0.025], [0.06, 0.02], [0.125, 0.5], [0.19, 0.02], [0.45, 0.03], [0.625, 0.38], [0.69, 0.02], [1, 0.025]]
  for (const [p, v] of stops) g.addColorStop(p, a(v))
  ctx.save()
  ctx.beginPath(); ctx.arc(C.x, C.y, RV, 0, TAU); ctx.arc(C.x, C.y, LABEL_R * 1.12, 0, TAU, true); ctx.clip()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = g; ctx.fillRect(C.x - RV, C.y - RV, RV * 2, RV * 2)
  ctx.restore()
}

interface Pose { S: { x: number; y: number }; th: number; thh: number; E: { x: number; y: number }; lift: number }

/** 톤암 자세: 처음 1.5초는 쉼대에서 판 바깥 홈까지 들려서 이동, 이후 진행률에 따라 안쪽으로 */
function armPose(f: CinemaFrame): Pose {
  const k = clamp(f.t / 1.5)
  const r = f.t < 1.5 ? lerp(175, 146, smooth(0, 1, k)) : lerp(146, 62, progressOf(f))
  const lift = 22 * (1 - smooth(0.2, 1, k))
  const dx = C.x - PIV.x, dy = C.y - PIV.y, d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx)
  const alpha = Math.acos(clamp((LEFF * LEFF + d * d - r * r) / (2 * LEFF * d), -1, 1))
  const th = phi - alpha
  const S = { x: PIV.x + LEFF * Math.cos(th), y: PIV.y + LEFF * Math.sin(th) }
  const thh = th + 0.38
  const E = { x: S.x - 22 * Math.cos(thh), y: S.y - 22 * Math.sin(thh) }
  return { S, th, thh, E, lift }
}

/** 톤암의 윤곽(그림자용) */
function armShapes(ctx: CanvasRenderingContext2D, q: Pose) {
  ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(q.E.x, q.E.y); ctx.lineWidth = 4.6; ctx.lineCap = 'round'; ctx.stroke()
  ctx.save(); ctx.translate(PIV.x, PIV.y); ctx.rotate(q.th + Math.PI); rr(ctx, 14, -12, 46, 24, 2.5); ctx.fill(); ctx.restore()
  ctx.save(); ctx.translate(q.E.x, q.E.y); ctx.rotate(q.thh); rr(ctx, 0, -4.2, 22, 8.4, 1.2); ctx.fill(); ctx.restore()
  ctx.beginPath(); ctx.arc(PIV.x, PIV.y, 14, 0, TAU); ctx.fill()
}

function tonearm(ctx: CanvasRenderingContext2D, q: Pose, s: number) {
  // 들린 높이만큼 멀어지는 그림자(빛이 왼쪽 위라 오른쪽 아래로)
  const BIG = 6000
  ctx.save()
  ctx.translate(-BIG / s, 0)
  ctx.shadowColor = `rgba(6,4,3,${Math.max(0.3, 0.62 - q.lift * 0.012)})`
  ctx.shadowBlur = (1.6 + q.lift * 0.28) * s
  ctx.shadowOffsetX = BIG + (1.4 + q.lift * 0.55) * s; ctx.shadowOffsetY = (1.8 + q.lift * 0.85) * s
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'
  armShapes(ctx, q)
  ctx.restore()
  // 파이프: 어두운 바깥선 + 중간 + 빛이 닿는 줄
  const dx = q.E.x - PIV.x, dy = q.E.y - PIV.y, len = Math.hypot(dx, dy)
  let nx = -dy / len, ny = dx / len
  if (nx + ny > 0) { nx = -nx; ny = -ny }   // 왼쪽 위(빛) 쪽으로
  ctx.save(); ctx.lineCap = 'round'
  ctx.strokeStyle = '#4a4946'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(q.E.x, q.E.y); ctx.stroke()
  ctx.strokeStyle = '#a6a49f'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(PIV.x, PIV.y); ctx.lineTo(q.E.x, q.E.y); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.1
  ctx.beginPath(); ctx.moveTo(PIV.x + nx * 0.9, PIV.y + ny * 0.9); ctx.lineTo(q.E.x + nx * 0.9, q.E.y + ny * 0.9); ctx.stroke()
  ctx.restore()
  // 카운터웨이트(축 뒤쪽)
  ctx.save()
  ctx.translate(PIV.x, PIV.y); ctx.rotate(q.th + Math.PI)
  ctx.strokeStyle = '#8b8984'; ctx.lineWidth = 3.4; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 0); ctx.stroke()
  const faceLight = Math.sin(q.th + Math.PI) - Math.cos(q.th + Math.PI) > 0
  const wg = ctx.createLinearGradient(0, -12, 0, 12)
  const hi = faceLight ? 0.7 : 0.3
  wg.addColorStop(0, '#3c3b39'); wg.addColorStop(hi, '#d4d2cc'); wg.addColorStop(1, '#3c3b39')
  ctx.fillStyle = wg; rr(ctx, 14, -12, 46, 24, 2.5); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6
  for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(19 + i * 5.2, -12); ctx.lineTo(19 + i * 5.2, 12); ctx.stroke() }
  ctx.restore()
  // 축 받침
  knob(ctx, PIV.x, PIV.y, 14, 0, { base: [172, 170, 166], ridges: 0, cap: 0.62 })
  // 헤드셸 + 카트리지
  ctx.save()
  ctx.translate(q.E.x, q.E.y); ctx.rotate(q.thh)
  const hg = ctx.createLinearGradient(0, -4.2, 0, 4.2)
  hg.addColorStop(0, '#34343a'); hg.addColorStop(0.35, '#1a1a1d'); hg.addColorStop(1, '#0c0c0d')
  ctx.fillStyle = hg; rr(ctx, 0, -4.2, 22, 8.4, 1.2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(1.2, -4); ctx.lineTo(21, -4); ctx.stroke()
  ctx.strokeStyle = '#a9a6a0'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(-2.5, -10); ctx.stroke()
  ctx.fillStyle = '#2c2c31'; rr(ctx, 9, -3.4, 12, 6.8, 0.9); ctx.fill()
  ctx.fillStyle = '#cfc9bb'; ctx.fillRect(20.6, -0.5, 2.2, 1)
  ctx.restore()
}

function platter(ctx: CanvasRenderingContext2D, f: CinemaFrame, s: number) {
  const ang = f.t * (100 / 3 / 60) * TAU
  // 플린스 위에 지는 판의 그림자
  const BIG = 6000
  ctx.save(); ctx.translate(-BIG / s, 0)
  ctx.shadowColor = 'rgba(6,4,3,0.55)'; ctx.shadowBlur = 5 * s; ctx.shadowOffsetX = BIG + 2.8 * s; ctx.shadowOffsetY = 3.8 * s
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(C.x, C.y, 158, 0, TAU); ctx.fill(); ctx.restore()
  // 알루미늄 플래터 테두리
  const mg = ctx.createLinearGradient(C.x - 158, C.y - 158, C.x + 158, C.y + 158)
  mg.addColorStop(0, '#e8e6e0'); mg.addColorStop(0.35, '#9d9b96'); mg.addColorStop(0.7, '#d2d0ca'); mg.addColorStop(1, '#6e6c68')
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(C.x, C.y, 158, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke()
  // 판(홈 캐시를 돌려서 그린다)
  const disc = vinylDisc(RV * 2 * s)
  ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(ang)
  if (disc) ctx.drawImage(disc as CanvasImageSource, -RV, -RV, RV * 2, RV * 2)
  else {
    ctx.fillStyle = '#0e0e10'; ctx.beginPath(); ctx.arc(0, 0, RV, 0, TAU); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.6
    for (let r = 62; r < RV; r += 6) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke() }
    ctx.strokeStyle = 'rgba(214,204,184,0.4)'; ctx.beginPath(); ctx.moveTo(70, 20); ctx.lineTo(80, 24); ctx.stroke()
  }
  // 레이블 = 커버
  ctx.save()
  ctx.beginPath(); ctx.arc(0, 0, LABEL_R, 0, TAU); ctx.clip()
  drawCover(ctx, f, { x: -LABEL_R, y: -LABEL_R, w: LABEL_R * 2, h: LABEL_R * 2 }, 0)
  const lgr = ctx.createRadialGradient(0, 0, LABEL_R * 0.55, 0, 0, LABEL_R)
  lgr.addColorStop(0, 'rgba(0,0,0,0)'); lgr.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = lgr; ctx.fillRect(-LABEL_R, -LABEL_R, LABEL_R * 2, LABEL_R * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.4
  ctx.beginPath(); ctx.arc(0, 0, LABEL_R * 0.78, 0, TAU); ctx.stroke()
  ctx.fillStyle = 'rgba(236,230,218,0.92)'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.fill()
  ctx.restore()
  ctx.restore()
  // 고정된 반사 + 레이블 위 빛
  vinylSheen(ctx)
  ctx.save()
  ctx.beginPath(); ctx.arc(C.x, C.y, LABEL_R, 0, TAU); ctx.clip()
  const lg = ctx.createLinearGradient(C.x - LABEL_R, C.y - LABEL_R, C.x + LABEL_R, C.y + LABEL_R)
  lg.addColorStop(0, 'rgba(255,255,255,0.16)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = lg; ctx.fillRect(C.x - LABEL_R, C.y - LABEL_R, LABEL_R * 2, LABEL_R * 2)
  ctx.restore()
  // 스핀들
  const sg = ctx.createRadialGradient(C.x - 1, C.y - 1.2, 0.2, C.x, C.y, 3.6)
  sg.addColorStop(0, '#fbfaf6'); sg.addColorStop(0.5, '#a8a6a0'); sg.addColorStop(1, '#4e4c48')
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(C.x, C.y, 3.4, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.4; ctx.stroke()
}

function controls(ctx: CanvasRenderingContext2D) {
  // 시작/정지, 속도 버튼 두 개(33 이 켜져 있다)
  knob(ctx, -170, 146, 10, 0.3, { base: [196, 194, 190], ridges: 0, cap: 0.7 })
  for (const [x, on] of [[-132, true], [-106, false]] as const) {
    knob(ctx, x, 146, 6.2, 0, { base: [186, 184, 180], ridges: 0, cap: 0.76 })
    const lg = ctx.createRadialGradient(x, 133, 0, x, 133, 4)
    lg.addColorStop(0, on ? 'rgba(255,190,80,1)' : 'rgba(70,52,34,1)'); lg.addColorStop(0.35, on ? 'rgba(255,150,40,0.7)' : 'rgba(40,30,20,0)'); lg.addColorStop(1, 'rgba(255,150,40,0)')
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, 133, 4, 0, TAU); ctx.fill()
    fitText(ctx, x < -120 ? '33' : '45', x, 160, 12, 5.6, { weight: 600, color: 'rgba(30,20,12,0.72)', align: 'center', baseline: 'middle', minSize: 3 })
  }
  // 피치 슬라이더
  const slot = { x: 178, y: 86, w: 5, h: 72 }
  ctx.fillStyle = '#17110c'; rr(ctx, slot.x, slot.y, slot.w, slot.h, 2.5); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(slot.x + slot.w + 0.2, slot.y + 2); ctx.lineTo(slot.x + slot.w + 0.2, slot.y + slot.h - 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(30,20,12,0.6)'; ctx.lineWidth = 0.5
  for (let i = 0; i <= 10; i++) { const y = slot.y + 2 + (i / 10) * (slot.h - 4); ctx.beginPath(); ctx.moveTo(slot.x + 9, y); ctx.lineTo(slot.x + (i % 5 === 0 ? 14 : 12), y); ctx.stroke() }
  const cg = ctx.createLinearGradient(0, 0, 14, 0)
  cg.addColorStop(0, '#f2f0ea'); cg.addColorStop(0.5, '#b4b2ac'); cg.addColorStop(1, '#7c7a76')
  ctx.save(); ctx.shadowColor = 'rgba(6,4,3,0.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1.4
  ctx.translate(slot.x - 4.5, slot.y + slot.h / 2 - 5); ctx.fillStyle = cg; rr(ctx, 0, 0, 14, 10, 1.4); ctx.fill(); ctx.restore()
  ctx.fillStyle = 'rgba(20,14,10,0.6)'; ctx.fillRect(slot.x - 4.5 + 1.5, slot.y + slot.h / 2 - 0.4, 11, 0.8)
}

function sleeveObj(ctx: CanvasRenderingContext2D, f: CinemaFrame, cx: number, cy: number, s: number, rot: number) {
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(rot)
  ctx.save()
  ctx.scale(s, s)
  const b = { x: -156, y: -156, w: 312, h: 312 }
  castShadow(ctx, b, 0, { dx: 3.6 * s, dy: 5 * s, blur: 9 * s, a: 0.62 })
  drawCover(ctx, f, b, 0)
  // 판 링 자국과 종이 질감
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 148, 0, TAU); ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 153, 0, TAU); ctx.stroke()
  const lg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
  lg.addColorStop(0, 'rgba(255,248,230,0.16)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.26)')
  ctx.fillStyle = lg; ctx.fillRect(b.x, b.y, b.w, b.h)
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(b.x + b.w - 7, b.y, 7, b.h)
  edgeLight(ctx, b, 0, { k: 0.9, a: 0.5 })
  ctx.restore()
  ctx.restore()
}

interface Lay { s: number; cx: number; cy: number; sx: number; sy: number; ss: number; srot: number; bottom: number; tallY: number }
function layout(f: CinemaFrame): Lay {
  const { w, h } = f
  if (isTall(f)) {
    const s = (0.92 * w) / PW
    const cy = 0.045 * h + (PH / 2) * s
    return { s, cx: 0.5 * w, cy, sx: 0.66 * w, sy: 0.545 * h, ss: s * 0.9, srot: 0.1, bottom: 0.545 * h + 156 * s * 0.9, tallY: h * 0.77 }
  }
  const s = Math.min((0.9 * w) / 672, (0.57 * h) / PH)
  const cx = w / 2 - 121 * s
  const cy = 0.095 * h + (PH / 2) * s
  return { s, cx, cy, sx: cx + 301 * s, sy: cy + 10 * s, ss: s, srot: 0.09, bottom: cy + (PH / 2) * s, tallY: 0 }
}

export const turntable: CinemaTemplate = {
  id: 'turntable',
  name: 'LP 턴테이블',
  blurb: '돌아가는 LP 위로 톤암이 내려앉아요, 커버는 옆 슬리브에',
  defaultShape: 'ring-line',
  assets: ['desk-topdown'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = progressOf(f)
    const plate = drawPlate(ctx, f, 'desk-topdown', { fx: 0.28, fy: 0.4, zoom: 1.01 + 0.02 * p })
    if (!plate) deskFallback(ctx, f)
    const L = layout(f)
    const { s } = L

    // 형태: 판 둘레로 번지는 링 / 아래 가로 띠
    const ringSide = RV * 2 * 1.05 * s
    const barBox = { x: w * 0.07, y: Math.min(h * 0.93, L.bottom + u * 0.025), w: w * 0.86, h: u * 0.04 }
    softViz(ctx, f, barBox, { x: L.cx + C.x * s - ringSide / 2, y: L.cy + C.y * s - ringSide / 2, w: ringSide, h: ringSide }, 0.3)

    // 슬리브(플린스 뒤)
    sleeveObj(ctx, f, L.sx, L.sy, L.ss, L.srot)

    // 플린스
    ctx.save()
    ctx.translate(L.cx, L.cy); ctx.scale(s, s)
    const pl = { x: -PW / 2, y: -PH / 2, w: PW, h: PH }
    castShadow(ctx, pl, 6, { dx: 4.5 * s, dy: 6.5 * s, blur: 10 * s, a: 0.65 })
    woodPanel(ctx, pl, 6, [176, 128, 82], { tex: 0.6 })
    edgeLight(ctx, pl, 6, { k: 1.6, a: 0.4 })
    // 윗면 안쪽 얇은 홈
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.6; rr(ctx, pl.x + 7, pl.y + 7, pl.w - 14, pl.h - 14, 3); ctx.stroke()
    controls(ctx)
    platter(ctx, f, s)
    tonearm(ctx, armPose(f), s)
    ctx.restore()

    scrim(ctx, f, h * (tall ? 0.7 : 0.62), h * 0.96, tn.deep, 0.5)
    vignette(ctx, f, 0.5, tn.deep)
    deskInfo(ctx, f, tn, { tallY: L.tallY })
    grain(ctx, f, 0.07)
  },
}

