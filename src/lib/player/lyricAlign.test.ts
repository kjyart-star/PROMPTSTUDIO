import { describe, it, expect } from 'vitest'
import { finalizeAlignment, ONSET_LEAD_SEC } from './lyricAlign'

describe('finalizeAlignment', () => {
  it('정렬이 늦게 찍는 만큼 앞당기고 단조 증가로 만든다', () => {
    const r = finalizeAlignment([5, 10, 9, 30], 100)!
    expect(r[0]).toBeCloseTo(5 - ONSET_LEAD_SEC, 2)
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1])
  })
  it('맞추지 못한 줄은 이웃 사이로 채운다', () => {
    const r = finalizeAlignment([10, null, 30, 40, 50, 60, 70, 80, 90, 100], 120)!
    expect(r[1]).toBeGreaterThan(r[0])
    expect(r[1]).toBeLessThan(r[2])
  })
  it('절반 넘게 비면 실패', () => {
    expect(finalizeAlignment([1, null, null, null], 100)).toBeNull()
  })
  it('가사가 곡의 아주 짧은 구간에 뭉치면 실패', () => {
    expect(finalizeAlignment([1, 2, 3, 4, 5], 200)).toBeNull()
  })
  it('곡 길이를 넘지 않고 0 아래로 내려가지 않는다', () => {
    const r = finalizeAlignment([0.2, 20, 50, 400], 100)!
    expect(r[0]).toBe(0)
    expect(r[r.length - 1]).toBeLessThanOrEqual(100)
  })
})
