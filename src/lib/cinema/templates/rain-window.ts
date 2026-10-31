import type { CinemaTemplate } from '../types'
import { fitText, mmss } from '../helpers'
import { isInst, isTall, rng, unit } from './_kit'
import { LATIN, SANS, SERIF, coverTones, drawPlate, fallbackBackdrop, grain, hairline, rgba, serifLyrics, shadowText, softViz, standingCover, trackNoLatin, vignette, tf, coverEl } from './_scene'

/** 비 오는 밤 창가. 창턱에 커버가 기대 서 있고 유리를 타고 빗방울이 흘러내린다 */
export const rainWindow: CinemaTemplate = {
  id: 'rain-window',
  name: '비 오는 창가',
  blurb: '젖은 유리창 너머 도시 불빛, 창턱에 기대 둔 앨범',
  defaultShape: 'wave-line',
  assets: ['rain-window'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = f.duration > 0 ? f.t / f.duration : 0
    const plate = drawPlate(ctx, f, 'rain-window', { fx: tall ? 0.4 : 0.47, fy: 0.55, zoom: 1.02 + 0.03 * p })
    if (!plate) fallbackBackdrop(ctx, f, tn)
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const ps = plate ? plate.scale : h

    // 흘러내리는 빗방울(유리 영역 안에서만)
    const gx0 = px(0.1), gx1 = px(0.89), gy0 = py(0), gy1 = py(0.72)
    ctx.save()
    ctx.beginPath(); ctx.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); ctx.clip()
    const r = rng(7)
    for (let i = 0; i < 34; i++) {
      const x = gx0 + r() * (gx1 - gx0)
      const speed = 0.05 + r() * 0.09, off = r(), wob = r()
      const k = (off + f.t * speed + 0.015 * Math.sin(f.t * (1 + wob * 3))) % 1.25
      const y = gy0 + k * (gy1 - gy0)
      const rad = u * (0.0035 + r() * 0.005)
      const tg = ctx.createLinearGradient(0, y - rad * 26, 0, y)
      tg.addColorStop(0, 'rgba(255,240,220,0)'); tg.addColorStop(1, 'rgba(255,240,220,0.13)')
      ctx.fillStyle = tg; ctx.fillRect(x - rad * 0.28, y - rad * 26, rad * 0.56, rad * 26)
      const dg = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad * 1.15)
      dg.addColorStop(0, 'rgba(255,248,235,0.75)'); dg.addColorStop(0.45, 'rgba(255,230,200,0.12)'); dg.addColorStop(1, 'rgba(8,6,4,0.35)')
      ctx.fillStyle = dg
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 1.25, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    // 창턱 위 커버
    const side = Math.min(ps * 0.36, w * (tall ? 0.62 : 0.3))
    const cx = tall ? w / 2 : Math.max(side / 2 + u * 0.08, px(0.27))
    const baseY = py(0.835)
    const cover = { x: cx - side / 2, y: baseY - side, w: side, h: side }
    softViz(ctx, f, tall ? { x: w * 0.12, y: cover.y - u * 0.17, w: w * 0.76, h: u * 0.08 } : { x: cover.x + side + u * 0.08, y: py(0.6), w: Math.min(w * 0.36, w - cover.x - side - u * 0.16), h: u * 0.08 },
      { x: cx - side * 0.56, y: cover.y + side / 2 - side * 0.56, w: side * 1.12, h: side * 1.12 }, 0.55)
    coverEl(ctx, cover, () => standingCover(ctx, f, cover, { light: tall ? -0.5 : 0.6, kind: 'print', warm: [255, 206, 150] }))

    vignette(ctx, f, 0.55, tn.deep)

    // 글자: 넓은 화면은 커버 오른쪽 세로 단, 세로 화면은 위쪽
    const ink = tn.ink
    if (tall) {
      shadowText(ctx, trackNoLatin(f), w / 2, h * 0.09, w * 0.8, u * 0.05, { font: LATIN, weight: 400, color: rgba(tn.glow, 0.95), align: 'center', baseline: 'middle' })
      shadowText(ctx, f.trackTitle, w / 2, h * 0.14, w * 0.84, u * 0.07, { font: tf(f, SERIF), weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
      hairline(ctx, f, w * 0.3, h * 0.185, w * 0.4, ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, w / 2, h * 0.21, w * 0.6, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.7), align: 'center', baseline: 'middle' })
      if (!isInst(f)) serifLyrics(ctx, f, { cx: w / 2, cy: h * 0.36, maxW: w * 0.86, size: u * 0.052, ink, accent: ink })
      if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.04, w * 0.8, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'center', baseline: 'middle' })
    } else {
      const tx = cover.x + side + u * 0.1
      const tw = Math.max(u * 0.3, w * 0.94 - tx)
      // 글자 쪽을 조금 가라앉혀 읽히게
      const sg = ctx.createLinearGradient(tx - u * 0.2, 0, tx + u * 0.25, 0)
      sg.addColorStop(0, rgba(tn.deep, 0)); sg.addColorStop(1, rgba(tn.deep, 0.62))
      ctx.fillStyle = sg; ctx.fillRect(tx - u * 0.2, 0, w - tx + u * 0.2, h)
      const inst = isInst(f)
      const top = inst ? h * 0.36 : h * 0.17
      shadowText(ctx, trackNoLatin(f), tx, top, tw, u * 0.048, { font: LATIN, weight: 400, color: rgba(tn.glow, 0.95), baseline: 'middle' })
      shadowText(ctx, f.trackTitle, tx, top + u * 0.085, tw, u * (inst ? 0.085 : 0.066), { font: tf(f, SERIF), weight: 300, color: rgba(ink), baseline: 'middle', minSize: 12 })
      hairline(ctx, f, tx, top + u * 0.15, Math.min(tw, u * 0.5), ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, tx, top + u * 0.19, tw, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.7), baseline: 'middle' })
      if (!inst) serifLyrics(ctx, f, { cx: tx, cy: h * 0.5, maxW: tw, size: u * 0.048, align: 'left', ink, accent: ink })
      if (f.headline) fitText(ctx, f.headline, u * 0.06, u * 0.07, w * 0.5, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.6), baseline: 'middle' })
    }
    grain(ctx, f, 0.08)
  },
}
