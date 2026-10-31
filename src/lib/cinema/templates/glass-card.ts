import type { CinemaTemplate } from '../types'
import { drawEstimatedBadge, fitText, mmss } from '../helpers'
import { isInst, isTall, unit } from './_kit'
import { LATIN, SANS, SERIF, coverBlur, coverTones, glassPanel, grain, hairline, ofCount, perspectiveCover, rgba, serifLyrics, softViz, vignette, tf } from './_scene'

/** 커버 색으로 물든 공간에 비스듬히 선 3D 커버와 반투명 유리 카드 */
export const glassCard: CinemaTemplate = {
  id: 'glass-card',
  name: '글래스 커버',
  blurb: '천천히 도는 입체 커버와 반투명 유리 카드',
  defaultShape: 'ring-line',
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)

    // 배경: 크게 흐린 커버가 아주 느리게 떠다닌다
    ctx.fillStyle = rgba(tn.deep); ctx.fillRect(0, 0, w, h)
    const bl = coverBlur(f, w, h, 0.09)
    if (bl) {
      const z = 1.25, dx = Math.sin(f.t / 23) * w * 0.05, dy = Math.cos(f.t / 29) * h * 0.04
      ctx.globalAlpha = 0.85
      ctx.drawImage(bl as CanvasImageSource, (w - w * z) / 2 + dx, (h - h * z) / 2 + dy, w * z, h * z)
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = rgba(tn.deep, 0.5); ctx.fillRect(0, 0, w, h)

    const size = tall ? Math.min(w * 0.62, h * 0.32) : Math.min(h * 0.5, w * 0.3)
    const cx = tall ? w / 2 : w * 0.3
    const cy = tall ? h * 0.3 : h * 0.47
    const floorY = cy + size / 2
    // 바닥면: 커버 아래부터 살짝 밝았다 어두워지는 면
    const fg = ctx.createLinearGradient(0, floorY, 0, h)
    fg.addColorStop(0, rgba(tn.mid, 0.35)); fg.addColorStop(0.08, rgba(tn.deep, 0.75)); fg.addColorStop(1, rgba(tn.deep, 0.95))
    ctx.fillStyle = fg; ctx.fillRect(0, floorY, w, h - floorY)
    // 키 라이트(커버 뒤 위쪽)
    const kl = ctx.createRadialGradient(cx, cy - size * 0.3, 0, cx, cy - size * 0.3, size * 1.3)
    kl.addColorStop(0, rgba(tn.glow, 0.16)); kl.addColorStop(1, rgba(tn.glow, 0))
    ctx.fillStyle = kl; ctx.fillRect(0, 0, w, h)

    softViz(ctx, f, tall ? { x: w * 0.12, y: floorY + size * 0.42, w: w * 0.76, h: u * 0.06 } : { x: cx - size * 0.7, y: floorY + size * 0.4, w: size * 1.4, h: u * 0.06 },
      { x: cx - size * 0.62, y: cy - size * 0.62, w: size * 1.24, h: size * 1.24 }, 0.5)

    // 3D 커버(천천히 좌우로 돈다) + 바닥 반사 + 접지 그림자
    const ang = (tall ? 0 : 0.3) + 0.16 * Math.sin((f.t / 16) * Math.PI * 2)
    const sh = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, size * 0.6)
    sh.addColorStop(0, 'rgba(4,4,6,0.55)'); sh.addColorStop(1, 'rgba(4,4,6,0)')
    ctx.save(); ctx.translate(cx, floorY); ctx.scale(1, 0.12); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    const cb = perspectiveCover(ctx, f, cx, cy, size, ang, { reflect: 0.22, fade: tn.deep })
    // 표면 광택이 천천히 지나간다
    ctx.save()
    ctx.beginPath(); cb.quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip()
    const k = ((f.t / 9) % 1) * 2.4 - 0.7
    const sx = cb.x + cb.w * k
    const sg = ctx.createLinearGradient(sx - size * 0.3, cb.y, sx + size * 0.3, cb.y + cb.h)
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.14)'); sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg; ctx.fillRect(cb.x, cb.y, cb.w, cb.h)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()

    // 유리 카드
    const ink = tn.ink
    const card = tall
      ? { x: w * 0.07, y: h * 0.6, w: w * 0.86, h: h * 0.33 }
      : { x: w * 0.53, y: h * 0.18, w: w * 0.4, h: h * 0.64 }
    glassPanel(ctx, f, card, u * 0.028, tn)
    const pad = u * 0.05
    const tx = card.x + pad, tw = card.w - pad * 2
    const inst = isInst(f)
    fitText(ctx, ofCount(f), tx, card.y + pad + u * 0.01, tw, u * 0.04, { font: LATIN, color: rgba(tn.glow), baseline: 'middle' })
    fitText(ctx, f.trackTitle, tx, card.y + pad + u * 0.09, tw, u * (inst ? 0.08 : 0.06), { font: tf(f, SERIF), weight: 500, color: rgba(ink), baseline: 'middle', minSize: 12 })
    if (f.headline) fitText(ctx, f.headline, tx, card.y + pad + u * 0.15, tw, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.6), baseline: 'middle' })
    if (!inst) {
      ctx.save()
      ctx.beginPath(); ctx.rect(card.x, card.y + pad + u * 0.19, card.w, card.h - pad * 2 - u * 0.26); ctx.clip()
      serifLyrics(ctx, f, { cx: tx, cy: card.y + card.h * (tall ? 0.6 : 0.56), maxW: tw, size: u * 0.042, align: 'left', ink, shadow: false, font: SANS, weight: 400 })
      ctx.restore()
      if (f.lyricsEstimated) drawEstimatedBadge(ctx, f)
    }
    const by = card.y + card.h - pad
    hairline(ctx, f, tx, by - u * 0.035, tw, ink)
    fitText(ctx, mmss(f.t), tx, by, tw / 2, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), baseline: 'middle' })
    fitText(ctx, mmss(f.duration), tx + tw, by, tw / 2, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'right', baseline: 'middle' })
    vignette(ctx, f, 0.45, tn.deep)
    grain(ctx, f, 0.06)
  },
}
