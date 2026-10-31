import type { CinemaTemplate } from '../types'
import { drawCover, fitText, progressOf } from '../helpers'
import { drawViz } from '../viz'
import { hash } from '../helpers'
import { fitRing, lyricSlot, rng, squareAt, trackNo, unit } from './_kit'

export const vinylLounge: CinemaTemplate = {
  id: 'vinyl-lounge',
  name: '바이닐 라운지',
  blurb: '나무 책상 위에서 돌아가는 LP',
  defaultShape: 'ring-line',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    // 나무 바탕
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#4a2f1b'); bg.addColorStop(1, '#2a180e')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    const r = rng(hash('wood'))
    ctx.lineWidth = Math.max(1, u * 0.0015)
    for (let i = 0; i < 46; i++) {
      const x = r() * w
      ctx.strokeStyle = `rgba(${r() > 0.5 ? '20,10,4' : '120,80,45'},${0.08 + r() * 0.12})`
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + (r() - 0.5) * u * 0.06, h * 0.33, x + (r() - 0.5) * u * 0.06, h * 0.66, x + (r() - 0.5) * u * 0.03, h); ctx.stroke()
    }
    const R = tall ? w * 0.38 : Math.min(h * 0.38, w * 0.24)
    const cx = tall ? w / 2 : w * 0.3
    const cy = tall ? h * 0.3 : h * 0.5
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: tall ? { x: w * 0.1, y: h * 0.9, w: w * 0.8, h: h * 0.07 } : { x: w * 0.56, y: h * 0.8, w: w * 0.38, h: h * 0.12 },
      ring: fitRing(f, cx, cy, R * 2.45),
    })
    // LP 그림자 + 판
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.015
    ctx.fillStyle = '#0b0b0d'
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
    for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * (0.4 + k * 0.065), 0, Math.PI * 2); ctx.stroke() }
    const ang = f.t * 3.4
    // 회전하는 빛 반사 두 쐐기
    ctx.save()
    ctx.translate(cx, cy); ctx.rotate(ang)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    for (let q = 0; q < 2; q++) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 0.98, q * Math.PI - 0.3, q * Math.PI + 0.3); ctx.closePath(); ctx.fill()
    }
    // 레이블(커버 원형, 같이 회전)
    const lr = R * 0.36
    ctx.beginPath(); ctx.arc(0, 0, lr, 0, Math.PI * 2); ctx.clip()
    drawCover(ctx, f, { x: -lr, y: -lr, w: lr * 2, h: lr * 2 })
    ctx.restore()
    ctx.fillStyle = '#15110d'
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.035, 0, Math.PI * 2); ctx.fill()
    // 톤암: 오른쪽 위 축에서 판 위로, 진행도에 따라 안쪽으로
    const pivX = cx + R * 1.12, pivY = cy - R * 0.85
    const p = progressOf(f)
    const tipAng = Math.atan2(R * 0.9 - R * 0.0, -R * 0.55)
    const a = tipAng + 0.0 - p * 0.18
    const len = R * 1.18
    const tx = pivX + Math.cos(a) * len, ty = pivY + Math.sin(a) * len
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#cfc8b8'; ctx.lineWidth = Math.max(3, R * 0.04)
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(tx, ty); ctx.stroke()
    ctx.fillStyle = '#e9e2d0'
    ctx.beginPath(); ctx.arc(pivX, pivY, R * 0.09, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a2622'
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a)
    ctx.fillRect(-R * 0.02, -R * 0.045, R * 0.14, R * 0.09)
    ctx.restore()
    ctx.restore()
    // 가사·제목
    const lx = tall ? w / 2 : w * 0.72
    const ly = tall ? h * 0.7 : h * 0.44
    const lw = tall ? w * 0.84 : w * 0.4
    const top = tall ? h * 0.6 : h * 0.16
    fitText(ctx, trackNo(f), lx, top, lw, u * 0.03, { weight: 700, color: f.palette.accent, align: 'center', baseline: 'middle' })
    fitText(ctx, f.trackTitle, lx, top + u * 0.06, lw, u * 0.052, { weight: 800, color: '#f3e7d3', align: 'center', baseline: 'middle', minSize: 12 })
    lyricSlot(ctx, f, { cx: lx, cy: ly + u * 0.06, maxW: lw, size: u * 0.046, around: 1, color: '#f3e7d3', accent: f.palette.accent })
  },
}
