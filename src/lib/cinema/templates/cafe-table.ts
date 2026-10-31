import type { CinemaTemplate } from '../types'
import { fitText, mmss } from '../helpers'
import { isInst, isTall, rng, unit } from './_kit'
import { LATIN, SANS, SERIF, coverTones, drawPlate, fallbackBackdrop, grain, hairline, rgba, scrim, serifLyrics, shadowText, softViz, standingCover, trackNoLatin, vignette, tf } from './_scene'

/** 오후 햇살이 드는 카페 테이블. 작은 스피커와 커피 옆에 싱글 슬리브가 서 있고 햇살 속 먼지가 떠다닌다 */
export const cafeTable: CinemaTemplate = {
  id: 'cafe-table',
  name: '카페 테이블',
  blurb: '오후 햇살, 나무 테이블 위 스피커와 커피 한 잔',
  defaultShape: 'bars-reflect',
  assets: ['cafe-table'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = f.duration > 0 ? f.t / f.duration : 0
    const plate = drawPlate(ctx, f, 'cafe-table', { fx: tall ? 0.5 : 0.46, fy: 0.5, zoom: 1.02 + 0.025 * p })
    if (!plate) fallbackBackdrop(ctx, f, tn)
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const ps = plate ? plate.scale : h

    // 햇살 속 먼지(천천히 떠다니며 반짝인다)
    const r = rng(23)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 46; i++) {
      const bx = r(), by = r(), sp = 0.004 + r() * 0.01, ph = r() * 10, sz = u * (0.0012 + r() * 0.0026)
      const x = px(0.2 + ((bx + f.t * sp * 0.6 + 0.02 * Math.sin(f.t * 0.4 + ph)) % 1) * 0.45)
      const y = py(0.05 + ((by + 1 - ((f.t * sp) % 1)) % 1) * 0.5)
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(f.t * 1.3 + ph))
      ctx.fillStyle = `rgba(255,236,200,${a})`
      ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    // 테이블 위 싱글 슬리브
    const side = Math.min(ps * 0.33, w * (tall ? 0.5 : 0.28))
    const cx = Math.max(side / 2 + u * 0.06, px(tall ? 0.41 : 0.3))
    const baseY = py(0.655)
    const cover = { x: cx - side / 2, y: baseY - side, w: side, h: side }
    vignette(ctx, f, 0.42, tn.deep)
    const ink = tn.ink
    scrim(ctx, f, tall ? h * 0.6 : h * 0.66, h, tn.deep, 0.88)
    softViz(ctx, f, tall ? { x: w * 0.1, y: h * 0.63, w: w * 0.8, h: u * 0.08 } : { x: w * 0.56, y: h * 0.925, w: w * 0.38, h: u * 0.05 },
      { x: cx - side * 0.58, y: cover.y + side / 2 - side * 0.58, w: side * 1.16, h: side * 1.16 }, 0.6)
    standingCover(ctx, f, cover, { light: -1, kind: 'sleeve', warm: [255, 222, 170], shadow: 0.5 })

    if (tall) {
      const y0 = h * 0.72
      shadowText(ctx, trackNoLatin(f), w / 2, y0, w * 0.8, u * 0.045, { font: LATIN, color: rgba(tn.glow), align: 'center', baseline: 'middle' })
      shadowText(ctx, f.trackTitle, w / 2, y0 + u * 0.08, w * 0.86, u * 0.068, { font: tf(f, SERIF), weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
      if (!isInst(f)) serifLyrics(ctx, f, { cx: w / 2, cy: y0 + u * 0.26, maxW: w * 0.86, size: u * 0.046, ink, around: 1 })
      hairline(ctx, f, w * 0.2, h * 0.955, w * 0.6, ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, w / 2, h * 0.93, w * 0.6, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'center', baseline: 'middle' })
      if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.05, w * 0.8, u * 0.028, { font: SANS, weight: 400, color: rgba(tn.deep, 0.85), align: 'center', baseline: 'middle' })
    } else {
      const lx = u * 0.07
      const by = h * 0.83
      shadowText(ctx, trackNoLatin(f), lx, by - u * 0.075, w * 0.4, u * 0.04, { font: LATIN, color: rgba(tn.glow), baseline: 'middle' })
      shadowText(ctx, f.trackTitle, lx, by, w * 0.44, u * 0.06, { font: tf(f, SERIF), weight: 300, color: rgba(ink), baseline: 'middle', minSize: 12 })
      hairline(ctx, f, lx, by + u * 0.07, Math.min(w * 0.3, u * 0.5), ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, lx, by + u * 0.105, w * 0.4, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), baseline: 'middle' })
      if (!isInst(f)) serifLyrics(ctx, f, { cx: w * 0.94, cy: by - u * 0.01, maxW: w * 0.44, size: u * 0.042, align: 'right', ink, around: 1 })
      if (f.headline) fitText(ctx, f.headline, w - lx, u * 0.07, w * 0.5, u * 0.026, { font: SANS, weight: 400, color: rgba(tn.deep, 0.8), align: 'right', baseline: 'middle' })
    }
    grain(ctx, f, 0.07)
  },
}
