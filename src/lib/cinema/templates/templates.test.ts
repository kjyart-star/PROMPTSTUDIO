import { describe, expect, it } from 'vitest'
import type { CinemaFrame } from '../types'
import { TEMPLATES, getTemplate } from './index'

type Call = [string, unknown[]]

function fakeCtx() {
  const log: Call[] = []
  const state: Record<string, unknown> = { font: '10px sans-serif' }
  const grad = () => ({ addColorStop: () => {} })
  const ctx = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'measureText') {
        return (text: string) => {
          const m = /(\d+(?:\.\d+)?)px/.exec(String(state.font))
          return { width: text.length * (m ? Number(m[1]) : 10) * 0.6 }
        }
      }
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return grad
      if (prop in state) return state[prop]
      return (...args: unknown[]) => { log.push([prop, args]) }
    },
    set(_t, prop: string, v) { state[prop] = v; if (prop === 'fillStyle' || prop === 'font') log.push(['=' + prop, [typeof v === 'string' ? v : 'obj']]); return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}

const SIZES: [number, number][] = [[960, 540], [540, 960], [720, 720], [800, 600]]

function frame(w: number, h: number, lyrics: boolean): CinemaFrame {
  return {
    w, h, t: 12.5, trackIndex: 0, trackCount: 3, trackTitle: '테스트 곡', headline: '오늘의 플레이리스트',
    cover: null, coverSeed: 'seed', kind: lyrics ? 'lyrics' : 'instrumental',
    lines: lyrics ? [{ text: '첫째 줄', start: 0 }, { text: '현재 줄 가사', start: 10 }, { text: '셋째 줄', start: 20 }] : [],
    activeIndex: lyrics ? 1 : -1, lyricsEstimated: false, duration: 210,
    bars: Float32Array.from({ length: 64 }, (_, i) => (i % 7) / 7), level: 0.5, shape: 'bars-reflect',
    palette: { id: 'p', name: 'p', colors: ['#ff0', '#f0f', '#0ff'], accent: '#ff0' },
  }
}

describe('cinema templates', () => {
  it('21종(기존 9 + 실사 장면 7 + 레트로 5)이 등록되고 getTemplate 은 없는 id 에 첫 번째를 준다', () => {
    expect(TEMPLATES).toHaveLength(21)
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(21)
    expect(getTemplate('nope')).toBe(TEMPLATES[0])
  })
  for (const tpl of TEMPLATES) {
    for (const [w, h] of SIZES) {
      for (const lyrics of [true, false]) {
        it(`${tpl.id} ${w}x${h} ${lyrics ? '가사' : '경음악'}`, () => {
          const f = frame(w, h, lyrics)
          const a = fakeCtx()
          expect(() => tpl.draw(a.ctx, f)).not.toThrow()
          const texts = a.log.filter(c => c[0] === 'fillText').map(c => c[1][0])
          expect(texts.length).toBeGreaterThan(0)
          if (lyrics) expect(texts).toContain('현재 줄 가사')
          const b = fakeCtx()
          tpl.draw(b.ctx, f)
          expect(JSON.stringify(b.log)).toBe(JSON.stringify(a.log))
          // save/restore 균형
          const n = (k: string) => a.log.filter(c => c[0] === k).length
          expect(n('save')).toBe(n('restore'))
        })
      }
    }
  }
})
