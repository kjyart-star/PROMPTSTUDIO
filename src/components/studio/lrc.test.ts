import { describe, it, expect } from 'vitest'
import { parseLrc, parseSrt, parseTiming, toLrc } from './lrc'

describe('가사 시간표', () => {
  it('LRC 파싱 · 다중 시간표 · 정렬', () => {
    const r = parseLrc('[ti:x]\n[00:12.50]둘째\n[00:01.00][00:30.00]첫째 반복')
    expect(r.map((l) => l.t)).toEqual([1, 12.5, 30])
    expect(r[0].text).toBe('첫째 반복')
  })
  it('SRT 파싱', () => {
    const r = parseSrt('1\n00:00:02,500 --> 00:00:04,000\n안녕\n하세요\n\n2\n00:01:00,000 --> 00:01:02,000\n끝')
    expect(r).toEqual([{ t: 2.5, text: '안녕 하세요' }, { t: 60, text: '끝' }])
  })
  it('파일 종류 자동 판별', () => {
    expect(parseTiming('a.srt', '1\n00:00:01,000 --> 00:00:02,000\nhi')).toHaveLength(1)
    expect(parseTiming('a.lrc', '[00:01.00]hi')).toHaveLength(1)
    expect(parseTiming('a.txt', 'no timing')).toHaveLength(0)
  })
  it('LRC 로 내보내면 다시 읽힌다', () => {
    const src = [{ t: 1.5, text: 'a' }, { t: 65.25, text: 'b' }]
    expect(parseLrc(toLrc(src))).toEqual(src)
  })
})
