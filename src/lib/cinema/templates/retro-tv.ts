import type { CinemaTemplate } from '../types'
import { drawCover, drawLyricBlock, fitText, roundRectPath } from '../helpers'
import { drawViz } from '../viz'
import { isInst, squareAt, unit } from './_kit'

export const retroTv: CinemaTemplate = {
  id: 'retro-tv',
  name: '레트로 TV',
  blurb: '주사선이 흐르는 브라운관 속 커버',
  defaultShape: 'area-mirror',
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = h > w * 1.15
    // 방 벽
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#2c2420'); bg.addColorStop(0.8, '#1a1512'); bg.addColorStop(1, '#0e0b09')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
    // TV 본체
    const tw = tall ? w * 0.9 : Math.min(w * 0.86, h * 0.84 * 1.5)
    const th = tall ? h * 0.52 : h * 0.8
    const tx = (w - tw) / 2, ty = tall ? h * 0.08 : h * 0.07
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#6b4a30'
    roundRectPath(ctx, tx, ty, tw, th, u * 0.05); ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#7d583a'
    roundRectPath(ctx, tx + u * 0.01, ty + u * 0.01, tw - u * 0.02, th * 0.4, u * 0.04); ctx.fill()
    // 화면
    const pad = u * 0.04
    const sw = tall ? tw - pad * 2 : tw * 0.7
    const sh = tall ? th - pad * 2 - th * 0.2 : th - pad * 2
    const sx = tx + pad, sy = ty + pad
    ctx.fillStyle = '#050505'
    roundRectPath(ctx, sx - u * 0.01, sy - u * 0.01, sw + u * 0.02, sh + u * 0.02, u * 0.04); ctx.fill()
    ctx.save()
    roundRectPath(ctx, sx, sy, sw, sh, u * 0.035); ctx.clip()
    drawCover(ctx, f, { x: sx, y: sy, w: sw, h: sh })
    // 주사선
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    const step = Math.max(3, Math.round(u * 0.006))
    const roll = (f.t * u * 0.05) % step
    for (let yy = sy + roll; yy < sy + sh; yy += step) ctx.fillRect(sx, yy, sw, Math.max(1, step / 3))
    // 곡면 비네트
    const vg = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, Math.min(sw, sh) * 0.3, sx + sw / 2, sy + sh / 2, Math.hypot(sw, sh) * 0.55)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = vg; ctx.fillRect(sx, sy, sw, sh)
    // 반사광
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.5, sy); ctx.lineTo(sx, sy + sh * 0.45); ctx.closePath(); ctx.fill()
    // 화면 안 채널 표시
    const ch = `채널 ${String(f.trackIndex + 1).padStart(2, '0')}`
    fitText(ctx, ch, sx + sw * 0.05, sy + sh * 0.09, sw * 0.4, u * 0.04, { weight: 800, color: '#7dff9a', baseline: 'middle' })
    // 하단 스펙트럼 + 자막 띠
    const bandH = sh * 0.17
    drawViz(ctx, f.shape, f.palette, f.bars, f.level, f.t, {
      bar: { x: sx + sw * 0.06, y: sy + sh * 0.56, w: sw * 0.88, h: sh * 0.2 },
      ring: squareAt(sx + sw / 2, sy + sh * 0.5, sh * 0.5),
    })
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(sx, sy + sh - bandH - sh * 0.02, sw, bandH)
    const bandY = sy + sh - bandH / 2 - sh * 0.02
    if (isInst(f)) {
      fitText(ctx, f.trackTitle, sx + sw / 2, bandY, sw * 0.9, bandH * 0.5, { weight: 800, align: 'center', baseline: 'middle', minSize: 10 })
    } else {
      drawLyricBlock(ctx, f, { cx: sx + sw / 2, cy: bandY, maxW: sw * 0.92, size: Math.min(bandH * 0.48, u * 0.04), around: 0, accent: '#fff' })
    }
    ctx.restore()
    // 조작부
    if (tall) {
      const py = sy + sh + pad * 0.6, ph = ty + th - pad * 0.5 - py
      fitText(ctx, ch, tx + pad, py + ph * 0.5, tw * 0.3, u * 0.045, { weight: 800, color: '#f0d9b0', baseline: 'middle' })
      knob(ctx, tx + tw * 0.62, py + ph / 2, ph * 0.3, f.t)
      knob(ctx, tx + tw * 0.82, py + ph / 2, ph * 0.3, -f.t * 0.5)
      fitText(ctx, f.trackTitle, tx + tw / 2, ty + th + h * 0.04, tw * 0.9, u * 0.05, { weight: 800, align: 'center', baseline: 'middle', minSize: 12 })
    } else {
      const px = sx + sw + pad, pw = tx + tw - pad - px
      ctx.fillStyle = '#3a281a'
      roundRectPath(ctx, px, sy, pw, sh, u * 0.02); ctx.fill()
      fitText(ctx, ch, px + pw / 2, sy + sh * 0.1, pw * 0.86, u * 0.05, { weight: 800, color: '#f0d9b0', align: 'center', baseline: 'middle' })
      knob(ctx, px + pw / 2, sy + sh * 0.3, pw * 0.26, f.t)
      knob(ctx, px + pw / 2, sy + sh * 0.5, pw * 0.2, -f.t * 0.5)
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(2, u * 0.004)
      for (let k = 0; k < 7; k++) { const gy = sy + sh * (0.66 + k * 0.045); ctx.beginPath(); ctx.moveTo(px + pw * 0.12, gy); ctx.lineTo(px + pw * 0.88, gy); ctx.stroke() }
      fitText(ctx, f.trackTitle, w / 2, ty + th + (h - ty - th) / 2, w * 0.8, u * 0.045, { weight: 700, color: 'rgba(255,255,255,0.8)', align: 'center', baseline: 'middle', minSize: 10 })
    }
    // 다리
    ctx.fillStyle = '#2a1d13'
    ctx.fillRect(tx + tw * 0.12, ty + th, tw * 0.05, h * 0.02); ctx.fillRect(tx + tw * 0.83, ty + th, tw * 0.05, h * 0.02)
    // 세로형: 화면 아래 빈 공간에 큰 번호
    if (tall) fitText(ctx, f.headline, w / 2, h * 0.75, w * 0.8, u * 0.04, { weight: 600, color: 'rgba(255,255,255,0.45)', align: 'center', baseline: 'middle' })
  },
}

function knob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save()
  ctx.fillStyle = '#c9b38a'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.translate(x, y); ctx.rotate(t * 0.3)
  ctx.fillStyle = '#2a1d13'
  ctx.fillRect(-r * 0.06, -r * 0.9, r * 0.12, r * 0.5)
  ctx.restore()
}
