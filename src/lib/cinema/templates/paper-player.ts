import type { CinemaTemplate } from '../types'
import { drawCover, fitText, hash, mmss, roundRectPath } from '../helpers'
import { drawViz, isCircular } from '../viz'
import { ringSpot, lyricSlot, progressBar, rng, squareAt, trackNo, unit } from './_kit'

const INK = '#2a2622'

export const paperPlayer: CinemaTemplate = {
  id: 'paper-player',
  name: '페이퍼 플레이어',
  blurb: '크림색 종이 카드 위에 담은 음악 앱',
  defaultShape: 'bars-reflect',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    // 책상 바탕 + 종이 알갱이
    ctx.fillStyle = '#cfc6b3'; ctx.fillRect(0, 0, w, h)
    const r = rng(hash('paper'))
    ctx.fillStyle = 'rgba(90,70,40,0.10)'
    for (let i = 0; i < 260; i++) ctx.fillRect(r() * w, r() * h, Math.max(1, u * 0.002), Math.max(1, u * 0.002))
    // 카드
    const cw = tall ? w * 0.88 : Math.min(w * 0.84, h * 1.45)
    const ch = tall ? h * 0.9 : h * 0.84
    const cx0 = (w - cw) / 2, cy0 = (h - ch) / 2
    ctx.save()
    ctx.shadowColor = 'rgba(40,28,10,0.35)'; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#f6efe0'
    roundRectPath(ctx, cx0, cy0, cw, ch, u * 0.025); ctx.fill()
    ctx.restore()
    const pad = u * 0.045
    // 표지·글 영역
    const cov = tall ? cw - pad * 2 : Math.min(ch - pad * 2 - ch * 0.2, cw * 0.4)
    const covBox = tall
      ? { x: cx0 + pad, y: cy0 + pad, w: cov, h: Math.min(cov, ch * 0.4) }
      : { x: cx0 + pad, y: cy0 + pad, w: cov, h: cov }
    const circ = isCircular(f.shape)
    if (circ) {
      const ring = squareAt(covBox.x + covBox.w / 2, covBox.y + covBox.h / 2, Math.max(covBox.w, covBox.h) * 0.86)
      ctx.save()
      roundRectPath(ctx, cx0, cy0, cw, ch, u * 0.025); ctx.clip()
      ringSpot(ctx, ring, 'rgba(31,27,23,0.94)', 1.36)
      drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, { bar: { x: 0, y: 0, w: 0, h: 0 }, ring })
      ctx.restore()
    }
    drawCover(ctx, f, covBox, u * 0.012)
    const tx = tall ? cx0 + pad : covBox.x + cov + pad
    const tw = tall ? cw - pad * 2 : cx0 + cw - pad - tx
    const ty = tall ? covBox.y + covBox.h + pad * 0.9 : cy0 + pad
    fitText(ctx, f.headline, tx, ty + u * 0.02, tw, u * 0.026, { weight: 600, color: 'rgba(42,38,34,0.55)', baseline: 'middle' })
    fitText(ctx, f.trackTitle, tx, ty + u * 0.09, tw, u * 0.06, { weight: 800, color: INK, baseline: 'middle', minSize: 12 })
    ctx.fillStyle = f.palette.accent
    ctx.fillRect(tx, ty + u * 0.14, u * 0.09, Math.max(3, u * 0.007))
    fitText(ctx, trackNo(f), tx, ty + u * 0.18, tw, u * 0.026, { weight: 700, color: 'rgba(42,38,34,0.6)', baseline: 'middle' })
    // 가사(종이 위 먹색)
    const ly0 = ty + u * 0.22
    const lyH = tall ? ch * 0.17 : covBox.y + cov - ly0
    lyricSlot(ctx, f, { cx: tx, cy: ly0 + Math.max(lyH, u * 0.12) / 2, maxW: tw, size: u * (tall ? 0.04 : 0.036), around: 1, align: 'left', color: INK, accent: '#000', titleInst: false })
    // 진행바 + 시간
    const by = tall ? cy0 + ch * 0.74 : covBox.y + cov + pad * 0.5
    const bx = cx0 + pad, bw = cw - pad * 2
    progressBar(ctx, f, { x: bx, y: by, w: bw, h: Math.max(4, u * 0.008) }, 'rgba(42,38,34,0.16)')
    fitText(ctx, mmss(f.t), bx, by + u * 0.035, bw / 2, u * 0.022, { weight: 600, color: 'rgba(42,38,34,0.6)', baseline: 'middle' })
    fitText(ctx, mmss(f.duration), bx + bw, by + u * 0.035, bw / 2, u * 0.022, { weight: 600, color: 'rgba(42,38,34,0.6)', align: 'right', baseline: 'middle' })
    // 어두운 디스플레이 띠(스펙트럼)
    const dy = by + u * 0.065
    const dh = cy0 + ch - pad * 0.8 - dy
    if (dh > u * 0.05 && !circ) {
      ctx.fillStyle = '#1f1b17'
      roundRectPath(ctx, bx, dy, bw, dh, u * 0.015); ctx.fill()
      drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
        bar: { x: bx + bw * 0.03, y: dy + dh * 0.1, w: bw * 0.94, h: dh * 0.8 },
        ring: squareAt(bx + bw / 2, dy + dh / 2, dh * 0.92),
      })
    }
  },
}
