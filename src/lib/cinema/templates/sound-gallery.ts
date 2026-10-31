import type { CinemaTemplate } from '../types'
import { drawCover, fitText } from '../helpers'
import { drawViz, isCircular } from '../viz'
import { fitRing, ringSpot, lyricSlot, squareAt, trackNo, unit } from './_kit'

export const soundGallery: CinemaTemplate = {
  id: 'sound-gallery',
  name: '사운드 갤러리',
  blurb: '미술관 흰 벽에 걸린 한 점의 작품',
  defaultShape: 'dots',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    // 흰 벽
    const wall = ctx.createLinearGradient(0, 0, 0, h)
    wall.addColorStop(0, '#f1f0ec'); wall.addColorStop(1, '#dedcd6')
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h)
    const floorH = h * 0.12
    ctx.fillStyle = '#1b1a19'; ctx.fillRect(0, h - floorH, w, floorH)
    const circ = isCircular(f.shape)
    // 액자
    const side = tall ? w * 0.68 : Math.min(h * 0.58, w * 0.36)
    const fx = tall ? w / 2 : w * 0.3
    const fy = tall ? h * 0.3 : h * 0.44
    const fr = side * 0.06, mat = side * 0.1
    const outer = side + (fr + mat) * 2
    // 조명 빛
    const lg = ctx.createLinearGradient(0, fy - outer / 2 - u * 0.1, 0, fy + outer / 2)
    lg.addColorStop(0, 'rgba(255,244,214,0.55)'); lg.addColorStop(1, 'rgba(255,244,214,0)')
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.moveTo(fx - outer * 0.18, fy - outer / 2 - u * 0.05); ctx.lineTo(fx + outer * 0.18, fy - outer / 2 - u * 0.05)
    ctx.lineTo(fx + outer * 0.62, fy + outer * 0.55); ctx.lineTo(fx - outer * 0.62, fy + outer * 0.55)
    ctx.closePath(); ctx.fill()
    if (circ) {
      const ring = fitRing(f, fx, fy, outer * 0.95)
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h - floorH); ctx.clip()
      ringSpot(ctx, ring, 'rgba(24,22,26,0.92)', 1.4)
      drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, { bar: { x: 0, y: 0, w: 0, h: 0 }, ring })
      ctx.restore()
    }
    ctx.fillStyle = '#2b2a28'
    ctx.fillRect(fx - outer * 0.2, fy - outer / 2 - u * 0.065, outer * 0.4, u * 0.012)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = u * 0.04; ctx.shadowOffsetY = u * 0.015
    ctx.fillStyle = '#1c1a18'
    ctx.fillRect(fx - outer / 2, fy - outer / 2, outer, outer)
    ctx.restore()
    ctx.fillStyle = '#f8f7f3'
    ctx.fillRect(fx - side / 2 - mat, fy - side / 2 - mat, side + mat * 2, side + mat * 2)
    drawCover(ctx, f, { x: fx - side / 2, y: fy - side / 2, w: side, h: side })
    // 캡션 플레이트
    const cx0 = tall ? w * 0.1 : w * 0.56
    const cw = tall ? w * 0.8 : w * 0.36
    const cy0 = tall ? fy + outer / 2 + u * 0.05 : h * 0.17
    fitText(ctx, trackNo(f), cx0, cy0, cw, u * 0.026, { weight: 700, color: '#8a867d', baseline: 'middle' })
    fitText(ctx, f.trackTitle, cx0, cy0 + u * 0.065, cw, u * 0.062, { weight: 800, color: '#1d1c1a', baseline: 'middle', minSize: 12 })
    ctx.fillStyle = f.palette.accent
    ctx.fillRect(cx0, cy0 + u * 0.115, u * 0.07, Math.max(3, u * 0.006))
    fitText(ctx, f.headline, cx0, cy0 + u * 0.15, cw, u * 0.024, { weight: 500, color: '#8a867d', baseline: 'middle' })
    // 가사(캡션 옆/아래)
    const lyY = tall ? cy0 + u * 0.3 : cy0 + h * 0.3
    lyricSlot(ctx, f, { cx: cx0, cy: lyY, maxW: cw, size: u * (tall ? 0.04 : 0.038), around: 1, align: 'left', color: '#25231f', accent: '#000' })
    // 바닥 띠 스펙트럼
    if (!circ) drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: w * 0.06, y: h - floorH * 0.9, w: w * 0.88, h: floorH * 0.8 },
      ring: squareAt(w * 0.9, h - floorH / 2, floorH * 0.9),
    })
  },
}
