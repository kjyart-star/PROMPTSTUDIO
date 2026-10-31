import type { CinemaTemplate } from '../types'
import { drawCover, fitText, mmss, pad2 } from '../helpers'
import { isInst, isTall, unit } from './_kit'
import { LATIN, SANS, coverTones, grain, rgba, serifLyrics, softViz, tf } from './_scene'

/** 커버 색 한 면 위에 큰 곡 번호와 단정한 글자 격자. 포스터처럼 정돈된 화면 */
export const typeGrid: CinemaTemplate = {
  id: 'type-grid',
  name: '타이포 그리드',
  blurb: '커버 색 한 면, 큰 곡 번호와 정돈된 글자 격자',
  defaultShape: 'dots',
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    const base: [number, number, number] = [tn.deep[0] * 0.6 + tn.mid[0] * 0.4, tn.deep[1] * 0.6 + tn.mid[1] * 0.4, tn.deep[2] * 0.6 + tn.mid[2] * 0.4]
    ctx.fillStyle = rgba(base); ctx.fillRect(0, 0, w, h)
    const ink = tn.ink
    const m = u * 0.07
    // 12단 격자(아주 옅게)
    ctx.fillStyle = rgba(ink, 0.06)
    const cols = tall ? 6 : 12
    const cw = (w - m * 2) / cols
    for (let i = 0; i <= cols; i++) ctx.fillRect(Math.round(m + i * cw), m, 1, h - m * 2)
    ctx.fillRect(m, m, w - m * 2, 1); ctx.fillRect(m, h - m, w - m * 2, 1)

    const inst = isInst(f)
    const num = pad2(f.trackIndex + 1)
    if (!tall) {
      // 왼쪽 큰 번호, 오른쪽 위 커버, 오른쪽 아래 가사
      const side = Math.min(h * 0.42, cw * 4)
      const cx = m + cw * 8
      const z = 1 + 0.06 * (0.5 + 0.5 * Math.sin(f.t / 12))
      ctx.save(); ctx.beginPath(); ctx.rect(cx, m + u * 0.04, side, side); ctx.clip()
      drawCover(ctx, f, { x: cx - side * (z - 1) / 2, y: m + u * 0.04 - side * (z - 1) / 2, w: side * z, h: side * z })
      ctx.restore()
      fitText(ctx, num, m - u * 0.02, h - m - u * 0.02, cw * 7, h * 0.66, { font: LATIN, weight: 400, color: rgba(ink, 0.92), minSize: 20 })
      fitText(ctx, f.trackTitle, m, m + u * 0.08, cw * 7, u * (inst ? 0.09 : 0.075), { font: tf(f, SANS), weight: 600, color: rgba(ink), minSize: 12 })
      fitText(ctx, f.headline || `${pad2(f.trackIndex + 1)} / ${pad2(f.trackCount)}`, m, m + u * 0.14, cw * 6, u * 0.028, { font: SANS, weight: 300, color: rgba(ink, 0.6) })
      const ly = m + u * 0.04 + side + u * 0.1
      if (!inst) serifLyrics(ctx, f, { cx, cy: ly + u * 0.06, maxW: w - m - cx, size: u * 0.04, align: 'left', ink, accent: tn.glow, shadow: false, font: SANS, weight: 400 })
      softViz(ctx, f, { x: cx, y: h - m - u * 0.13, w: w - m - cx, h: u * 0.07 }, { x: cx + side * 0.15, y: m + u * 0.04 + side * 0.15, w: side * 0.7, h: side * 0.7 }, 0.75)
    } else {
      const side = cw * 4
      const cy = h * 0.22
      drawCover(ctx, f, { x: w - m - side, y: cy, w: side, h: side })
      fitText(ctx, num, m - u * 0.02, cy - u * 0.02, w * 0.9, h * 0.22, { font: LATIN, color: rgba(ink, 0.92), minSize: 20 })
      fitText(ctx, f.trackTitle, m, cy + side + u * 0.14, w - m * 2, u * 0.085, { font: tf(f, SANS), weight: 600, color: rgba(ink), minSize: 12 })
      fitText(ctx, f.headline || `${pad2(f.trackIndex + 1)} / ${pad2(f.trackCount)}`, m, cy + side + u * 0.21, w - m * 2, u * 0.032, { font: SANS, weight: 300, color: rgba(ink, 0.6) })
      if (!inst) serifLyrics(ctx, f, { cx: m, cy: cy + side + u * 0.38, maxW: w - m * 2, size: u * 0.048, align: 'left', ink, accent: tn.glow, shadow: false, font: SANS, weight: 400 })
      softViz(ctx, f, { x: m, y: h - m - u * 0.16, w: w - m * 2, h: u * 0.1 }, { x: w - m - side * 0.85, y: cy + side * 0.15, w: side * 0.7, h: side * 0.7 }, 0.75)
    }
    // 아래 진행 눈금(분 단위)
    const p = f.duration > 0 ? Math.min(1, f.t / f.duration) : 0
    const y = h - m
    ctx.fillStyle = rgba(ink, 0.9); ctx.fillRect(m, y - 1, (w - m * 2) * p, 3)
    const mins = Math.floor(f.duration / 60)
    for (let i = 1; i <= mins; i++) { const x = m + (w - m * 2) * ((i * 60) / f.duration); ctx.fillStyle = rgba(ink, 0.35); ctx.fillRect(x, y - u * 0.012, 1, u * 0.012) }
    fitText(ctx, `${mmss(f.t)} / ${mmss(f.duration)}`, w - m, y - u * 0.03, w * 0.4, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'right' })
    grain(ctx, f, 0.05)
  },
}
