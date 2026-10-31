import type { CinemaFrame, CinemaTemplate } from '../types'
import { drawCover, fitText, mmss, progressOf } from '../helpers'
import { HAND, SANS, TAU, deskFallback, deskInfo, edgeLight, glassSheen, isTall, mixc, reelHub, rr, screw, unit } from './_retro'
import type { Tones } from './_retro'
import { coverTones, drawPlate, grain, rgba, scrim, softViz, vignette } from './_scene'

/**
 * 위에서 내려다본 책상 위 카세트테이프. 100.4×63.8mm 실제 비율, 스모크 쉘·나사·손글씨 라벨,
 * 창 속 릴이 돌고 감긴 테이프가 진행에 따라 왼쪽에서 오른쪽으로 옮겨 간다. 옆에는 커버를 끼운 투명 케이스.
 * 빛은 왼쪽 위(사진의 책상등) — 그림자는 모두 오른쪽 아래로 떨어진다. 좌표 단위는 mm.
 */
const CW = 100.4, CH = 63.8

interface Lay { s: number; ccx: number; ccy: number; kcx: number; kcy: number; bottom: number; tallY: number }

function layout(f: CinemaFrame): Lay {
  const { w, h } = f
  if (isTall(f)) {
    const s = (0.8 * w) / CW
    const ccy = 0.05 * h + (CH / 2) * s
    const kcy = ccy + 62 * s
    return { s, ccx: 0.5 * w, ccy, kcx: 0.53 * w, kcy, bottom: kcy + 35 * s, tallY: h * 0.715 }
  }
  if (w / h >= 1.45) {
    const s = Math.min((0.55 * h) / 70, (0.88 * w) / 216.4)
    const m = (w - 210.4 * s) / 3
    const cy = 0.375 * h
    return { s, ccx: m + (CW / 2) * s, ccy: cy, kcx: 2 * m + CW * s + 55 * s, kcy: cy, bottom: cy + 36 * s, tallY: 0 }
  }
  const s = Math.min((0.5 * w) / CW, 0.0056 * h)
  const ccx = w / 2 - 22.4 * s
  const ccy = 0.09 * h + (CH / 2) * s
  const kcy = ccy + 36 * s
  return { s, ccx, ccy, kcx: ccx + 40 * s, kcy, bottom: kcy + 35 * s, tallY: 0 }
}

/** 투명 케이스(커버가 끼워진 J 카드). 책상에 누워 있다 */
function caseObj(ctx: CanvasRenderingContext2D, f: CinemaFrame, cx: number, cy: number, s: number, rot: number) {
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(rot)
  // 드리운 그림자(투명 몸체라 반투명 채움 + 진한 그림자색 = 옅은 그림자)
  ctx.save()
  ctx.shadowColor = 'rgba(6,4,3,0.95)'; ctx.shadowBlur = 3.6 * s; ctx.shadowOffsetX = 2.8 * s; ctx.shadowOffsetY = 3.8 * s
  ctx.fillStyle = 'rgba(30,28,26,0.5)'
  ctx.scale(s, s); rr(ctx, -55, -35, 110, 70, 2.2); ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.scale(s, s)
  const body = { x: -55, y: -35, w: 110, h: 70 }
  ctx.fillStyle = 'rgba(205,215,220,0.1)'; rr(ctx, body.x, body.y, body.w, body.h, 2.2); ctx.fill()
  // J 카드(커버)
  const ins = { x: -49, y: -27, w: 98, h: 59 }
  drawCover(ctx, f, ins, 0)
  const lg = ctx.createLinearGradient(ins.x, 0, ins.x + ins.w, 0)
  lg.addColorStop(0, 'rgba(255,255,255,0.1)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = lg; ctx.fillRect(ins.x, ins.y, ins.w, ins.h)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ins.x, ins.y, ins.w, 0.35)
  // 경첩 띠
  ctx.fillStyle = 'rgba(235,240,242,0.14)'; ctx.fillRect(-55, -35, 110, 6)
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  for (let k = 0; k < 6; k++) ctx.fillRect(-48 + k * 17.5, -33.6, 8, 3.4)
  // 뚜껑 광택
  glassSheen(ctx, body, 2.2, 0.15)
  ctx.save(); rr(ctx, body.x, body.y, body.w, body.h, 2.2); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.11)'
  ctx.beginPath(); ctx.moveTo(12, -35); ctx.lineTo(19, -35); ctx.lineTo(-18, 35); ctx.lineTo(-25, 35); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath(); ctx.moveTo(26, -35); ctx.lineTo(29, -35); ctx.lineTo(-8, 35); ctx.lineTo(-11, 35); ctx.closePath(); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.3; rr(ctx, -52.8, -32.8, 105.6, 65.6, 1.4); ctx.stroke()
  edgeLight(ctx, body, 2.2, { k: 0.55, a: 0.6 })
  ctx.restore()
  ctx.restore()
}

/** 카세트 본체 */
function cassetteObj(ctx: CanvasRenderingContext2D, f: CinemaFrame, tn: Tones, cx: number, cy: number, s: number, rot: number) {
  const p = progressOf(f)
  const ang = f.t * 5.4
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(rot)
  // 접지 그림자(넓게 + 바짝)
  for (const [blur, ox, oy, a] of [[3.4, 2.4, 3.2, 0.62], [0.8, 0.5, 0.7, 0.5]] as const) {
    ctx.save()
    ctx.shadowColor = `rgba(6,4,3,${a})`; ctx.shadowBlur = blur * s; ctx.shadowOffsetX = ox * s; ctx.shadowOffsetY = oy * s
    ctx.fillStyle = '#1c1917'; ctx.scale(s, s); rr(ctx, -CW / 2, -CH / 2, CW, CH, 3); ctx.fill()
    ctx.restore()
  }
  ctx.save()
  ctx.scale(s, s)
  // 스모크 쉘
  const sg = ctx.createLinearGradient(-50, -32, 50, 32)
  sg.addColorStop(0, 'rgba(92,84,78,0.95)'); sg.addColorStop(0.5, 'rgba(46,41,38,0.96)'); sg.addColorStop(1, 'rgba(26,23,21,0.97)')
  ctx.fillStyle = sg; rr(ctx, -CW / 2, -CH / 2, CW, CH, 3); ctx.fill()
  ctx.save()
  rr(ctx, -CW / 2, -CH / 2, CW, CH, 3); ctx.clip()
  ctx.strokeStyle = 'rgba(215,205,195,0.22)'; ctx.lineWidth = 2.6; rr(ctx, -CW / 2, -CH / 2, CW, CH, 3); ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.35; rr(ctx, -48, -29.7, 96, 59.4, 2); ctx.stroke()

  // 아래쪽 테이프 통로(쉘 안쪽이 비쳐 보인다)
  ctx.strokeStyle = 'rgba(86,56,36,0.8)'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(-27, 27.6); ctx.lineTo(27, 27.6); ctx.stroke()
  for (const sx of [-1, 1]) {
    const rg = ctx.createRadialGradient(sx * 27 - 0.5, 27, 0.2, sx * 27, 27.6, 2.4)
    rg.addColorStop(0, '#8d8982'); rg.addColorStop(1, '#2c2926')
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx * 27, 27.6, 2.4, 0, TAU); ctx.fill()
  }
  // 아래 사다리꼴
  ctx.beginPath(); ctx.moveTo(-31, 21.8); ctx.lineTo(31, 21.8); ctx.lineTo(37.5, 31.4); ctx.lineTo(-37.5, 31.4); ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.4; ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(-31, 22.1); ctx.lineTo(31, 22.1); ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-5.5, 26.2, 11, 5.2)
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 13, 29, 1.5, 0, TAU); ctx.fill() }

  // 라벨지
  const lab = { x: -41, y: -30, w: 82, h: 45 }
  const pg = ctx.createLinearGradient(0, lab.y, 0, lab.y + lab.h)
  pg.addColorStop(0, 'rgb(238,232,216)'); pg.addColorStop(1, 'rgb(220,212,192)')
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 0.8 * s; ctx.shadowOffsetX = 0.2 * s; ctx.shadowOffsetY = 0.35 * s
  ctx.fillStyle = pg; rr(ctx, lab.x, lab.y, lab.w, lab.h, 1.4); ctx.fill()
  ctx.restore()
  ctx.save()
  rr(ctx, lab.x, lab.y, lab.w, lab.h, 1.4); ctx.clip()
  ctx.fillStyle = rgba(mixc(tn.glow, [255, 255, 255], 0.1), 0.9); ctx.fillRect(lab.x, lab.y, lab.w, 3.7)
  ctx.fillStyle = rgba(tn.mid, 0.75); ctx.fillRect(lab.x, lab.y + lab.h - 2.2, lab.w, 2.2)
  ctx.strokeStyle = 'rgba(90,120,160,0.42)'; ctx.lineWidth = 0.28
  for (const ly of [-22, -12.4]) { ctx.beginPath(); ctx.moveTo(-27, ly); ctx.lineTo(39, ly); ctx.stroke() }
  // A 면 표시
  ctx.strokeStyle = 'rgba(70,44,34,0.7)'; ctx.lineWidth = 0.35; rr(ctx, -39.5, -25.5, 9.5, 15.5, 1.1); ctx.stroke()
  fitText(ctx, 'A', -34.75, -14.8, 8, 11.5, { font: SANS, weight: 700, color: 'rgba(60,38,30,0.82)', align: 'center', minSize: 4 })
  // 손글씨
  const inkc = 'rgba(28,40,112,0.88)'
  fitText(ctx, `No.${f.trackIndex + 1}  A면`, -27, -22.4, 40, 5, { font: HAND, weight: 400, color: inkc, minSize: 3 })
  fitText(ctx, f.trackTitle, -27, -12.8, 66, 8.4, { font: HAND, weight: 400, color: inkc, minSize: 3.5 })
  fitText(ctx, mmss(f.duration), 39, 13, 18, 5.4, { font: HAND, weight: 400, color: inkc, align: 'right', minSize: 3 })
  ctx.restore()

  // 창 + 릴
  const win = { x: -31, y: -8.5, w: 62, h: 18 }
  ctx.save()
  rr(ctx, win.x, win.y, win.w, win.h, 3.2); ctx.clip()
  const wg = ctx.createLinearGradient(0, win.y, 0, win.y + win.h)
  wg.addColorStop(0, '#12100d'); wg.addColorStop(1, '#251e18')
  ctx.fillStyle = wg; ctx.fillRect(win.x, win.y, win.w, win.h)
  // 감긴 양: 면적이 보존되도록 반지름을 정한다
  const R = 19.5, r0 = 8.8
  const rl = Math.sqrt(R * R * (1 - p) + r0 * r0 * p), rrr = Math.sqrt(r0 * r0 * (1 - p) + R * R * p)
  for (const [hx, rad] of [[-21, rl], [21, rrr]] as const) {
    const tg = ctx.createRadialGradient(hx, 0.5, r0 * 0.6, hx, 0.5, rad)
    tg.addColorStop(0, '#1d130d'); tg.addColorStop(0.7, '#3a271a'); tg.addColorStop(1, '#5a422e')
    ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(hx, 0.5, rad, 0, TAU); ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.3
    for (const k of [0.8, 0.9]) { ctx.beginPath(); ctx.arc(hx, 0.5, Math.max(r0, rad * k), 0, TAU); ctx.stroke() }
    ctx.strokeStyle = 'rgba(255,230,200,0.2)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.arc(hx, 0.5, rad - 0.3, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke()
  }
  reelHub(ctx, -21, 0.5, 5.6, ang); reelHub(ctx, 21, 0.5, 5.6, ang)
  const ig = ctx.createLinearGradient(0, win.y, 0, win.y + 4)
  ig.addColorStop(0, 'rgba(0,0,0,0.5)'); ig.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ig; ctx.fillRect(win.x, win.y, win.w, 4)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath(); ctx.moveTo(win.x, win.y); ctx.lineTo(win.x + 30, win.y); ctx.lineTo(win.x + 12, win.y + win.h); ctx.lineTo(win.x, win.y + win.h); ctx.closePath(); ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 0.5; rr(ctx, win.x, win.y, win.w, win.h, 3.2); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.3
  ctx.beginPath(); ctx.moveTo(-28, win.y + win.h + 0.3); ctx.lineTo(28, win.y + win.h + 0.3); ctx.stroke()

  // 나사
  for (const [sx, sy, a] of [[-46.4, -27, 0.4], [46.4, -27, 1.1], [-46.4, 27, 0.9], [46.4, 27, 0.2], [0, 18.2, 0.7]] as const) screw(ctx, sx, sy, 2.1, a)

  // 쉘 광택·모서리 빛
  ctx.save()
  rr(ctx, -CW / 2, -CH / 2, CW, CH, 3); ctx.clip()
  const gg = ctx.createLinearGradient(-50, -32, 12, 22)
  gg.addColorStop(0, 'rgba(255,255,255,0.2)'); gg.addColorStop(0.55, 'rgba(255,255,255,0)')
  ctx.fillStyle = gg; ctx.fillRect(-CW / 2, -CH / 2, CW, CH)
  ctx.restore()
  edgeLight(ctx, { x: -CW / 2, y: -CH / 2, w: CW, h: CH }, 3, { k: 0.6, a: 0.55 })
  ctx.restore()
  ctx.restore()
}

export const realCassette: CinemaTemplate = {
  id: 'real-cassette',
  name: '리얼 카세트',
  blurb: '책상 위 카세트테이프, 릴이 돌고 테이프가 감겨 가요',
  defaultShape: 'bars-reflect',
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

    // 장면 속 빛으로 깔리는 형태(카세트 뒤에서 번져 나온다)
    const bandH = u * 0.045
    const barBox = { x: w * 0.07, y: Math.min(h * 0.93, L.bottom + u * 0.035), w: w * 0.86, h: bandH }
    const ringSide = CH * s * 1.7
    softViz(ctx, f, barBox, { x: L.ccx - ringSide / 2, y: L.ccy - ringSide / 2, w: ringSide, h: ringSide }, 0.34)

    caseObj(ctx, f, L.kcx, L.kcy, s, 0.035)
    cassetteObj(ctx, f, tn, L.ccx, L.ccy, s, -0.04)

    scrim(ctx, f, h * (tall ? 0.64 : 0.6), h * 0.96, tn.deep, 0.55)
    vignette(ctx, f, 0.5, tn.deep)
    deskInfo(ctx, f, tn, { tallY: L.tallY })
    grain(ctx, f, 0.07)
  },
}

