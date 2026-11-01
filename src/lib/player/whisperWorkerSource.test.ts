import { describe, it, expect } from 'vitest'
import { WHISPER_CORE_SRC, whisperWorkerScript } from './whisperWorkerSource'

const core = new Function(WHISPER_CORE_SRC + '\nreturn { dtwStarts, medianFilter };')() as {
  dtwStarts: (cost: Float32Array, T: number, F: number) => number[]
  medianFilter: (row: Float32Array, w: number) => Float32Array
}

describe('워커 코어', () => {
  it('DTW: 토큰이 프레임 순서대로 하나씩 이어지면 그 프레임에서 시작한다', () => {
    // 토큰 i 가 프레임 [i*10, i*10+10) 에 어텐션이 몰린 비용 행렬(낮을수록 좋음)
    const T = 4, F = 40, cost = new Float32Array(T * F).fill(1)
    for (let t = 0; t < T; t++) for (let f = t * 10; f < t * 10 + 10; f++) cost[t * F + f] = -1
    expect(core.dtwStarts(cost, T, F)).toEqual([0, 10, 20, 30])
  })
  it('DTW: 앞 프레임이 비어(전주) 있으면 첫 토큰이 그 뒤에서 시작한다', () => {
    const T = 2, F = 30, cost = new Float32Array(T * F).fill(1)
    for (let f = 12; f < 20; f++) cost[0 * F + f] = -1
    for (let f = 20; f < 30; f++) cost[1 * F + f] = -1
    const s = core.dtwStarts(cost, T, F)
    expect(s[1]).toBe(20)
    expect(s[0]).toBeGreaterThanOrEqual(0)
    expect(s[0]).toBeLessThan(s[1])
  })
  it('중앙값 필터가 튀는 값을 없앤다', () => {
    const r = core.medianFilter(new Float32Array([1, 1, 9, 1, 1, 1, 1]), 3)
    expect(Array.from(r)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })
  it('워커 완성 소스에 모델·CDN 주소가 박히고 백틱이 없다', () => {
    const src = whisperWorkerScript()
    expect(src).toContain('whisper-small_timestamped')
    expect(src).toContain('cdn.jsdelivr.net')
    expect(src).not.toContain('${')
  })
})
