import type { CinemaTemplate } from '../types'
import { drawCover, fitText, hash, roundRectPath } from '../helpers'
import { drawViz, isCircular } from '../viz'
import { fitRing, ringSpot, lyricSlot, rng, squareAt, trackNo, unit } from './_kit'

export const corkboard: CinemaTemplate = {
  id: 'corkboard',
  name: '코르크보드',
  blurb: '핀으로 꽂은 사진과 메모지',
  defaultShape: 'radial-dots',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    ctx.fillStyle = '#b98a55'; ctx.fillRect(0, 0, w, h)
    // 코르크 알갱이(결정적)
    const r = rng(hash('cork'))
    const dots = [['rgba(110,70,35,0.35)', 0], ['rgba(225,185,130,0.35)', 1]] as const
    for (const [col] of dots) {
      ctx.fillStyle = col
      ctx.beginPath()
      for (let i = 0; i < 380; i++) { const x = r() * w, y = r() * h, s = (0.4 + r()) * u * 0.004; ctx.rect(x, y, s * 2, s * 1.5) }
      ctx.fill()
    }
    // 나무틀
    const fw = u * 0.025
    ctx.strokeStyle = '#5b3a1f'; ctx.lineWidth = fw * 2
    ctx.strokeRect(0, 0, w, h)
    const circ = isCircular(f.shape)
    // 사진
    const ps = tall ? w * 0.62 : Math.min(h * 0.5, w * 0.3)
    const pcx = tall ? w * 0.46 : w * 0.28
    const pcy = tall ? h * 0.25 : h * 0.43
    if (circ) {
      const ring = fitRing(f, pcx, pcy, ps * 1.15)
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip()
      ringSpot(ctx, ring, 'rgba(36,24,14,0.78)', 1.4)
      drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, { bar: { x: 0, y: 0, w: 0, h: 0 }, ring })
      ctx.restore()
    }
    ctx.save()
    ctx.translate(pcx, pcy); ctx.rotate(-0.06)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = u * 0.03; ctx.shadowOffsetY = u * 0.012
    ctx.fillStyle = '#fbfaf6'
    ctx.fillRect(-ps / 2 - ps * 0.05, -ps / 2 - ps * 0.05, ps * 1.1, ps * 1.28)
    ctx.shadowColor = 'transparent'
    drawCover(ctx, f, { x: -ps / 2, y: -ps / 2, w: ps, h: ps })
    // 테이프 조각
    ctx.fillStyle = 'rgba(240,230,170,0.7)'
    ctx.save(); ctx.translate(-ps * 0.5, -ps * 0.52); ctx.rotate(-0.6); ctx.fillRect(-ps * 0.12, -ps * 0.03, ps * 0.24, ps * 0.06); ctx.restore()
    ctx.save(); ctx.translate(ps * 0.5, -ps * 0.52); ctx.rotate(0.6); ctx.fillRect(-ps * 0.12, -ps * 0.03, ps * 0.24, ps * 0.06); ctx.restore()
    fitText(ctx, f.trackTitle, 0, ps * 0.6, ps, ps * 0.07, { weight: 700, color: '#3a2f25', align: 'center', baseline: 'middle', minSize: 9 })
    ctx.restore()
    // 노란 메모지(번호·제목)
    const nx = tall ? w * 0.08 : w * 0.52, ny = tall ? h * 0.52 : h * 0.09
    const nw = tall ? w * 0.84 : w * 0.4, nh = tall ? h * 0.12 : h * 0.2
    note(ctx, nx, ny, nw, nh, '#f7e27a', 0.03, u)
    fitText(ctx, trackNo(f), nx + nw * 0.06, ny + nh * 0.3, nw * 0.5, u * 0.03, { weight: 700, color: '#8a5a1a', baseline: 'middle' })
    fitText(ctx, f.trackTitle, nx + nw * 0.06, ny + nh * 0.64, nw * 0.88, u * 0.056, { weight: 800, color: '#2c2417', baseline: 'middle', minSize: 11 })
    // 분홍 메모지(가사)
    const gx = tall ? w * 0.1 : w * 0.54, gy = tall ? h * 0.67 : h * 0.34
    const gw = tall ? w * 0.8 : w * 0.38, gh = tall ? h * 0.15 : h * 0.34
    note(ctx, gx, gy, gw, gh, '#f4b6c2', -0.025, u)
    ctx.save()
    ctx.translate(gx + gw / 2, gy + gh / 2); ctx.rotate(-0.025); ctx.translate(-(gx + gw / 2), -(gy + gh / 2))
    lyricSlot(ctx, f, { cx: gx + gw / 2, cy: gy + gh / 2, maxW: gw * 0.88, size: u * 0.04, around: 1, color: '#4a2a33', accent: '#1d0f14', titleInst: true, titleColor: '#4a2a33' })
    ctx.restore()
    // 스펙트럼 띠(검정 라벨)
    const vy = tall ? h * 0.86 : h * 0.8
    const vh = tall ? h * 0.09 : h * 0.12
    if (!circ) {
    ctx.fillStyle = 'rgba(25,18,12,0.82)'
    roundRectPath(ctx, w * 0.08, vy, w * 0.84, vh, u * 0.015); ctx.fill()
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: w * 0.1, y: vy + vh * 0.1, w: w * 0.8, h: vh * 0.8 },
      ring: squareAt(w / 2, vy + vh / 2, vh * 0.9),
    })
    }
  },
}

/** 핀 꽂은 메모지 */
function note(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, rot: number, u: number) {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot)
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = u * 0.02; ctx.shadowOffsetY = u * 0.008
  ctx.fillStyle = color
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#c0392b'
  ctx.beginPath(); ctx.arc(0, -h / 2 + u * 0.015, u * 0.011, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath(); ctx.arc(-u * 0.004, -h / 2 + u * 0.011, u * 0.003, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
