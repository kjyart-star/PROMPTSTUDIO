import type { CinemaTemplate } from '../types'
import { fitText, progressOf, roundRectPath } from '../helpers'
import { drawViz, isCircular } from '../viz'
import { lyricSlot, paletteGrad, squareAt, trackNo, unit } from './_kit'

export const cassette: CinemaTemplate = {
  id: 'cassette',
  name: '카세트',
  blurb: '릴이 돌아가는 카세트 테이프 한 개',
  defaultShape: 'wave-dual',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    const bg = ctx.createRadialGradient(w / 2, h * 0.4, u * 0.1, w / 2, h * 0.4, Math.hypot(w, h) * 0.65)
    bg.addColorStop(0, '#24323a'); bg.addColorStop(1, '#0c1115')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    const circ = isCircular(f.shape)
    // 본체 (비율 1.6 : 1)
    const bw = tall ? w * 0.88 : Math.min(w * 0.66, h * 0.62 * 1.6)
    const bh = bw / 1.6
    const bx = (w - bw) / 2
    const by = tall ? h * 0.07 : h * 0.07
    if (circ) drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, { bar: { x: 0, y: 0, w: 0, h: 0 }, ring: squareAt(w / 2, by + bh / 2, bh * 1.1) })
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#d9d2c1'
    roundRectPath(ctx, bx, by, bw, bh, bw * 0.03); ctx.fill()
    ctx.restore()
    // 나사
    ctx.fillStyle = '#8d8778'
    for (const [sx, sy] of [[0.04, 0.06], [0.96, 0.06], [0.04, 0.94], [0.96, 0.94]]) {
      ctx.beginPath(); ctx.arc(bx + bw * sx, by + bh * sy, bw * 0.01, 0, Math.PI * 2); ctx.fill()
    }
    // 라벨
    const lx = bx + bw * 0.07, ly = by + bh * 0.07, lw = bw * 0.86, lh = bh * 0.46
    ctx.fillStyle = '#f7f2e6'
    roundRectPath(ctx, lx, ly, lw, lh, bw * 0.015); ctx.fill()
    ctx.fillStyle = paletteGrad(ctx, f, lx, 0, lx + lw, 0)
    ctx.fillRect(lx, ly + lh * 0.08, lw, lh * 0.1)
    ctx.fillRect(lx, ly + lh * 0.2, lw, lh * 0.04)
    fitText(ctx, f.trackTitle, lx + lw / 2, ly + lh * 0.52, lw * 0.9, bw * 0.065, { weight: 800, color: '#2a2622', align: 'center', baseline: 'middle', minSize: 10 })
    fitText(ctx, trackNo(f), lx + lw * 0.05, ly + lh * 0.88, lw * 0.4, bw * 0.032, { weight: 700, color: '#6c665b', baseline: 'middle' })
    fitText(ctx, f.headline, lx + lw * 0.95, ly + lh * 0.88, lw * 0.5, bw * 0.03, { weight: 500, color: '#6c665b', align: 'right', baseline: 'middle' })
    // 릴 창
    const wx = bx + bw * 0.2, wy = by + bh * 0.55, ww = bw * 0.6, wh = bh * 0.3
    ctx.fillStyle = '#17120f'
    roundRectPath(ctx, wx, wy, ww, wh, wh / 2); ctx.fill()
    const p = progressOf(f)
    const rMax = wh * 0.48, rMin = wh * 0.24
    const reels: [number, number][] = [[wx + ww * 0.24, rMin + (rMax - rMin) * (1 - p)], [wx + ww * 0.76, rMin + (rMax - rMin) * p]]
    const ang = f.t * 2.6
    for (const [rx, tr] of reels) {
      const ry = wy + wh / 2
      ctx.fillStyle = '#4a3425'
      ctx.beginPath(); ctx.arc(rx, ry, tr, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#e8e3d6'
      ctx.beginPath(); ctx.arc(rx, ry, rMin * 0.8, 0, Math.PI * 2); ctx.fill()
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(ang)
      ctx.fillStyle = '#17120f'
      for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.fillRect(rMin * 0.38, -rMin * 0.09, rMin * 0.34, rMin * 0.18) }
      ctx.restore()
    }
    // 하단 사다리꼴
    ctx.fillStyle = '#b9b19c'
    ctx.beginPath()
    ctx.moveTo(bx + bw * 0.16, by + bh); ctx.lineTo(bx + bw * 0.22, by + bh * 0.88)
    ctx.lineTo(bx + bw * 0.78, by + bh * 0.88); ctx.lineTo(bx + bw * 0.84, by + bh)
    ctx.closePath(); ctx.fill()
    // 가사·스펙트럼
    const below = by + bh
    const lyC = below + (h - below) * 0.34
    lyricSlot(ctx, f, { cx: w / 2, cy: lyC, maxW: w * 0.86, size: u * (tall ? 0.05 : 0.044), around: 1, accent: f.palette.accent, titleInst: false })
    const vy = h * 0.88
    if (!circ) drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: w * 0.12, y: vy, w: w * 0.76, h: h * 0.1 },
      ring: squareAt(w / 2, vy + h * 0.05, h * 0.12),
    })
  },
}
