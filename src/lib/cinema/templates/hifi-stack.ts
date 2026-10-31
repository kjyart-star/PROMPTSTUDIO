import type { Box, CinemaFrame, CinemaTemplate } from '../types'
import { mmss, progressOf } from '../helpers'
import { TAU, bandInfo, bandsOf, castShadow, clamp, edgeLight, glassSheen, glowText, isTall, ledColumn, metalPanel, needleValue, rr, screw, shelfFallback, tapeReels, unit, vuMeter } from './_retro'
import type { RGB } from './_retro'
import { SANS, contactShadow, coverTones, drawPlate, grain, scrim, softViz, vignette } from './_scene'

/**
 * 80년대 오디오 랙: 은색 헤어라인 알루미늄 데크 · 그래픽 이퀄라이저 · 리시버 3단이 캐비닛 위에 올라가 있다.
 * 램프가 오른쪽에 있어 빛은 오른쪽 위 — 그림자는 왼쪽으로 떨어진다. 좌표 단위는 mm(캐비닛 위 접지점이 원점).
 */
const W = 430
const SILVER: RGB = [198, 200, 202]
const TEAL: RGB = [112, 255, 228]
const LX = 1

/** 한 단의 알루미늄 패널 + 모서리 나사 */
function unitPanel(ctx: CanvasRenderingContext2D, b: Box) {
  metalPanel(ctx, b, 2.2, SILVER, { lx: LX, tex: 0.36 })
  for (const sx of [b.x + 7, b.x + b.w - 7]) for (const sy of [b.y + 7, b.y + b.h - 7]) screw(ctx, sx, sy, 1.9, sx * 0.3 + sy * 0.7, LX)
}

/** 작은 조작 키 */
function key(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glyph: 'play' | 'stop' | 'pause' | 'ff' | 'rew' | 'rec', on = false) {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, '#4a4a4d'); g.addColorStop(1, '#17171a')
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 1.5; ctx.shadowOffsetY = 1
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 1.4); ctx.fill()
  ctx.restore()
  edgeLight(ctx, { x, y, w, h }, 1.4, { k: 0.5, a: 0.4, lx: LX })
  ctx.fillStyle = on ? 'rgba(112,255,228,0.95)' : 'rgba(225,225,222,0.78)'
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.26
  ctx.beginPath()
  if (glyph === 'play') { ctx.moveTo(cx - r * 0.7, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx - r * 0.7, cy + r) }
  else if (glyph === 'stop') ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7)
  else if (glyph === 'pause') { ctx.rect(cx - r * 0.9, cy - r, r * 0.65, r * 2); ctx.rect(cx + r * 0.25, cy - r, r * 0.65, r * 2) }
  else if (glyph === 'ff') { ctx.moveTo(cx - r, cy - r * 0.8); ctx.lineTo(cx, cy); ctx.lineTo(cx - r, cy + r * 0.8); ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 0.8) }
  else if (glyph === 'rew') { ctx.moveTo(cx + r, cy - r * 0.8); ctx.lineTo(cx, cy); ctx.lineTo(cx + r, cy + r * 0.8); ctx.moveTo(cx, cy - r * 0.8); ctx.lineTo(cx - r, cy); ctx.lineTo(cx, cy + r * 0.8) }
  else ctx.arc(cx, cy, r * 0.8, 0, TAU)
  ctx.fill()
}

function slimKnob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number) {
  const g = ctx.createRadialGradient(x + LX * r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
  g.addColorStop(0, '#ededea'); g.addColorStop(0.55, '#a9a8a4'); g.addColorStop(1, '#5d5c59')
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = r * 0.4; ctx.shadowOffsetX = -LX * r * 0.15; ctx.shadowOffsetY = r * 0.25
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke()
  ctx.strokeStyle = 'rgba(30,28,26,0.85)'; ctx.lineWidth = Math.max(0.9, r * 0.1); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x + Math.sin(ang) * r * 0.3, y - Math.cos(ang) * r * 0.3); ctx.lineTo(x + Math.sin(ang) * r * 0.85, y - Math.cos(ang) * r * 0.85); ctx.stroke()
}

/** 맨 위: 카세트 데크(창 속 릴이 돌고, VFD 에 곡명·시간) */
function deck(ctx: CanvasRenderingContext2D, f: CinemaFrame, b: Box) {
  unitPanel(ctx, b)
  ctx.save(); ctx.translate(b.x, b.y)
  const p = progressOf(f)
  // 카세트 칸
  const bay = { x: 22, y: 15, w: 168, h: 72 }
  ctx.fillStyle = '#0b0a09'; rr(ctx, bay.x - 2, bay.y - 2, bay.w + 4, bay.h + 4, 3); ctx.fill()
  ctx.save(); rr(ctx, bay.x, bay.y, bay.w, bay.h, 2.4); ctx.clip()
  const bg = ctx.createLinearGradient(0, bay.y, 0, bay.y + bay.h)
  bg.addColorStop(0, '#26221d'); bg.addColorStop(1, '#14110e')
  ctx.fillStyle = bg; ctx.fillRect(bay.x, bay.y, bay.w, bay.h)
  // 들어 있는 카세트(쉘 + 창)
  const cs = 1.42, ccx = bay.x + bay.w / 2, ccy = bay.y + bay.h / 2
  ctx.fillStyle = '#2d2925'; rr(ctx, ccx - 50.2 * cs, ccy - 31.9 * cs, 100.4 * cs, 63.8 * cs, 4); ctx.fill()
  ctx.fillStyle = 'rgb(232,226,208)'; rr(ctx, ccx - 41 * cs, ccy - 30 * cs, 82 * cs, 36 * cs, 2); ctx.fill()
  const win = { x: ccx - 31 * cs, y: ccy - 8.5 * cs, w: 62 * cs, h: 18 * cs }
  ctx.save(); rr(ctx, win.x, win.y, win.w, win.h, 4); ctx.clip()
  ctx.fillStyle = '#17120e'; ctx.fillRect(win.x, win.y, win.w, win.h)
  tapeReels(ctx, { cx: ccx, cy: win.y + win.h / 2, dx: 21 * cs, hubR: 5.6 * cs, rMin: 8.8 * cs, rMax: 19.5 * cs, p, ang: f.t * 5.4 })
  ctx.restore()
  ctx.restore()
  // 도어 유리
  glassSheen(ctx, bay, 2.4, 0.2)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.7; rr(ctx, bay.x, bay.y, bay.w, bay.h, 2.4); ctx.stroke()

  // VFD 표시창
  const vf = { x: 206, y: 15, w: 124, h: 40 }
  const vg = ctx.createLinearGradient(0, vf.y, 0, vf.y + vf.h)
  vg.addColorStop(0, '#05100f'); vg.addColorStop(1, '#0a1c1a')
  ctx.fillStyle = '#0a0a0a'; rr(ctx, vf.x - 2, vf.y - 2, vf.w + 4, vf.h + 4, 3); ctx.fill()
  ctx.fillStyle = vg; rr(ctx, vf.x, vf.y, vf.w, vf.h, 2); ctx.fill()
  ctx.save(); rr(ctx, vf.x, vf.y, vf.w, vf.h, 2); ctx.clip()
  glowText(ctx, f.trackTitle, vf.x + 7, vf.y + 11, vf.w - 14, 9, TEAL, { font: SANS, weight: 500 })
  glowText(ctx, `${String(f.trackIndex + 1).padStart(2, '0')}`, vf.x + 7, vf.y + 28, 24, 15, TEAL, { font: SANS, weight: 600 })
  glowText(ctx, mmss(f.t), vf.x + vf.w - 7, vf.y + 28, 70, 15, TEAL, { font: SANS, weight: 600, align: 'right' })
  // 진행 칸
  const segs = 30, sw = (vf.w - 14) / segs
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i / segs < p ? 'rgba(112,255,228,0.95)' : 'rgba(112,255,228,0.14)'
    ctx.fillRect(vf.x + 7 + i * sw, vf.y + vf.h - 6, sw * 0.7, 2.2)
  }
  ctx.restore()
  glassSheen(ctx, vf, 2, 0.12)
  ctx.save(); ctx.globalCompositeOperation = 'screen'
  const bl = ctx.createRadialGradient(vf.x + vf.w / 2, vf.y + vf.h / 2, 6, vf.x + vf.w / 2, vf.y + vf.h / 2, 90)
  bl.addColorStop(0, 'rgba(112,255,228,0.12)'); bl.addColorStop(1, 'rgba(112,255,228,0)')
  ctx.fillStyle = bl; ctx.fillRect(vf.x - 80, vf.y - 60, vf.w + 160, vf.h + 120)
  ctx.restore()

  // 조작 키
  const gl: ('rew' | 'play' | 'ff' | 'stop' | 'pause' | 'rec')[] = ['rew', 'play', 'ff', 'stop', 'pause', 'rec']
  gl.forEach((g, i) => key(ctx, 206 + i * 21, 66, 18, 20, g, g === 'play'))
  // 볼륨 노브
  slimKnob(ctx, 392, 40, 17, 0.9)
  slimKnob(ctx, 392, 82, 6.5, -0.4); slimKnob(ctx, 364, 82, 6.5, 0.3)
  ctx.restore()
}

/** 가운데: 그래픽 이퀄라이저(LED 기둥 15개가 f.bars 를 따라 움직인다) */
function equalizer(ctx: CanvasRenderingContext2D, f: CinemaFrame, b: Box) {
  unitPanel(ctx, b)
  ctx.save(); ctx.translate(b.x, b.y)
  const pn = { x: 20, y: 11, w: 292, h: 58 }
  ctx.fillStyle = '#080808'; rr(ctx, pn.x - 2, pn.y - 2, pn.w + 4, pn.h + 4, 3); ctx.fill()
  ctx.fillStyle = '#0d0e0e'; rr(ctx, pn.x, pn.y, pn.w, pn.h, 2); ctx.fill()
  const n = f.bars.length, cols = 15
  const cw = 9.2, gap = (pn.w - 20 - cols * cw) / (cols - 1)
  for (let i = 0; i < cols; i++) {
    const idx = Math.round((i / (cols - 1)) * (n - 1))
    let v = 0, c = 0
    for (let k = -1; k <= 1; k++) { const j = idx + k; if (j >= 0 && j < n) { v += f.bars[j]; c++ } }
    v = clamp((v / Math.max(1, c)) * 1.1 + 0.03)
    ledColumn(ctx, pn.x + 10 + i * (cw + gap), pn.y + 5, cw, pn.h - 10, v, 12, (k, m) => (k < m * 0.58 ? [90, 235, 130] : k < m * 0.85 ? [255, 206, 70] : [255, 80, 52]))
  }
  // 얇은 스모크 유리
  ctx.fillStyle = 'rgba(20,22,24,0.18)'; rr(ctx, pn.x, pn.y, pn.w, pn.h, 2); ctx.fill()
  glassSheen(ctx, pn, 2, 0.1)
  // 슬라이더 9개(고정 위치)
  const pos = [0.58, 0.42, 0.5, 0.66, 0.38, 0.52, 0.7, 0.46, 0.55]
  pos.forEach((q, i) => {
    const x = 332 + i * 10, y0 = 12, h = 56
    ctx.fillStyle = '#16150f'; rr(ctx, x, y0, 2.6, h, 1.3); ctx.fill()
    const cy = y0 + (1 - q) * (h - 8)
    const cg = ctx.createLinearGradient(x - 3, 0, x + 6, 0)
    cg.addColorStop(0, '#f1efe9'); cg.addColorStop(0.5, '#b7b5af'); cg.addColorStop(1, '#6f6d69')
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 1.4; ctx.shadowOffsetY = 1
    ctx.fillStyle = cg; rr(ctx, x - 3.4, cy, 9.4, 8, 1.2); ctx.fill(); ctx.restore()
    ctx.fillStyle = 'rgba(20,18,16,0.65)'; ctx.fillRect(x - 2.4, cy + 3.6, 7.4, 0.7)
  })
  ctx.restore()
}

/** 맨 아래: 리시버(튜너 다이얼 + VU 미터 두 개) */
function receiver(ctx: CanvasRenderingContext2D, f: CinemaFrame, b: Box) {
  unitPanel(ctx, b)
  ctx.save(); ctx.translate(b.x, b.y)
  const bd = bandsOf(f)
  // 튜너 창(호박색 백라이트, 눈금만)
  const tw = { x: 20, y: 14, w: 196, h: 36 }
  ctx.fillStyle = '#0a0907'; rr(ctx, tw.x - 2, tw.y - 2, tw.w + 4, tw.h + 4, 3); ctx.fill()
  ctx.save(); rr(ctx, tw.x, tw.y, tw.w, tw.h, 2); ctx.clip()
  const tg = ctx.createLinearGradient(0, tw.y, 0, tw.y + tw.h)
  tg.addColorStop(0, '#f6c874'); tg.addColorStop(1, '#c98a38')
  ctx.fillStyle = tg; ctx.fillRect(tw.x, tw.y, tw.w, tw.h)
  ctx.strokeStyle = 'rgba(60,34,12,0.85)'
  for (let i = 0; i <= 56; i++) {
    const x = tw.x + 8 + (i / 56) * (tw.w - 16), major = i % 8 === 0
    ctx.lineWidth = major ? 0.9 : 0.5
    ctx.beginPath(); ctx.moveTo(x, tw.y + 8); ctx.lineTo(x, tw.y + (major ? 22 : 16)); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(60,34,12,0.7)'; ctx.fillRect(tw.x + 6, tw.y + 26, tw.w - 12, 0.7)
  const nx = tw.x + 8 + (tw.w - 16) * (0.36 + 0.004 * Math.sin(f.t * 0.6))
  ctx.fillStyle = 'rgba(255,60,40,0.4)'; ctx.fillRect(nx - 1.8, tw.y + 3, 3.6, tw.h - 6)
  ctx.fillStyle = 'rgb(230,40,28)'; ctx.fillRect(nx - 0.6, tw.y + 3, 1.2, tw.h - 6)
  const sh = ctx.createLinearGradient(0, tw.y, 0, tw.y + 8)
  sh.addColorStop(0, 'rgba(0,0,0,0.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = sh; ctx.fillRect(tw.x, tw.y, tw.w, 8)
  ctx.restore()
  glassSheen(ctx, tw, 2, 0.12)
  // 조작 노브
  slimKnob(ctx, 52, 86, 14, -0.7)
  ;[110, 140, 170, 200].forEach((x, i) => slimKnob(ctx, x, 86, 7.5, -0.8 + i * 0.5))
  // VU 미터 두 개 + 볼륨
  const vw = 82, vh = 62
  vuMeter(ctx, { x: 232, y: 14, w: vw, h: vh }, needleValue(bd.lo * 0.8 + bd.level * 0.35, f.t, 0), { label: 'L', lx: LX })
  vuMeter(ctx, { x: 324, y: 14, w: vw, h: vh }, needleValue(bd.hi * 0.7 + bd.level * 0.4, f.t, 1.7), { label: 'R', lx: LX })
  slimKnob(ctx, 369, 90, 12, 1.0)
  ctx.restore()
}

export const hifiStack: CinemaTemplate = {
  id: 'hifi-stack',
  name: '80년대 전축',
  blurb: '은색 데크·이퀄라이저·리시버, 바늘과 LED가 음악에 맞춰 움직여요',
  defaultShape: 'bars-slim',
  assets: ['hifi-room'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = progressOf(f)
    const plate = drawPlate(ctx, f, 'hifi-room', { fx: 0.5, fy: 0.5, zoom: 1.01 + 0.02 * p })
    if (!plate) shelfFallback(ctx, f, [150, 118, 82], [74, 42, 24], h * 0.735)
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const yBase = py(0.715)
    const wFrac = tall ? 0.88 : w / h > 1.5 ? 0.5 : 0.64
    const s = Math.max(0.2, Math.min((wFrac * w) / W, (yBase - h * 0.075) / 313))
    const cx = tall ? w / 2 : px(0.5)

    // 캐비닛 위 그림자: 빛이 오른쪽이라 왼쪽으로 길게
    contactShadow(ctx, cx - 8 * s, yBase + 2 * s, W * 0.56 * s, 9 * s, 0.6)

    // 형태: 스택 뒤로 번지는 링 / 캐비닛 턱을 따라 흐르는 가로 띠
    const ringSide = 313 * s * 1.1
    softViz(ctx, f, { x: w * 0.1, y: py(0.752), w: w * 0.8, h: u * 0.03 }, { x: cx - ringSide / 2, y: yBase - 313 * s * 0.52 - ringSide / 2, w: ringSide, h: ringSide }, 0.22)

    ctx.save()
    ctx.translate(cx, yBase); ctx.scale(s, s)
    const x0 = -W / 2
    const recv = { x: x0, y: -116, w: W, h: 110 }
    const eq = { x: x0, y: -197.2, w: W, h: 80 }
    const dk = { x: x0, y: -303.4, w: W, h: 105 }
    // 스택 전체의 드리운 그림자(왼쪽 아래)
    castShadow(ctx, { x: x0, y: dk.y, w: W, h: 297 }, 3, { dx: -7 * s, dy: 2.5 * s, blur: 11 * s, a: 0.55 })
    // 발
    ctx.fillStyle = '#0e0d0c'
    for (const fx of [x0 + 24, x0 + W - 44]) { rr(ctx, fx, -6.2, 20, 6.2, 1.5); ctx.fill() }
    // 단 사이 틈
    ctx.fillStyle = '#050505'; ctx.fillRect(x0 + 2, -199.2, W - 4, 3); ctx.fillRect(x0 + 2, -119.2, W - 4, 3)
    receiver(ctx, f, recv)
    equalizer(ctx, f, eq)
    deck(ctx, f, dk)
    // 맨 위 윗면(살짝 내려다본 면)
    const top = ctx.createLinearGradient(0, -312, 0, -303.4)
    top.addColorStop(0, '#d8dadc'); top.addColorStop(1, '#8e9094')
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x0 + 3, -303.4); ctx.lineTo(x0 + 6, -310); ctx.lineTo(x0 + W - 6, -310); ctx.lineTo(x0 + W - 3, -303.4); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x0 + 6, -310, W - 12, 0.7)
    // 오른쪽 램프의 따뜻한 빛이 스택을 감싼다
    ctx.save()
    ctx.beginPath(); ctx.rect(x0, -312, W, 312); ctx.clip()
    ctx.globalCompositeOperation = 'soft-light'
    const wg = ctx.createLinearGradient(x0, 0, x0 + W, 0)
    wg.addColorStop(0, 'rgba(60,30,10,0.35)'); wg.addColorStop(0.55, 'rgba(255,170,90,0.1)'); wg.addColorStop(1, 'rgba(255,190,110,0.45)')
    ctx.fillStyle = wg; ctx.fillRect(x0, -312, W, 312)
    ctx.restore()
    ctx.restore()

    scrim(ctx, f, py(0.75), h, tn.deep, 0.55)
    vignette(ctx, f, 0.5, tn.deep)
    bandInfo(ctx, f, tn, { y0: h * 0.82, tallY: h * 0.82 })
    grain(ctx, f, 0.07)
  },
}

