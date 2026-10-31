import type { CinemaFrame, CinemaTemplate } from '../types'
import { progressOf } from '../helpers'
import { TAU, bandInfo, bandsOf, clamp, glassSheen, isTall, knob, rr, shade, texFill, unit, weaveTile, woodPanel, woodTile } from './_retro'
import type { RGB } from './_retro'
import { contactShadow, coverTones, drawPlate, grain, scrim, softViz, vignette } from './_scene'

/**
 * 협탁 위 진공관 라디오. 호두색 나무 캐비닛, 직조가 보이는 그릴 천, 호박색으로 빛나는 다이얼 창(눈금만)과 바늘,
 * 음량에 따라 열리는 초록 매직아이, 베이클라이트 노브. 빛은 왼쪽 스탠드 — 그림자는 오른쪽으로 떨어진다.
 * 좌표 단위는 mm(협탁 위 접지점이 원점).
 */
const RW = 430, RH = 300
const LX = -1
const WOOD: RGB = [118, 70, 36]

/** 윗모서리가 크게 둥근 캐비닛 윤곽(아래는 거의 직각) */
function cabPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rt: number, rb: number) {
  ctx.beginPath()
  ctx.moveTo(x + rt, y)
  ctx.arcTo(x + w, y, x + w, y + h, rt)
  ctx.arcTo(x + w, y + h, x, y + h, rb)
  ctx.arcTo(x, y + h, x, y, rb)
  ctx.arcTo(x, y, x + w, y, rt)
  ctx.closePath()
}

function magicEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, open: number) {
  // 금속 테 + 어두운 유리
  const bg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  bg.addColorStop(0, '#d8d6d0'); bg.addColorStop(0.5, '#7b7974'); bg.addColorStop(1, '#2d2c2a')
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r + 3.4, 0, TAU); ctx.fill()
  ctx.fillStyle = '#020503'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill()
  // 초록 발광면 + 닫히는 그림자 부채꼴
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, TAU); ctx.clip()
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r)
  g.addColorStop(0, 'rgb(220,255,190)'); g.addColorStop(0.35, 'rgb(120,255,120)'); g.addColorStop(1, 'rgb(20,150,60)')
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  const wedge = (1 - clamp(open)) * 1.45 + 0.1
  ctx.fillStyle = 'rgba(2,24,8,0.94)'
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2 - wedge / 2, -Math.PI / 2 + wedge / 2); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,230,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.12, 0, TAU); ctx.fill()
  ctx.restore()
  ctx.save(); ctx.globalCompositeOperation = 'screen'
  const gl = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3.2)
  gl.addColorStop(0, 'rgba(100,255,110,0.28)'); gl.addColorStop(1, 'rgba(100,255,110,0)')
  ctx.fillStyle = gl; ctx.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.5, r * 0.45, r * 0.22, -0.5, 0, TAU); ctx.fill()
}

function dial(ctx: CanvasRenderingContext2D, f: CinemaFrame, bd: ReturnType<typeof bandsOf>) {
  const win = { x: -168, y: -262, w: 336, h: 96 }
  // 유리 틀
  ctx.fillStyle = '#16100a'; rr(ctx, win.x - 4, win.y - 4, win.w + 8, win.h + 8, 18); ctx.fill()
  ctx.save(); rr(ctx, win.x, win.y, win.w, win.h, 14); ctx.clip()
  const g = ctx.createRadialGradient(win.x + win.w * 0.4, win.y + win.h * 0.55, 10, win.x + win.w * 0.4, win.y + win.h * 0.55, win.w * 0.62)
  g.addColorStop(0, 'rgb(255,226,140)'); g.addColorStop(0.6, 'rgb(232,160,62)'); g.addColorStop(1, 'rgb(150,80,24)')
  ctx.fillStyle = g; ctx.fillRect(win.x, win.y, win.w, win.h)
  // 눈금 세 줄
  ctx.strokeStyle = 'rgba(58,28,8,0.88)'
  const rows = [{ y: win.y + 18, n: 52 }, { y: win.y + 40, n: 44 }, { y: win.y + 62, n: 36 }]
  for (const row of rows) {
    for (let i = 0; i <= row.n; i++) {
      const x = win.x + 16 + (i / row.n) * 232, major = i % 4 === 0
      ctx.lineWidth = major ? 1 : 0.6
      ctx.beginPath(); ctx.moveTo(x, row.y); ctx.lineTo(x, row.y + (major ? 12 : 7)); ctx.stroke()
    }
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(win.x + 14, row.y + 13.5); ctx.lineTo(win.x + 250, row.y + 13.5); ctx.stroke()
  }
  // 바늘(천천히 오가며 방송을 찾는 느낌, 같은 시각이면 같은 자리)
  const nx = win.x + 16 + 232 * (0.42 + 0.012 * Math.sin(f.t * 0.45))
  ctx.fillStyle = 'rgba(255,70,40,0.3)'; ctx.fillRect(nx - 2.5, win.y + 4, 5, win.h - 8)
  ctx.fillStyle = 'rgb(220,38,24)'; ctx.fillRect(nx - 0.7, win.y + 4, 1.4, win.h - 8)
  // 안쪽 그늘과 유리 광택
  const sh = ctx.createLinearGradient(0, win.y, 0, win.y + 14)
  sh.addColorStop(0, 'rgba(30,12,2,0.55)'); sh.addColorStop(1, 'rgba(30,12,2,0)')
  ctx.fillStyle = sh; ctx.fillRect(win.x, win.y, win.w, 14)
  const sh2 = ctx.createLinearGradient(win.x, 0, win.x + 24, 0)
  sh2.addColorStop(0, 'rgba(30,12,2,0.4)'); sh2.addColorStop(1, 'rgba(30,12,2,0)')
  ctx.fillStyle = sh2; ctx.fillRect(win.x, win.y, 24, win.h)
  ctx.restore()
  // 매직아이(음량이 클수록 초록이 넓게 열린다)
  magicEye(ctx, win.x + win.w - 46, win.y + win.h / 2, 21, bd.level * 1.25)
  glassSheen(ctx, win, 14, 0.14)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.8; rr(ctx, win.x, win.y, win.w, win.h, 14); ctx.stroke()
  // 다이얼에서 번져 나오는 호박색 빛
  ctx.save(); ctx.globalCompositeOperation = 'screen'
  const bl = ctx.createRadialGradient(win.x + win.w * 0.4, win.y + win.h * 0.5, 20, win.x + win.w * 0.4, win.y + win.h * 0.5, 280)
  bl.addColorStop(0, 'rgba(255,170,70,0.22)'); bl.addColorStop(1, 'rgba(255,170,70,0)')
  ctx.fillStyle = bl; ctx.fillRect(-RW, -RH - 40, RW * 2, RH + 80)
  ctx.restore()
}

function grille(ctx: CanvasRenderingContext2D, s: number) {
  const gb = { x: -168, y: -150, w: 336, h: 104 }
  ctx.save()
  rr(ctx, gb.x, gb.y, gb.w, gb.h, 12); ctx.clip()
  const g = ctx.createLinearGradient(gb.x, 0, gb.x + gb.w, 0)
  g.addColorStop(0, 'rgb(196,158,100)'); g.addColorStop(0.5, 'rgb(158,122,74)'); g.addColorStop(1, 'rgb(96,70,40)')
  ctx.fillStyle = g; ctx.fillRect(gb.x, gb.y, gb.w, gb.h)
  texFill(ctx, weaveTile(), gb, 0.75, 'overlay', Math.max(0.62, 0.9 / s))
  // 안쪽으로 눌린 그림자
  const ti = ctx.createLinearGradient(0, gb.y, 0, gb.y + 20)
  ti.addColorStop(0, 'rgba(10,6,2,0.6)'); ti.addColorStop(1, 'rgba(10,6,2,0)')
  ctx.fillStyle = ti; ctx.fillRect(gb.x, gb.y, gb.w, 20)
  const li = ctx.createLinearGradient(gb.x, 0, gb.x + 16, 0)
  li.addColorStop(0, 'rgba(10,6,2,0.4)'); li.addColorStop(1, 'rgba(10,6,2,0)')
  ctx.fillStyle = li; ctx.fillRect(gb.x, gb.y, 16, gb.h)
  ctx.restore()
  // 나무 살대 두 개
  for (const x of [-58, 52]) {
    woodPanel(ctx, { x, y: gb.y - 2, w: 8, h: gb.h + 4 }, 2, shade(WOOD, 0.06), { tex: 0.5, lx: LX })
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; rr(ctx, gb.x, gb.y, gb.w, gb.h, 12); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,225,170,0.22)'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(gb.x + 10, gb.y + gb.h + 1); ctx.lineTo(gb.x + gb.w - 10, gb.y + gb.h + 1); ctx.stroke()
}

export const tubeRadio: CinemaTemplate = {
  id: 'tube-radio',
  name: '진공관 라디오',
  blurb: '호박색 다이얼이 빛나고 매직아이가 소리에 맞춰 열려요',
  defaultShape: 'wave-line',
  assets: ['radio-table'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = progressOf(f)
    const plate = drawPlate(ctx, f, 'radio-table', { fx: 0.5, fy: 0.5, zoom: 1.01 + 0.02 * p })
    if (!plate) {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#6b7a5e'); g.addColorStop(0.6, '#3d4636'); g.addColorStop(0.62, '#4a2e1a'); g.addColorStop(1, '#150d07')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      texFill(ctx, woodTile(), { x: 0, y: h * 0.62, w, h: h * 0.38 }, 0.4, 'overlay', Math.max(1, u / 700))
    }
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const yBase = py(0.655)
    const wFrac = tall ? 0.92 : w / h > 1.5 ? 0.5 : 0.62
    const s = Math.max(0.2, Math.min((wFrac * w) / RW, (yBase - h * 0.07) / 312))
    const cx = tall ? w / 2 : px(0.5)
    const bd = bandsOf(f)

    // 협탁 위 접지 그림자: 빛이 왼쪽이라 오른쪽으로
    contactShadow(ctx, cx + 12 * s, yBase + 1 * s, RW * 0.55 * s, 11 * s, 0.7)
    // 형태: 라디오 뒤로 번지는 링 / 협탁 앞 가로 띠
    const ringSide = RH * s * 1.3
    softViz(ctx, f, { x: w * 0.16, y: py(0.7), w: w * 0.68, h: u * 0.03 }, { x: cx - ringSide / 2, y: yBase - (RH * s) / 2 - ringSide / 2, w: ringSide, h: ringSide }, 0.2)

    ctx.save()
    ctx.translate(cx, yBase); ctx.scale(s, s)
    // 벽에 지는 그림자(오른쪽)
    ctx.save()
    cabPath(ctx, -RW / 2, -RH, RW, RH, 70, 6)
    ctx.shadowColor = 'rgba(6,4,2,0.4)'; ctx.shadowBlur = 16 * s; ctx.shadowOffsetX = 24 * s; ctx.shadowOffsetY = 4 * s
    ctx.fillStyle = '#000'; ctx.fill()
    ctx.restore()
    // 캐비닛
    ctx.save()
    cabPath(ctx, -RW / 2, -RH, RW, RH, 70, 6); ctx.clip()
    const cab = { x: -RW / 2, y: -RH, w: RW, h: RH }
    woodPanel(ctx, cab, 0, WOOD, { tex: 0.62, sc: 1.1, lx: LX })
    // 윗부분 곡면 빛
    const tg = ctx.createRadialGradient(-60, -RH + 20, 10, -60, -RH + 20, 260)
    tg.addColorStop(0, 'rgba(255,214,160,0.28)'); tg.addColorStop(1, 'rgba(255,214,160,0)')
    ctx.fillStyle = tg; ctx.fillRect(cab.x, cab.y, cab.w, cab.h)
    ctx.restore()
    ctx.save(); cabPath(ctx, -RW / 2, -RH, RW, RH, 70, 6); ctx.clip()
    ctx.strokeStyle = 'rgba(255,225,180,0.4)'; ctx.lineWidth = 2.4
    cabPath(ctx, -RW / 2 + 1.2, -RH + 1.2, RW - 2.4, RH, 69, 6); ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(RW / 2 - 1, -RH + 70); ctx.lineTo(RW / 2 - 1, 0); ctx.stroke()
    ctx.restore()
    // 앞판 홈
    ctx.save()
    rr(ctx, -190, -274, 380, 238, 20); ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.6; ctx.stroke()
    rr(ctx, -188.5, -272.5, 377, 235, 19); ctx.strokeStyle = 'rgba(255,225,170,0.18)'; ctx.lineWidth = 0.8; ctx.stroke()
    ctx.restore()
    dial(ctx, f, bd)
    grille(ctx, s)
    // 베이클라이트 노브
    knob(ctx, -128, -26, 17, -0.6 + 0.01 * Math.sin(f.t * 0.45), { base: [88, 52, 30], ridges: 30, lx: LX, cap: 0.66 })
    knob(ctx, 128, -26, 17, 0.7, { base: [88, 52, 30], ridges: 30, lx: LX, cap: 0.66 })
    knob(ctx, 0, -26, 10, -0.2, { base: [96, 60, 34], ridges: 20, lx: LX, cap: 0.66 })
    // 왼쪽 스탠드빛 / 오른쪽 그늘
    ctx.save()
    cabPath(ctx, -RW / 2, -RH, RW, RH, 70, 6); ctx.clip()
    ctx.globalCompositeOperation = 'soft-light'
    const wg = ctx.createLinearGradient(-RW / 2, 0, RW / 2, 0)
    wg.addColorStop(0, 'rgba(255,200,120,0.5)'); wg.addColorStop(0.5, 'rgba(120,80,40,0.05)'); wg.addColorStop(1, 'rgba(10,6,2,0.55)')
    ctx.fillStyle = wg; ctx.fillRect(-RW / 2, -RH, RW, RH)
    ctx.restore()
    // 발
    ctx.fillStyle = '#1a100a'
    for (const fx of [-RW / 2 + 12, RW / 2 - 30]) { rr(ctx, fx, -3, 18, 5, 1.5); ctx.fill() }
    ctx.restore()

    scrim(ctx, f, py(0.69), h, tn.deep, 0.88)
    vignette(ctx, f, 0.55, tn.deep)
    bandInfo(ctx, f, tn, { y0: h * 0.76, tallY: h * 0.74 })
    grain(ctx, f, 0.075)
  },
}

