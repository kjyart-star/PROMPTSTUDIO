import type { Box, CinemaFrame, CinemaTemplate } from '../types'
import { progressOf } from '../helpers'
import { TAU, bandInfo, bandsOf, castShadow, clamp, edgeLight, glassSheen, isTall, knob, metalPanel, mixc, perfTile, rr, tapeReels, texFill, unit } from './_retro'
import type { RGB } from './_retro'
import { contactShadow, coverTones, drawPlate, grain, rgba, scrim, softViz, vignette } from './_scene'

/**
 * 콘크리트 턱 위에 올려 둔 붐박스. 저음에 맞춰 양쪽 콘이 펌핑하고, 가운데 카세트 도어 속 릴이 돈다.
 * 빛은 오른쪽 위(석양) — 그림자는 왼쪽 아래로 떨어진다. 좌표 단위는 mm(턱 위 접지점이 원점).
 */
const BW = 650, BH = 250
const LX = 1

/** 타공망 패널(원형 구멍들은 비워 둔다 — 콘이 보이는 자리) */
function grille(ctx: CanvasRenderingContext2D, b: Box, holes: [number, number, number][], s: number) {
  ctx.save()
  ctx.beginPath()
  rr(ctx, b.x, b.y, b.w, b.h, 9)
  for (const [x, y, r] of holes) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU, true) }
  ctx.clip('evenodd')
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h)
  g.addColorStop(0, '#3a3a3e'); g.addColorStop(0.5, '#4a4a4f'); g.addColorStop(1, '#2c2c30')
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h)
  texFill(ctx, perfTile(), b, 1, 'source-over', Math.max(0.46, 0.4 / s))
  ctx.restore()
  edgeLight(ctx, b, 9, { k: 1.3, a: 0.28, lx: LX })
}

/** 우퍼: 서라운드·콘·더스트 캡. pump 0..1 이 클수록 캡이 앞으로 나온 듯 커지고 밝아진다 */
function woofer(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, pump: number) {
  // 크롬 테
  const cg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
  cg.addColorStop(0, '#6e6e72'); cg.addColorStop(0.5, '#dcdcda'); cg.addColorStop(1, '#4c4c50')
  ctx.strokeStyle = cg; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.arc(cx, cy, R + 1.6, 0, TAU); ctx.stroke()
  // 서라운드(고무 링)
  const sg = ctx.createRadialGradient(cx, cy, R * 0.74, cx, cy, R)
  sg.addColorStop(0, '#111113'); sg.addColorStop(0.5, '#2e2e32'); sg.addColorStop(1, '#17171a')
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill()
  ctx.strokeStyle = `rgba(255,255,255,${0.14 + 0.1 * pump})`; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, -Math.PI * 0.8, -Math.PI * 0.05); ctx.stroke()
  // 콘
  const k = R * 0.76
  const cn = ctx.createRadialGradient(cx + LX * k * 0.25, cy - k * 0.3, k * 0.1, cx, cy, k)
  cn.addColorStop(0, '#4a4a50'); cn.addColorStop(0.6, '#26262a'); cn.addColorStop(1, '#18181b')
  ctx.fillStyle = cn; ctx.beginPath(); ctx.arc(cx, cy, k, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.9
  for (const q of [0.82, 0.62, 0.46]) { ctx.beginPath(); ctx.arc(cx, cy, k * q, 0, TAU); ctx.stroke() }
  // 더스트 캡
  const dc = R * 0.3 * (1 + 0.1 * pump)
  const dg = ctx.createRadialGradient(cx + LX * dc * 0.35, cy - dc * 0.4, dc * 0.1, cx, cy, dc)
  dg.addColorStop(0, '#9a9aa0'); dg.addColorStop(0.55, '#3c3c42'); dg.addColorStop(1, '#141416')
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, dc, 0, TAU); ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${0.04 * pump})`; ctx.beginPath(); ctx.arc(cx, cy, k, 0, TAU); ctx.fill()
}

function tweeter(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, pump: number) {
  ctx.strokeStyle = '#a9a9ac'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.stroke()
  const d = R * (1 + 0.06 * pump)
  const g = ctx.createRadialGradient(cx + LX * d * 0.3, cy - d * 0.35, d * 0.05, cx, cy, d)
  g.addColorStop(0, '#b8b8bc'); g.addColorStop(0.5, '#4a4a50'); g.addColorStop(1, '#17171a')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, d, 0, TAU); ctx.fill()
}

function speaker(ctx: CanvasRenderingContext2D, cx: number, bd: ReturnType<typeof bandsOf>, t: number, s: number) {
  const area = { x: cx - 92, y: -234, w: 184, h: 214 }
  const wy = -102, wr = 72, ty = -208, tr = 19
  grille(ctx, area, [[cx, wy, wr + 4], [cx, ty, tr + 3]], s)
  const pump = clamp(bd.lo * 0.85 + bd.level * 0.3 + 0.03 * Math.sin(t * 22 + cx))
  woofer(ctx, cx, wy, wr, pump)
  tweeter(ctx, cx, ty, tr, clamp(bd.hi))
}

function centerPanel(ctx: CanvasRenderingContext2D, f: CinemaFrame, bd: ReturnType<typeof bandsOf>) {
  const p = progressOf(f)
  const panel = { x: -122, y: -238, w: 244, h: 220 }
  metalPanel(ctx, panel, 6, [150, 152, 154], { lx: LX, tex: 0.3, sc: 0.8 })
  // 튜너 창(호박색, 눈금만)
  const tw = { x: -108, y: -230, w: 216, h: 28 }
  ctx.fillStyle = '#0a0907'; rr(ctx, tw.x - 2, tw.y - 2, tw.w + 4, tw.h + 4, 3); ctx.fill()
  ctx.save(); rr(ctx, tw.x, tw.y, tw.w, tw.h, 2); ctx.clip()
  const tg = ctx.createLinearGradient(0, tw.y, 0, tw.y + tw.h)
  tg.addColorStop(0, '#f4c36a'); tg.addColorStop(1, '#c4822f')
  ctx.fillStyle = tg; ctx.fillRect(tw.x, tw.y, tw.w, tw.h)
  ctx.strokeStyle = 'rgba(60,34,12,0.85)'
  for (let i = 0; i <= 48; i++) {
    const x = tw.x + 8 + (i / 48) * (tw.w - 16), major = i % 8 === 0
    ctx.lineWidth = major ? 0.9 : 0.5
    ctx.beginPath(); ctx.moveTo(x, tw.y + 6); ctx.lineTo(x, tw.y + (major ? 17 : 12)); ctx.stroke()
  }
  const nx = tw.x + 8 + (tw.w - 16) * 0.42
  ctx.fillStyle = 'rgb(226,40,28)'; ctx.fillRect(nx - 0.6, tw.y + 3, 1.2, tw.h - 6)
  ctx.restore()
  glassSheen(ctx, tw, 2, 0.12)
  // 레벨 LED 5개
  const lit = Math.round(clamp(bd.level * 1.25) * 5)
  for (let i = 0; i < 5; i++) {
    const c: RGB = i < 3 ? [90, 235, 120] : i < 4 ? [255, 206, 70] : [255, 80, 52]
    const x = -44 + i * 22, y = -194
    ctx.fillStyle = i < lit ? rgba(c) : rgba(mixc(c, [10, 10, 12], 0.82))
    ctx.beginPath(); ctx.arc(x, y, 3.6, 0, TAU); ctx.fill()
    if (i < lit) {
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 11)
      gl.addColorStop(0, rgba(c, 0.5)); gl.addColorStop(1, rgba(c, 0))
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill()
    }
  }
  // 카세트 도어(릴이 돈다)
  const bay = { x: -104, y: -182, w: 208, h: 68 }
  ctx.fillStyle = '#0b0a09'; rr(ctx, bay.x - 2, bay.y - 2, bay.w + 4, bay.h + 4, 4); ctx.fill()
  ctx.save(); rr(ctx, bay.x, bay.y, bay.w, bay.h, 3); ctx.clip()
  ctx.fillStyle = '#1b1814'; ctx.fillRect(bay.x, bay.y, bay.w, bay.h)
  const cs = 1.14, ccx = 0, ccy = bay.y + bay.h / 2
  ctx.fillStyle = '#2d2925'; rr(ctx, ccx - 50.2 * cs, ccy - 31.9 * cs, 100.4 * cs, 63.8 * cs, 4); ctx.fill()
  ctx.fillStyle = 'rgb(232,226,208)'; rr(ctx, ccx - 41 * cs, ccy - 30 * cs, 82 * cs, 36 * cs, 2); ctx.fill()
  const win = { x: ccx - 31 * cs, y: ccy - 8.5 * cs, w: 62 * cs, h: 18 * cs }
  ctx.save(); rr(ctx, win.x, win.y, win.w, win.h, 4); ctx.clip()
  ctx.fillStyle = '#17120e'; ctx.fillRect(win.x, win.y, win.w, win.h)
  tapeReels(ctx, { cx: ccx, cy: win.y + win.h / 2, dx: 21 * cs, hubR: 5.6 * cs, rMin: 8.8 * cs, rMax: 19.5 * cs, p, ang: f.t * 5.4 })
  ctx.restore()
  ctx.restore()
  glassSheen(ctx, bay, 3, 0.22)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.8; rr(ctx, bay.x, bay.y, bay.w, bay.h, 3); ctx.stroke()
  // 기능 키 6개
  for (let i = 0; i < 6; i++) {
    const x = -104 + i * 35, y = -104
    const kg = ctx.createLinearGradient(0, y, 0, y + 48)
    kg.addColorStop(0, '#54545a'); kg.addColorStop(1, '#1c1c20')
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = -LX * 1; ctx.shadowOffsetY = 1.5
    ctx.fillStyle = kg; rr(ctx, x, y, 31, 48, 2.5); ctx.fill(); ctx.restore()
    edgeLight(ctx, { x, y, w: 31, h: 48 }, 2.5, { k: 0.8, a: 0.4, lx: LX })
    ctx.fillStyle = i === 1 ? 'rgba(255,214,120,0.95)' : 'rgba(228,226,220,0.8)'
    const cx = x + 15.5, cy = y + 18
    ctx.beginPath()
    if (i === 0) { ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx, cy); ctx.lineTo(cx + 6, cy + 6); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx, cy + 6) }
    else if (i === 1) { ctx.moveTo(cx - 4, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx - 4, cy + 7) }
    else if (i === 2) { ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx, cy); ctx.lineTo(cx - 6, cy + 6); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 6) }
    else if (i === 3) ctx.rect(cx - 5, cy - 5, 10, 10)
    else if (i === 4) { ctx.rect(cx - 6, cy - 6, 4.2, 12); ctx.rect(cx + 1.8, cy - 6, 4.2, 12) }
    else ctx.arc(cx, cy, 5, 0, TAU)
    ctx.fill()
  }
  // 아래 노브 넷
  ;[-78, -26, 26, 78].forEach((x, i) => knob(ctx, x, -36, 12, -0.9 + i * 0.55, { base: [176, 176, 172], ridges: 22, lx: LX, cap: 0.7 }))
}

function handle(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.beginPath(); ctx.rect(-260, -340, 520, 82); ctx.clip()
  const hg = ctx.createLinearGradient(-215, -318, 215, -256)
  hg.addColorStop(0, '#6e6e72'); hg.addColorStop(0.35, '#d6d6d4'); hg.addColorStop(0.7, '#8c8c90'); hg.addColorStop(1, '#4a4a4e')
  ctx.strokeStyle = hg; ctx.lineWidth = 12; ctx.lineJoin = 'round'
  rr(ctx, -215, -318, 430, 90, 30); ctx.stroke()
  // 윗면에 닿는 빛
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-190, -322); ctx.lineTo(190, -322); ctx.stroke()
  // 고무 손잡이
  ctx.strokeStyle = '#1c1c1f'; ctx.lineWidth = 13
  ctx.beginPath(); ctx.moveTo(-110, -318); ctx.lineTo(110, -318); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(-108, -321.5); ctx.lineTo(108, -321.5); ctx.stroke()
  ctx.restore()
}

export const boombox: CinemaTemplate = {
  id: 'boombox',
  name: '붐박스',
  blurb: '석양 비치는 콘크리트 턱 위, 스피커가 쿵쿵 울려요',
  defaultShape: 'bars-round',
  assets: ['boombox-wall'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const topText = tall || w / h < 1.5
    const tn = coverTones(f)
    const p = progressOf(f)
    const plate = drawPlate(ctx, f, 'boombox-wall', { fx: 0.5, fy: 0.5, zoom: 1.01 + 0.02 * p })
    if (!plate) {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#d9ccb0'); g.addColorStop(0.65, '#b9a98a'); g.addColorStop(0.66, '#8d8068'); g.addColorStop(1, '#4d4538')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    }
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const yBase = py(0.752)
    const wFrac = tall ? 0.92 : w / h > 1.5 ? 0.66 : 0.78
    const s = Math.max(0.2, Math.min((wFrac * w) / BW, (yBase - h * (topText ? 0.2 : 0.07)) / 322))
    const cx = tall ? w / 2 : px(0.5)
    const bd = bandsOf(f)

    if (topText) {
      // 벽 위쪽을 은은하게 밝혀 어두운 글자가 읽히게
      const lg = ctx.createLinearGradient(0, 0, 0, h * 0.52)
      lg.addColorStop(0, 'rgba(244,236,218,0.5)'); lg.addColorStop(1, 'rgba(244,236,218,0)')
      ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h * 0.52)
    }

    // 접지 그림자: 빛이 오른쪽이라 왼쪽 아래로
    contactShadow(ctx, cx - 14 * s, yBase + 2 * s, BW * 0.56 * s, 12 * s, 0.7)
    // 형태: 박스 뒤로 번지는 링 / 턱 앞면의 가로 띠
    const ringSide = BH * s * 1.5
    softViz(ctx, f, { x: w * 0.1, y: py(0.766), w: w * 0.8, h: u * 0.028 }, { x: cx - ringSide / 2, y: yBase - (BH * s) / 2 - ringSide / 2, w: ringSide, h: ringSide }, 0.22)

    ctx.save()
    ctx.translate(cx, yBase); ctx.scale(s, s)
    const body = { x: -BW / 2, y: -BH, w: BW, h: BH }
    // 벽에 지는 그림자
    castShadow(ctx, body, 14, { dx: -26 * s, dy: 5 * s, blur: 14 * s, a: 0.34 })
    // 손잡이 그림자
    ctx.save()
    const BIG = 6000
    ctx.translate(-BIG / s, 0)
    ctx.shadowColor = 'rgba(8,6,4,0.28)'; ctx.shadowBlur = 8 * s; ctx.shadowOffsetX = BIG - 22 * s; ctx.shadowOffsetY = 5 * s
    ctx.strokeStyle = '#000'; ctx.lineWidth = 12; rr(ctx, -215, -318, 430, 90, 30); ctx.stroke()
    ctx.restore()
    handle(ctx)
    // 윗면(살짝 내려다보이는 면)
    const tg = ctx.createLinearGradient(-BW / 2, 0, BW / 2, 0)
    tg.addColorStop(0, '#2a2a2e'); tg.addColorStop(0.7, '#4a4a50'); tg.addColorStop(1, '#7a7a80')
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-BW / 2 + 4, -BH); ctx.lineTo(-BW / 2 + 12, -BH - 13); ctx.lineTo(BW / 2 - 12, -BH - 13); ctx.lineTo(BW / 2 - 4, -BH); ctx.closePath(); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-BW / 2 + 14, -BH - 13, BW - 28, 0.9)
    // 몸체
    const bg = ctx.createLinearGradient(-BW / 2, 0, BW / 2, 0)
    bg.addColorStop(0, '#1b1b1e'); bg.addColorStop(0.6, '#2a2a2e'); bg.addColorStop(1, '#3a3a40')
    ctx.fillStyle = bg; rr(ctx, body.x, body.y, body.w, body.h, 14); ctx.fill()
    const vg = ctx.createLinearGradient(0, body.y, 0, body.y + body.h)
    vg.addColorStop(0, 'rgba(255,255,255,0.16)'); vg.addColorStop(0.08, 'rgba(255,255,255,0)'); vg.addColorStop(0.9, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx.fillStyle = vg; rr(ctx, body.x, body.y, body.w, body.h, 14); ctx.fill()
    speaker(ctx, -218, bd, f.t, s)
    speaker(ctx, 218, bd, f.t + 1.3, s)
    centerPanel(ctx, f, bd)
    // 아랫 테두리 은색 몰딩 + 몸체 가장자리 빛
    ctx.fillStyle = 'rgba(190,190,188,0.55)'; ctx.fillRect(-BW / 2 + 14, -8, BW - 28, 1.4)
    edgeLight(ctx, body, 14, { k: 2, a: 0.32, lx: LX })
    // 석양빛: 오른쪽이 따뜻하게
    ctx.save()
    rr(ctx, body.x, body.y, body.w, body.h, 14); ctx.clip()
    ctx.globalCompositeOperation = 'soft-light'
    const wg = ctx.createLinearGradient(-BW / 2, 0, BW / 2, 0)
    wg.addColorStop(0, 'rgba(40,24,14,0.3)'); wg.addColorStop(1, 'rgba(255,196,120,0.5)')
    ctx.fillStyle = wg; ctx.fillRect(body.x, body.y, body.w, body.h)
    ctx.restore()
    ctx.restore()

    if (!topText) scrim(ctx, f, py(0.775), h, tn.deep, 0.78)
    vignette(ctx, f, 0.4, tn.deep)
    if (topText) {
      const dark: RGB = mixc(tn.deep, [18, 12, 8], 0.5)
      bandInfo(ctx, f, tn, { y0: h * (tall ? 0.085 : 0.075), tallY: h * 0.085, ink: dark, glow: mixc(tn.mid, [0, 0, 0], 0.5), shadow: false, headlineInk: dark })
    } else {
      bandInfo(ctx, f, tn, { y0: h * 0.82, tallY: h * 0.82 })
    }
    grain(ctx, f, 0.07)
  },
}

