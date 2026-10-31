import { describe, it, expect } from 'vitest'
import { buildTimedLyrics, activeLineIndex } from './lyricTiming'

describe('buildTimedLyrics', () => {
  it('시간표가 있으면 정확 모드로 그대로 쓴다', () => {
    const r = buildTimedLyrics('[00:05.50]첫 줄\n[00:12.00]둘째 줄\n[01:00]셋째 줄', 200)
    expect(r.mode).toBe('exact')
    expect(r.lines.map((l) => l.start)).toEqual([5.5, 12, 60])
  })
  it('시간표가 없으면 길이 비례 추정이고 시작이 단조 증가한다', () => {
    const r = buildTimedLyrics('[Verse 1]\n안녕 하세요 오늘도\n짧음\n\n[Chorus]\n아주 아주 긴 후렴 가사가 여기에 들어갑니다', 180)
    expect(r.mode).toBe('estimated')
    const starts = r.lines.filter((l) => l.kind === 'line').map((l) => l.start)
    expect(starts.length).toBe(3)
    expect(starts[0]).toBeGreaterThan(0)
    expect(starts[2]).toBeLessThan(180)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
    expect(r.lines.filter((l) => l.kind === 'section').map((l) => l.text)).toEqual(['Verse 1', 'Chorus'])
  })
  it('가사가 없으면 none', () => {
    expect(buildTimedLyrics(null, 100).mode).toBe('none')
    expect(buildTimedLyrics('  ', 100).mode).toBe('none')
  })
  it('길이를 모르면 추정하지 않는다', () => {
    expect(buildTimedLyrics('가\n나', 0).mode).toBe('none')
  })
})

describe('activeLineIndex', () => {
  it('첫 줄 전은 -1, 이후엔 section 을 건너뛰고 현재 줄', () => {
    const lines = buildTimedLyrics('[Verse]\n하나\n둘\n셋', 120).lines
    expect(activeLineIndex(lines, 0)).toBe(-1)
    const t = lines[2].start + 0.1
    expect(lines[activeLineIndex(lines, t)].text).toBe('둘')
    expect(lines[activeLineIndex(lines, 999)].text).toBe('셋')
  })
})
