import type { CinemaTemplate } from '../types'
import { drawBlurBackdrop, drawCover, fitText, mmss } from '../helpers'
import { drawViz } from '../viz'
import { fitRing, isInst, lyricSlot, progressBar, squareAt, trackNo, unit } from './_kit'

export const albumBlur: CinemaTemplate = {
  id: 'album-blur',
  name: '앨범 블러',
  blurb: '커버를 흐리게 깔고 가운데에 크게 세웁니다',
  defaultShape: 'bars-reflect',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    drawBlurBackdrop(ctx, f, 0.5)
    const c = Math.min(h * 0.4, w * 0.6)
    const cx = w / 2, cy = h * 0.36
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: w * 0.12, y: h * 0.925, w: w * 0.76, h: h * 0.06 },
      ring: fitRing(f, cx, cy, c * 1.12),
    })
    // 커버 그림자 + 커버
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = u * 0.06; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#000'
    ctx.fillRect(cx - c / 2, cy - c / 2, c, c)
    ctx.restore()
    drawCover(ctx, f, { x: cx - c / 2, y: cy - c / 2, w: c, h: c }, u * 0.025)
    // 제목·번호
    fitText(ctx, trackNo(f), cx, h * 0.715, w * 0.8, u * 0.026, { weight: 600, color: 'rgba(255,255,255,0.65)', align: 'center', baseline: 'middle' })
    fitText(ctx, f.trackTitle, cx, h * 0.76, w * 0.84, u * 0.055, { weight: 800, align: 'center', baseline: 'middle', minSize: 12 })
    // 진행바 + 시간
    const bw = Math.min(w * 0.7, u * 1.1), bx = cx - bw / 2
    progressBar(ctx, f, { x: bx, y: h * 0.81, w: bw, h: Math.max(3, u * 0.006) })
    fitText(ctx, mmss(f.t), bx, h * 0.835, bw / 2, u * 0.022, { weight: 600, color: 'rgba(255,255,255,0.7)', baseline: 'middle' })
    fitText(ctx, mmss(f.duration), bx + bw, h * 0.835, bw / 2, u * 0.022, { weight: 600, color: 'rgba(255,255,255,0.7)', align: 'right', baseline: 'middle' })
    if (!isInst(f)) lyricSlot(ctx, f, { cx, cy: h * 0.875, maxW: w * 0.86, size: u * 0.034, around: 0, accent: f.palette.accent })
  },
}
