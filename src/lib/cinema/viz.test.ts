import { describe, expect, it } from 'vitest'
import { drawViz, VIZ_SHAPES, isCircular } from './viz'
import { PALETTES } from './palettes'

function fakeCtx() {
  const log: string[] = []
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(_, k: string) {
      if (k === 'createLinearGradient') return (...a: number[]) => { log.push(`${k}(${a.map(v => v.toFixed(3))})`); return { addColorStop: (...s: unknown[]) => log.push(`stop(${s})`) } }
      return (...a: unknown[]) => { log.push(`${k}(${a.map(v => typeof v === 'number' ? v.toFixed(3) : String(v))})`) }
    },
    set(_, k: string, v) { log.push(`set ${k}=${typeof v === 'object' ? 'obj' : String(v)}`); return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}
const boxes = { bar: { x: 0, y: 500, w: 1000, h: 200 }, ring: { x: 300, y: 100, w: 400, h: 400 } }
const DRAW = /^(fillRect|arc|stroke|fill)\(/
const mk = (f: (i: number) => number) => Float32Array.from({ length: 64 }, (_, i) => f(i))

describe('viz', () => {
  it('12종', () => { expect(VIZ_SHAPES).toHaveLength(12); expect(VIZ_SHAPES.filter(v => isCircular(v.id))).toHaveLength(5) })
  for (const s of VIZ_SHAPES) {
    it(`${s.id} 그리기·결정성·빈 입력`, () => {
      const bars = mk(i => (Math.sin(i / 5) + 1) / 2)
      const a = fakeCtx(); drawViz(a.ctx, s.id, PALETTES[1], bars, 0.6, 1.5, boxes)
      const b = fakeCtx(); drawViz(b.ctx, s.id, PALETTES[1], bars, 0.6, 1.5, boxes)
      expect(a.log.filter(l => DRAW.test(l)).length).toBeGreaterThan(0)
      expect(a.log).toEqual(b.log)
      expect(a.log.filter(l => l.startsWith('save')).length).toBe(a.log.filter(l => l.startsWith('restore')).length)
      const z = fakeCtx(); drawViz(z.ctx, s.id, PALETTES[0], mk(() => 0), 0, 0, boxes)
      expect(z.log.filter(l => DRAW.test(l)).length).toBeGreaterThan(0)
      expect(z.log.some(l => l.includes('NaN'))).toBe(false)
    })
  }
})
