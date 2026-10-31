import { describe, it, expect } from 'vitest'
import { findVocalSpans } from './vocalSpans'

const SR = 8000
/** 구간마다 (시작, 끝, 진폭)인 800Hz 사인 + 약한 잡음으로 만든 가짜 곡 */
function synth(total: number, parts: [number, number, number][]): Float32Array {
  const x = new Float32Array(Math.round(total * SR))
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const p = parts.find(([s, e]) => t >= s && t < e)
    x[i] = (p ? p[2] : 0.0005) * Math.sin(2 * Math.PI * 800 * t)
  }
  return x
}

describe('findVocalSpans', () => {
  it('앞 무음(전주 자리가 비어 있는 곡)에서 첫 구간이 소리가 시작되는 곳에서 열린다', () => {
    const spans = findVocalSpans(synth(60, [[10, 55, 0.3]]), SR)
    expect(spans).toHaveLength(1)
    expect(spans[0].start).toBeGreaterThan(9.5)
    expect(spans[0].start).toBeLessThan(10.6)
    expect(spans[0].end).toBeGreaterThan(54)
    expect(spans[0].end).toBeLessThan(56)
  })
  it('긴 간주(조용한 구간)는 구간을 둘로 가른다', () => {
    const spans = findVocalSpans(synth(80, [[2, 30, 0.3], [50, 78, 0.3]]), SR)
    expect(spans).toHaveLength(2)
    expect(spans[0].end).toBeLessThan(31)
    expect(spans[1].start).toBeGreaterThan(49)
  })
  it('숨 돌리는 짧은 쉼(2.5초 미만)은 메운다', () => {
    const spans = findVocalSpans(synth(40, [[1, 15, 0.3], [16.5, 38, 0.3]]), SR)
    expect(spans).toHaveLength(1)
  })
  it('0.5초짜리 클릭은 노래로 치지 않는다', () => {
    const spans = findVocalSpans(synth(40, [[1, 1.3, 0.3], [12, 38, 0.3]]), SR)
    expect(spans[0].start).toBeGreaterThan(11)
  })
  it('무음 파일은 곡 전체를 한 구간으로', () => {
    const spans = findVocalSpans(new Float32Array(SR * 30), SR)
    expect(spans).toEqual([{ start: 0, end: 30 }])
  })
})
