import type { CinemaTemplate } from '../types'
import { drawCover, fitText } from '../helpers'
import { drawViz } from '../viz'
import { fitRing, lyricSlot, paletteGrad, squareAt, trackNo, unit } from './_kit'

export const photoStage: CinemaTemplate = {
  id: 'photo-stage',
  name: '포토 스테이지',
  blurb: '스포트라이트 아래 기울어진 사진 한 장',
  defaultShape: 'ring-bars',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    // 어두운 무대
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#05050a'); bg.addColorStop(1, '#14101c')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    // 사진 위치
    const pw = tall ? w * 0.6 : Math.min(h * 0.56, w * 0.34)
    const ph = pw * 1.18
    const px = tall ? w / 2 : w * 0.3
    const py = tall ? h * 0.3 : h * 0.47
    // 스포트라이트 원뿔
    ctx.save()
    const cone = ctx.createLinearGradient(px, 0, px, py + ph * 0.6)
    cone.addColorStop(0, 'rgba(255,240,210,0.30)'); cone.addColorStop(1, 'rgba(255,240,210,0.04)')
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(px - u * 0.04, 0); ctx.lineTo(px + u * 0.04, 0)
    ctx.lineTo(px + pw * 0.95, py + ph * 0.75); ctx.lineTo(px - pw * 0.95, py + ph * 0.75)
    ctx.closePath(); ctx.fill()
    // 바닥 빛 웅덩이
    ctx.translate(px, py + ph * 0.62); ctx.scale(1, 0.22)
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 1.1)
    pool.addColorStop(0, 'rgba(255,235,200,0.45)'); pool.addColorStop(1, 'rgba(255,235,200,0)')
    ctx.fillStyle = pool
    ctx.beginPath(); ctx.arc(0, 0, pw * 1.1, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // 스펙트럼
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: tall ? { x: w * 0.1, y: h * 0.9, w: w * 0.8, h: h * 0.07 } : { x: w * 0.54, y: h * 0.78, w: w * 0.4, h: h * 0.14 },
      ring: fitRing(f, px, py, ph * 1.08),
    })
    // 기울어진 폴라로이드
    ctx.save()
    ctx.translate(px, py); ctx.rotate(-0.07 + Math.sin(f.t * 0.6) * 0.008)
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#f4f1ea'
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph)
    ctx.shadowColor = 'transparent'
    const m = pw * 0.07
    drawCover(ctx, f, { x: -pw / 2 + m, y: -ph / 2 + m, w: pw - m * 2, h: pw - m * 2 })
    fitText(ctx, f.trackTitle, 0, ph / 2 - (ph - pw) * 0.28, pw - m * 2, pw * 0.085, { weight: 700, color: '#2b2622', align: 'center', baseline: 'middle', minSize: 9 })
    ctx.restore()
    // 가사 쪽
    const lx = tall ? w / 2 : w * 0.72
    const ly = tall ? h * 0.67 : h * 0.4
    const lw = tall ? w * 0.84 : w * 0.4
    fitText(ctx, `${trackNo(f)}`, lx, ly - (tall ? h * 0.155 : h * 0.24), lw, u * 0.03, { weight: 700, color: f.palette.accent, align: 'center', baseline: 'middle' })
    fitText(ctx, f.headline, lx, ly - (tall ? h * 0.125 : h * 0.19), lw, u * 0.024, { weight: 500, color: 'rgba(255,255,255,0.5)', align: 'center', baseline: 'middle' })
    ctx.fillStyle = paletteGrad(ctx, f, lx - lw * 0.15, 0, lx + lw * 0.15, 0)
    ctx.fillRect(lx - lw * 0.15, ly - (tall ? h * 0.095 : h * 0.15), lw * 0.3, Math.max(2, u * 0.004))
    lyricSlot(ctx, f, { cx: lx, cy: ly, maxW: lw, size: u * (tall ? 0.05 : 0.052), around: 1, accent: f.palette.accent, titleInst: true })
  },
}
