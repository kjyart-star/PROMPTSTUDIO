import type { CinemaTemplate } from '../types'
import { fitText, mmss, paintCover } from '../helpers'
import { drawViz } from '../viz'
import { lyricSlot, progressBar, squareAt, trackNo, unit } from './_kit'

export const cinemaFlow: CinemaTemplate = {
  id: 'cinema-flow',
  name: '시네마 플로우',
  blurb: '커버를 화면 가득 깔고 가운데에 가사를 흘립니다',
  defaultShape: 'wave-line',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const cx = w / 2
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
    paintCover(ctx, f, { x: 0, y: 0, w, h })
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h)
    // 비네트
    const v = ctx.createRadialGradient(cx, h / 2, u * 0.25, cx, h / 2, Math.hypot(w, h) * 0.6)
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)')
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h)
    // 상단 글귀·번호·제목
    fitText(ctx, f.headline, cx, h * 0.075, w * 0.8, u * 0.026, { weight: 600, color: 'rgba(255,255,255,0.6)', align: 'center', baseline: 'middle' })
    fitText(ctx, trackNo(f), cx, h * 0.15, w * 0.8, u * 0.03, { weight: 700, color: f.palette.accent, align: 'center', baseline: 'middle' })
    fitText(ctx, f.trackTitle, cx, h * 0.23, w * 0.86, u * 0.065, { weight: 800, align: 'center', baseline: 'middle', minSize: 12 })
    // 가운데 가사
    lyricSlot(ctx, f, { cx, cy: h * 0.47, maxW: w * 0.84, size: u * 0.058, around: 1, accent: '#fff' })
    // 하단 스펙트럼
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: w * 0.12, y: h * 0.67, w: w * 0.76, h: h * 0.17 },
      ring: squareAt(cx, h * 0.76, Math.min(h * 0.26, w * 0.6)),
    })
    // 맨 아래: 진행선, 제목(왼쪽), 시간(오른쪽)
    progressBar(ctx, f, { x: w * 0.06, y: h * 0.9, w: w * 0.88, h: Math.max(2, u * 0.004) }, 'rgba(255,255,255,0.2)', false)
    fitText(ctx, f.trackTitle, w * 0.06, h * 0.945, w * 0.5, u * 0.026, { weight: 700, color: 'rgba(255,255,255,0.85)', baseline: 'middle' })
    fitText(ctx, `${mmss(f.t)} / ${mmss(f.duration)}`, w * 0.94, h * 0.945, w * 0.34, u * 0.026, { weight: 600, color: 'rgba(255,255,255,0.7)', align: 'right', baseline: 'middle' })
  },
}
