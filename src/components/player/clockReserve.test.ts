import { describe, it, expect } from 'vitest'
import { clockReserve } from './ClockWidget'

describe('시계 안전 영역', () => {
  const base = { hidden: false, fy: 0.1 }
  it('위쪽 시계는 위 여백, 아래쪽 시계는 아래 여백을 만든다', () => {
    for (const pos of ['tl', 'tr', 'tc'] as const) expect(clockReserve({ ...base, pos }, 100, 900)).toEqual({ t: 108, b: 0 })
    for (const pos of ['bl', 'br'] as const) expect(clockReserve({ ...base, pos }, 100, 900)).toEqual({ t: 0, b: 136 })
  })
  it('숨기면 여백이 없다', () => {
    expect(clockReserve({ ...base, hidden: true, pos: 'tl' }, 100, 900)).toEqual({ t: 0, b: 0 })
  })
  it('자유 위치는 화면 위쪽 절반이면 위 여백, 아래쪽이면 아래 여백', () => {
    expect(clockReserve({ hidden: false, pos: 'free', fy: 0.2 }, 100, 900).t).toBeGreaterThan(0)
    expect(clockReserve({ hidden: false, pos: 'free', fy: 0.2 }, 100, 900).b).toBe(0)
    const low = clockReserve({ hidden: false, pos: 'free', fy: 0.7 }, 100, 900)
    expect(low.t).toBe(0); expect(low.b).toBeGreaterThan(0)
  })
})
