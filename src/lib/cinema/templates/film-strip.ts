import type { CinemaTemplate } from '../types'
import { drawCover, fitText, mmss } from '../helpers'
import { isInst, isTall, unit } from './_kit'
import { LATIN, SANS, SERIF, coverTones, grain, hairline, rgba, roundRect, serifLyrics, softViz, trackNoLatin, vignette, tf, coverEl } from './_scene'

/** 어두운 방, 라이트박스 위를 천천히 지나가는 35mm 필름. 칸마다 커버가 조금씩 다른 노출로 찍혀 있다 */
export const filmStrip: CinemaTemplate = {
  id: 'film-strip',
  name: '필름 스트립',
  blurb: '라이트박스 위로 흐르는 35mm 필름과 칸마다 다른 노출',
  defaultShape: 'wave-line',
  fonts: true,
  draw(ctx, f) {
    const { w, h } = f
    const u = unit(f)
    const tall = isTall(f)
    const tn = coverTones(f)
    ctx.fillStyle = rgba(tn.deep); ctx.fillRect(0, 0, w, h)

    // 라이트박스(긴 쪽을 따라 필름이 흐른다). 로컬 좌표: 세로로 긴 상자
    const L = tall ? { x: 0, y: h * 0.06, w: w, h: h * 0.4 } : { x: w * 0.07, y: 0, w: w * 0.38, h: h }
    const boxLong = tall ? L.w : L.h, boxShort = tall ? L.h : L.w
    coverEl(ctx, L, () => {
      ctx.save()
      if (tall) { ctx.translate(L.x, L.y + L.h); ctx.rotate(-Math.PI / 2) } else ctx.translate(L.x, L.y)
      // 로컬: x 0..boxShort, y 0..boxLong
      const lb = ctx.createRadialGradient(boxShort / 2, boxLong / 2, 0, boxShort / 2, boxLong / 2, boxLong * 0.62)
      lb.addColorStop(0, 'rgba(250,244,232,0.98)'); lb.addColorStop(0.7, 'rgba(232,222,204,0.9)'); lb.addColorStop(1, 'rgba(200,190,172,0.0)')
      ctx.fillStyle = lb; ctx.fillRect(0, 0, boxShort, boxLong)
      // 필름: 살짝 기울어진 띠
      const fw = Math.min(boxShort * 0.72, u * 0.5)
      const frameH = fw * 0.72
      const pitch = frameH + fw * 0.08
      ctx.translate(boxShort / 2, boxLong / 2); ctx.rotate(-0.035)
      const sx = -fw / 2
      const span = boxLong * 1.3
      const scroll = (f.t * pitch / 3.2) % pitch
      // 필름 베이스
      ctx.shadowColor = 'rgba(30,18,8,0.45)'; ctx.shadowBlur = u * 0.03
      ctx.fillStyle = 'rgba(52,30,14,0.94)'
      ctx.fillRect(sx, -span / 2, fw, span)
      ctx.shadowColor = 'transparent'
      const edge = fw * 0.13
      const n = Math.ceil(span / pitch) + 2
      for (let i = -1; i < n; i++) {
        const y = -span / 2 + i * pitch + scroll
        // 칸 사진(칸마다 노출·위치가 조금 다르다)
        const fx = sx + edge, fwi = fw - edge * 2
        const idx = i - Math.floor((f.t / 3.2))
        const ex = ((idx % 4) + 4) % 4
        ctx.save()
        ctx.beginPath(); ctx.rect(fx, y, fwi, frameH); ctx.clip()
        const zoom = 1.15 + ex * 0.08
        drawCover(ctx, f, { x: fx - fwi * (zoom - 1) * (ex % 2 ? 0.2 : 0.8), y: y - frameH * (zoom - 1) / 2, w: fwi * zoom, h: fwi * zoom * 1 })
        ctx.fillStyle = ex === 0 ? 'rgba(255,220,170,0.10)' : ex === 2 ? 'rgba(20,10,0,0.22)' : 'rgba(255,170,90,0.08)'
        ctx.fillRect(fx, y, fwi, frameH)
        ctx.restore()
        // 구멍(빛이 통과)
        const hh = pitch / 4
        for (let k = 0; k < 4; k++) {
          const hy = y - fw * 0.04 + k * hh + hh * 0.3
          for (const hx of [sx + edge * 0.3, sx + fw - edge * 0.7]) {
            ctx.fillStyle = 'rgba(248,240,226,0.95)'
            roundRect(ctx, hx, hy, edge * 0.4, hh * 0.42, edge * 0.08); ctx.fill()
          }
        }
        // 가장자리 번호(일반 숫자만)
        ctx.save()
        ctx.translate(sx + fw - edge * 0.12, y + frameH * 0.5); ctx.rotate(Math.PI / 2)
        ctx.font = `600 ${Math.max(7, edge * 0.26)}px ${SANS}`
        ctx.fillStyle = 'rgba(232,160,70,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`${(((idx % 36) + 36) % 36) + 1}`, 0, 0)
        ctx.restore()
      }
      ctx.restore()
    })
    // 할레이션(밝은 상자 둘레가 붉게 번진다)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const hg = ctx.createRadialGradient(L.x + L.w / 2, L.y + L.h / 2, Math.min(L.w, L.h) * 0.3, L.x + L.w / 2, L.y + L.h / 2, Math.max(L.w, L.h) * 0.7)
    hg.addColorStop(0, 'rgba(255,120,60,0.0)'); hg.addColorStop(0.6, 'rgba(255,120,60,0.06)'); hg.addColorStop(1, 'rgba(255,120,60,0)')
    ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h)
    ctx.restore()

    const ink = tn.ink
    const inst = isInst(f)
    if (tall) {
      const y0 = h * 0.54
      softViz(ctx, f, { x: w * 0.1, y: h * 0.86, w: w * 0.8, h: u * 0.08 }, { x: w / 2 - u * 0.18, y: L.y + L.h / 2 - u * 0.18, w: u * 0.36, h: u * 0.36 }, 0.5)
      fitText(ctx, trackNoLatin(f), w / 2, y0, w * 0.8, u * 0.05, { font: LATIN, color: rgba(tn.glow), align: 'center', baseline: 'middle' })
      fitText(ctx, f.trackTitle, w / 2, y0 + u * 0.09, w * 0.86, u * 0.07, { font: tf(f, SERIF), weight: 300, color: rgba(ink), align: 'center', baseline: 'middle', minSize: 12 })
      if (!inst) serifLyrics(ctx, f, { cx: w / 2, cy: y0 + u * 0.33, maxW: w * 0.86, size: u * 0.048, ink, shadow: false })
      hairline(ctx, f, w * 0.2, h * 0.955, w * 0.6, ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, w / 2, h * 0.93, w * 0.6, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'center', baseline: 'middle' })
      if (f.headline) fitText(ctx, f.headline, w / 2, h * 0.03, w * 0.8, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), align: 'center', baseline: 'middle' })
    } else {
      const tx = L.x + L.w + u * 0.1, tw = w - tx - u * 0.08
      softViz(ctx, f, { x: tx, y: h * 0.8, w: tw, h: u * 0.07 }, { x: L.x + L.w / 2 - u * 0.2, y: h / 2 - u * 0.2, w: u * 0.4, h: u * 0.4 }, 0.5)
      const top = inst ? h * 0.38 : h * 0.18
      fitText(ctx, trackNoLatin(f), tx, top, tw, u * 0.05, { font: LATIN, color: rgba(tn.glow), baseline: 'middle' })
      fitText(ctx, f.trackTitle, tx, top + u * 0.09, tw, u * (inst ? 0.09 : 0.07), { font: tf(f, SERIF), weight: 300, color: rgba(ink), baseline: 'middle', minSize: 12 })
      hairline(ctx, f, tx, top + u * 0.16, Math.min(tw, u * 0.5), ink)
      fitText(ctx, `${mmss(f.t)}  /  ${mmss(f.duration)}`, tx, top + u * 0.2, tw, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.6), baseline: 'middle' })
      if (!inst) serifLyrics(ctx, f, { cx: tx, cy: h * 0.56, maxW: tw, size: u * 0.046, align: 'left', ink, shadow: false })
      if (f.headline) fitText(ctx, f.headline, w - u * 0.07, u * 0.07, w * 0.4, u * 0.024, { font: SANS, weight: 300, color: rgba(ink, 0.55), align: 'right', baseline: 'middle' })
    }
    vignette(ctx, f, 0.5, tn.deep)
    grain(ctx, f, 0.1)
  },
}
