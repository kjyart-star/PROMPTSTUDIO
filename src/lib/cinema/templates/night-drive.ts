import type { CinemaTemplate } from '../types'
import { drawCover, fitText, mmss } from '../helpers'
import { isInst, isTall, rng, unit } from './_kit'
import { LATIN, SANS, SERIF, coverTones, drawPlate, fallbackBackdrop, grain, hairline, rgba, scrim, serifLyrics, shadowText, softViz, trackNoLatin, vignette, tf, coverEl } from './_scene'

/** 새벽 도시를 달리는 차 뒷좌석 창밖. 천천히 흘러가는 거리, 스쳐 가는 불빛, 시네마 비율 띠 */
export const nightDrive: CinemaTemplate = {
  id: 'night-drive',
  name: '새벽 드라이브',
  blurb: '차창 밖으로 흘러가는 도시 불빛, 영화 자막처럼 가사',
  defaultShape: 'area-soft',
  assets: ['night-drive'],
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    // 차체 흔들림(아주 작게) + 천천히 좌우로 흐르는 시선
    const jy = (Math.sin(f.t * 9.1) * 0.6 + Math.sin(f.t * 13.7) * 0.4) * u * 0.0016
    const pan = 0.5 + 0.42 * Math.sin((f.t / 70) * Math.PI * 2)
    ctx.save()
    ctx.translate(0, jy)
    const plate = drawPlate(ctx, f, 'night-drive', { panX: pan, fy: 0.5, zoom: 1.03 })
    if (!plate) fallbackBackdrop(ctx, f, tn)
    ctx.restore()

    // 스쳐 지나가는 가로등 빛줄기
    const r = rng(19)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 7; i++) {
      const period = 2.2 + r() * 4.5, off = r() * period, y = h * (0.18 + r() * 0.5), warm = r() > 0.35
      const k = ((f.t + off) % period) / period
      const x = w * (1.3 - k * 1.9)
      const len = w * (0.18 + r() * 0.3), th = u * (0.0025 + r() * 0.005)
      const c = warm ? '255,196,130' : '160,205,255'
      const g = ctx.createLinearGradient(x, 0, x + len, 0)
      g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.35, `rgba(${c},0.55)`); g.addColorStop(1, `rgba(${c},0)`)
      ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = th
      ctx.shadowColor = `rgba(${c},0.8)`; ctx.shadowBlur = th * 6
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke()
    }
    ctx.restore()
    vignette(ctx, f, 0.5, tn.deep)

    const ink = tn.ink
    const bar = tall ? 0 : Math.max(0, (h - w / 2.39) / 2)
    if (bar > 0) {
      ctx.fillStyle = rgba(tn.deep, 1)
      ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar)
    } else {
      scrim(ctx, f, h * 0.62, h, tn.deep, 0.92)
    }
    const lowY = tall ? h * 0.86 : h - bar / 2
    const thumb = tall ? u * 0.2 : Math.min(bar * 0.62, u * 0.11)
    const lx = u * 0.06
    softViz(ctx, f,
      tall ? { x: w * 0.1, y: h * 0.47, w: w * 0.8, h: u * 0.1 } : { x: w * 0.6, y: h - bar - u * 0.075, w: w * 0.34, h: u * 0.06 },
      { x: lx - thumb * 0.06, y: lowY - thumb * 0.56, w: thumb * 1.12, h: thumb * 1.12 }, 0.5)

    // 하단: 작은 커버 + 곡 정보 + 진행
    if (tall) {
      const cy = h * 0.74
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = u * 0.05
      coverEl(ctx, { x: w / 2 - thumb / 2, y: cy - thumb, w: thumb, h: thumb }, () => drawCover(ctx, f, { x: w / 2 - thumb / 2, y: cy - thumb, w: thumb, h: thumb }, u * 0.01))
      ctx.restore()
      shadowText(ctx, trackNoLatin(f), w / 2, cy + u * 0.07, w * 0.8, u * 0.045, { font: LATIN, color: rgba(tn.glow), align: 'center', baseline: 'middle' })
      shadowText(ctx, f.trackTitle, w / 2, cy + u * 0.14, w * 0.86, u * 0.068, { font: tf(f, SERIF), weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
      hairline(ctx, f, w * 0.2, cy + u * 0.22, w * 0.6, ink)
      fitText(ctx, mmss(f.t), w * 0.2, cy + u * 0.26, w * 0.3, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.65), baseline: 'middle' })
      fitText(ctx, mmss(f.duration), w * 0.8, cy + u * 0.26, w * 0.3, u * 0.026, { font: SANS, weight: 300, color: rgba(ink, 0.65), align: 'right', baseline: 'middle' })
      if (!isInst(f)) serifLyrics(ctx, f, { cx: w / 2, cy: h * 0.33, maxW: w * 0.88, size: u * 0.05, ink, font: SANS, weight: 400, around: 0 })
      if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.06, w * 0.8, u * 0.028, { font: SANS, weight: 300, color: rgba(ink, 0.65), align: 'center', baseline: 'middle' })
    } else {
      const bh = Math.max(bar, u * 0.16)
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = u * 0.03
      coverEl(ctx, { x: lx, y: lowY - thumb / 2, w: thumb, h: thumb }, () => drawCover(ctx, f, { x: lx, y: lowY - thumb / 2, w: thumb, h: thumb }, u * 0.006))
      ctx.restore()
      const tx = lx + thumb + u * 0.035
      fitText(ctx, f.trackTitle, tx, lowY, w * 0.42, Math.min(u * 0.05, bh * 0.34), { font: tf(f, SERIF), weight: 300, color: rgba(ink), baseline: 'middle', minSize: 10 })
      const rx = w * 0.62, rw = w - lx - rx
      hairline(ctx, f, rx, lowY, rw, ink)
      fitText(ctx, `${trackNoLatin(f)}     ${mmss(f.t)}  /  ${mmss(f.duration)}`, w - lx, lowY - Math.min(u * 0.035, bh * 0.25), rw, Math.min(u * 0.024, bh * 0.18), { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'right', baseline: 'middle' })
      if (f.headline) fitText(ctx, f.headline, w / 2, Math.max(bar / 2, u * 0.05), w * 0.7, Math.min(u * 0.026, Math.max(10, bar * 0.3)), { font: SANS, weight: 300, color: rgba(ink, 0.55), align: 'center', baseline: 'middle' })
      // 영화 자막 자리
      if (!isInst(f)) serifLyrics(ctx, f, { cx: w / 2, cy: h - bar - u * 0.09, maxW: w * 0.8, size: u * 0.044, ink, font: SANS, weight: 400, around: 0 })
    }
    grain(ctx, f, 0.09)
  },
}
