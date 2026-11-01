import { describe, it, expect } from 'vitest'
import { localFix, matchWords, type Word } from './match'

const lines = ['네온빛을 따라 걸어가', '끝없이 이어지는 밤', '우리는 멈추지 않아']
const w = (word: string, start: number): Word => ({ word, start, end: start + 0.4 })

describe('받아쓰기 ↔ 원문 맞추기', () => {
  it('줄 첫 단어가 들린 시각을 줄 시작으로 잡는다', () => {
    const words = [w('네온빛을', 10), w('따라', 10.5), w('걸어가', 11), w('끝없이', 20), w('이어지는', 20.6), w('밤', 21.2), w('우리는', 30), w('멈추지', 30.5), w('않아', 31)]
    const s = matchWords(words, lines)
    expect(s[0]).toBeCloseTo(10, 1)
    expect(s[1]).toBeCloseTo(20, 1)
    expect(s[2]).toBeCloseTo(30, 1)
  })
  it('들리지 않은 줄은 null', () => {
    const words = [w('네온빛을', 10), w('따라', 10.5), w('걸어가', 11), w('우리는', 30), w('멈추지', 30.5), w('않아', 31)]
    expect(matchWords(words, lines)[1]).toBeNull()
  })
  it('근처 보정: 간주 앞에 잘못 붙은 줄을 ±20초 안의 들린 자리로 옮기고, 멀리 있는 반복은 잡지 않는다', () => {
    const words = [w('끝없이', 24), w('이어지는', 24.6), w('밤', 25.2), w('끝없이', 70), w('이어지는', 70.6)]
    const r = localFix([10, 13, 40], words, lines, { lead: 0 })
    expect(r.starts[1]).toBeCloseTo(24, 1) // 13초 → 24초
    expect(r.moved).toBe(1)
  })
})
