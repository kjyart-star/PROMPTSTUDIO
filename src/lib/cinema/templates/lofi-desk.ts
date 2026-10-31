import type { CinemaTemplate } from '../types'
import { fitText, mmss } from '../helpers'
import { isInst, isTall, rng, unit } from './_kit'
import { LATIN, SANS, SERIF, coverTones, drawPlate, fallbackBackdrop, grain, hairline, rgba, scrim, serifLyrics, shadowText, softViz, standingCover, trackNoLatin, vignette, tf } from './_scene'

/** 늦은 밤 스탠드 불빛 아래 책상. 액자에 넣은 커버, 창밖 도시 불빛이 천천히 켜졌다 꺼진다 */
export const lofiDesk: CinemaTemplate = {
  id: 'lofi-desk',
  name: '새벽 책상',
  blurb: '스탠드 불빛 아래 책상, 액자 속 앨범과 창밖 야경',
  defaultShape: 'wave-dual',
  assets: ['lofi-desk'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const p = f.duration > 0 ? f.t / f.duration : 0
    const plate = drawPlate(ctx, f, 'lofi-desk', { fx: tall ? 0.42 : 0.5, fy: 0.5, zoom: 1.02 + 0.03 * p })
    if (!plate) fallbackBackdrop(ctx, f, tn)
    const px = (x: number) => (plate ? plate.x(x) : x * w)
    const py = (y: number) => (plate ? plate.y(y) : y * h)
    const ps = plate ? plate.scale : h

    // 창밖: 먼 창문 불빛이 천천히 켜지고 꺼진다 + 높은 건물 꼭대기 항공등
    const r = rng(31)
    ctx.save()
    ctx.beginPath(); ctx.rect(px(0.12), py(0.02), px(0.82) - px(0.12), py(0.37) - py(0.02)); ctx.clip()
    for (let i = 0; i < 18; i++) {
      const x = px(0.14 + r() * 0.66), y = py(0.12 + r() * 0.22), per = 9 + r() * 20, ph = r() * per
      const on = Math.sin(((f.t + ph) / per) * Math.PI * 2)
      const a = Math.max(0, on) * 0.5
      const sz = u * (0.004 + r() * 0.004)
      ctx.fillStyle = r() > 0.5 ? `rgba(255,214,150,${a})` : `rgba(200,225,255,${a})`
      ctx.fillRect(x, y, sz * 1.4, sz)
    }
    const blink = (f.t % 1.6) < 0.35 ? 1 : 0.15
    const bg = ctx.createRadialGradient(px(0.274), py(0.05), 0, px(0.274), py(0.05), u * 0.02)
    bg.addColorStop(0, `rgba(255,60,50,${0.9 * blink})`); bg.addColorStop(1, 'rgba(255,60,50,0)')
    ctx.fillStyle = bg; ctx.fillRect(px(0.274) - u * 0.02, py(0.05) - u * 0.02, u * 0.04, u * 0.04)
    ctx.restore()

    // 스탠드 빛이 아주 조금 숨 쉰다(음량에 따라 미세하게)
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    const lg = ctx.createRadialGradient(px(0.74), py(0.62), 0, px(0.74), py(0.62), ps * 0.7)
    lg.addColorStop(0, `rgba(255,190,110,${0.18 + 0.06 * f.level})`); lg.addColorStop(1, 'rgba(255,190,110,0)')
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h)
    ctx.restore()

    const side = Math.min(ps * 0.3, w * (tall ? 0.48 : 0.25))
    const cx = tall ? px(0.33) : Math.max(side / 2 + u * 0.06, px(0.34))
    const baseY = py(0.705)
    const cover = { x: cx - side / 2, y: baseY - side * 1.22, w: side, h: side * 1.22 }
    vignette(ctx, f, 0.6, tn.deep)
    scrim(ctx, f, h * 0.3, 0, tn.deep, 0.7)
    scrim(ctx, f, h * 0.72, h, tn.deep, 0.85)
    softViz(ctx, f, tall ? { x: w * 0.1, y: h * 0.27, w: w * 0.8, h: u * 0.08 } : { x: w * 0.6, y: h * 0.07, w: w * 0.34, h: u * 0.07 },
      { x: cx - side * 0.62, y: cover.y + cover.h / 2 - side * 0.62, w: side * 1.24, h: side * 1.24 }, 0.55)
    standingCover(ctx, f, cover, { light: 1, kind: 'frame', warm: [255, 196, 120], shadow: 0.65 })

    const ink = tn.ink
    const lx = tall ? w / 2 : u * 0.07
    const al: CanvasTextAlign = tall ? 'center' : 'left'
    const ty = tall ? h * 0.08 : h * 0.1
    shadowText(ctx, trackNoLatin(f), lx, ty, w * 0.5, u * 0.042, { font: LATIN, color: rgba(tn.glow), align: al, baseline: 'middle' })
    shadowText(ctx, f.trackTitle, lx, ty + u * 0.075, tall ? w * 0.86 : w * 0.5, u * 0.062, { font: tf(f, SERIF), weight: 300, color: rgba(ink), align: al, baseline: 'middle', minSize: 12 })
    const hw = tall ? w * 0.5 : Math.min(w * 0.3, u * 0.45)
    hairline(ctx, f, tall ? w / 2 - hw / 2 : lx, ty + u * 0.135, hw, ink)
    fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, tall ? w / 2 : lx, ty + u * 0.17, w * 0.5, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: al, baseline: 'middle' })
    if (!isInst(f)) serifLyrics(ctx, f, { cx: w / 2, cy: tall ? h * 0.86 : h * 0.86, maxW: w * 0.84, size: u * 0.045, ink, around: tall ? 1 : 0 })
    if (f.headline) fitText(ctx, f.headline, tall ? w / 2 : w - u * 0.07, tall ? h * 0.035 : h * 0.045, w * 0.5, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.55), align: tall ? 'center' : 'right', baseline: 'middle' })
    grain(ctx, f, 0.08)
  },
}
