import { describe, expect, it } from 'vitest'
import type { Box, CinemaFrame, ElKey } from './types'
import { drawFrame } from './frame'
import { TEMPLATES } from './templates'

function fakeCtx() {
  const state: Record<string, unknown> = { font: '10px sans-serif' }
  const grad = () => ({ addColorStop: () => {} })
  return new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'measureText') return (text: string) => { const m = /(\d+(?:\.\d+)?)px/.exec(String(state.font)); return { width: text.length * (m ? Number(m[1]) : 10) * 0.6 } }
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return grad
      if (prop in state) return state[prop]
      return () => {}
    },
    set(_t, prop: string, v) { state[prop] = v; return true },
  }) as unknown as CanvasRenderingContext2D
}

function frame(layout?: CinemaFrame['layout']): CinemaFrame {
  return {
    w: 1280, h: 720, t: 12.5, trackIndex: 0, trackCount: 3, trackTitle: '테스트 곡', headline: '쿠키뮤직',
    cover: null, coverSeed: 'seed', kind: 'lyrics',
    lines: [{ text: '첫째 줄', start: 0 }, { text: '현재 줄 가사', start: 10 }, { text: '셋째 줄', start: 20 }],
    activeIndex: 1, lyricsEstimated: false, duration: 210,
    bars: Float32Array.from({ length: 64 }, (_, i) => (i % 7) / 7), level: 0.5, shape: 'bars-reflect',
    palette: { id: 'p', name: 'p', colors: ['#ffff00', '#ff00ff'], accent: '#ffff00' }, layout, hits: {},
  }
}

describe('요소 직접 조정(모든 템플릿 공용)', () => {
  for (const tpl of TEMPLATES) {
    it(`${tpl.id}: 곡 제목·가사·스펙트럼 박스가 잡히고, 옮기면 그만큼 옮겨진다`, () => {
      const a = frame(); drawFrame(fakeCtx(), tpl.id, a)
      for (const k of ['title', 'lyrics', 'viz'] as ElKey[]) expect(a.hits?.[k], k).toBeTruthy()
      const b = frame({ title: { dx: 0.1, dy: -0.05, scale: 1.5 } }); drawFrame(fakeCtx(), tpl.id, b)
      const ha = a.hits!.title as Box, hb = b.hits!.title as Box
      // 제목을 두 군데 그리는 템플릿은 두 박스를 합친 박스라 오차를 둔다
      expect(Math.abs(hb.x + hb.w / 2 - (ha.x + ha.w / 2 + 128))).toBeLessThan(20)
      expect(Math.abs(hb.y + hb.h / 2 - (ha.y + ha.h / 2 - 36))).toBeLessThan(20)
      expect(hb.w / ha.w).toBeGreaterThan(1.3)
    })
  }
  it('실사 장면 템플릿은 커버도 요소로 잡힌다', () => {
    for (const id of ['rain-window', 'night-drive', 'cafe-table', 'lofi-desk', 'glass-card', 'type-grid', 'film-strip']) {
      const f = frame(); drawFrame(fakeCtx(), id, f)
      expect(f.hits?.cover, id).toBeTruthy()
    }
  })
})
