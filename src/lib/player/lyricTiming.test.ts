import { describe, it, expect } from 'vitest'
import { buildTimedLyrics, activeLineIndex, activePartialIndex } from './lyricTiming'
import type { Span } from './vocalSpans'

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

describe('음원 분석 기반 추정', () => {
  const LY = '[Intro]\n[Verse 1]\n하나 둘 셋 넷 다섯\n여섯 일곱 여덟 아홉\n\n[Chorus]\n후렴 후렴 후렴 후렴\n후렴 둘째 줄입니다\n\n[Outro]'
  const starts = (spans?: Span[]) => buildTimedLyrics(LY, 120, spans ? { spans } : undefined).lines.filter((l) => l.kind === 'line').map((l) => l.start)

  it('전주가 20초면 첫 줄이 전주 안(20초 전)에 놓이지 않는다', () => {
    const st = starts([{ start: 20, end: 110 }])
    expect(st[0]).toBeGreaterThanOrEqual(20)
    expect(st.every((v) => v >= 20 && v <= 110)).toBe(true)
  })
  it('간주(노래 없는 구간)에는 가사가 놓이지 않는다', () => {
    const spans = [{ start: 5, end: 40 }, { start: 70, end: 110 }]
    const st = starts(spans)
    expect(st.every((v) => spans.some((s) => v >= s.start && v <= s.end))).toBe(true)
    expect(st.some((v) => v >= 70)).toBe(true) // 뒷 구간에도 배치된다
  })
  it('분석 근거가 있으면 basis=audio, 없으면 length', () => {
    expect(buildTimedLyrics(LY, 120, { spans: [{ start: 3, end: 100 }] }).basis).toBe('audio')
    expect(buildTimedLyrics(LY, 120).basis).toBe('length')
  })
  it('저장된 시간표(lrc)가 있으면 그대로 쓴다', () => {
    const r = buildTimedLyrics(LY, 120, { lrc: [{ t: 3, text: 'a' }, { t: 9, text: 'b' }], spans: [{ start: 20, end: 100 }] })
    expect(r.mode).toBe('exact')
    expect(r.lines.map((l) => l.start)).toEqual([3, 9])
  })
  it('줄 없이 끝에 남은 [Outro] 표지는 노래 뒤쪽을 비워 둔다', () => {
    const st = starts([{ start: 0, end: 100 }])
    expect(st[st.length - 1]).toBeLessThan(90)
  })
})

describe('activePartialIndex (부분 시간표)', () => {
  it('아는 줄이 하나도 없으면 강조 없음', () => {
    expect(activePartialIndex([null, null, null], 50)).toBe(-1)
    expect(activePartialIndex(null, 50)).toBe(-1)
  })
  it('시각을 아는 줄 중 지금까지 시작한 마지막 줄을 고른다', () => {
    expect(activePartialIndex([null, 10, 20, null], 25)).toBe(2)
    expect(activePartialIndex([null, 10, 20, null], 15)).toBe(1)
    expect(activePartialIndex([null, 10, 20, null], 5)).toBe(-1)
  })
  it('다음 줄 시각을 모르면 시작 후 8초 안에서만 강조한다', () => {
    expect(activePartialIndex([null, 10, null, null], 17.9)).toBe(1)
    expect(activePartialIndex([null, 10, null, null], 18)).toBe(-1)
  })
  it('다음 줄 시각을 알면 오래 지나도 그 줄이 유지된다', () => {
    expect(activePartialIndex([10, 60], 40)).toBe(0)
  })
  it('마지막 줄은 다음 줄이 없으므로 8초 규칙을 따른다', () => {
    expect(activePartialIndex([10, 20], 25)).toBe(1)
    expect(activePartialIndex([10, 20], 30)).toBe(-1)
  })
})

describe('lyricState (간주·신뢰도)', () => {
  it('end 가 없으면 다음 줄 전까지 강조, 0.3초 먼저 켠다', async () => {
    const { lyricState } = await import('./lyricTiming')
    const L = [{ kind: 'line' as const, text: 'a', start: 5 }, { kind: 'line' as const, text: 'b', start: 20 }]
    expect(lyricState(L, 4.6).active).toBe(-1)
    expect(lyricState(L, 4.75).active).toBe(0)
    expect(lyricState(L, 15).active).toBe(0)
  })
  it('end 를 지나 다음 줄까지 2초 넘게 남으면 간주, 2초 이하로 남으면 그대로', async () => {
    const { lyricState } = await import('./lyricTiming')
    const L = [{ kind: 'line' as const, text: 'a', start: 5, end: 9 }, { kind: 'line' as const, text: 'b', start: 20, end: 24 }]
    expect(lyricState(L, 12)).toEqual({ active: -1, interludeAfter: 0, current: 0 })
    expect(lyricState(L, 18)).toEqual({ active: 0, interludeAfter: -1, current: 0 })
    expect(lyricState(L, 30)).toEqual({ active: -1, interludeAfter: 1, current: 1 })
  })
  it('신뢰도 낮은 줄은 강조하지 않는다', async () => {
    const { lyricState } = await import('./lyricTiming')
    const L = [{ kind: 'line' as const, text: 'a', start: 5, conf: 0.2 }, { kind: 'line' as const, text: 'b', start: 20, conf: 0.9 }]
    expect(lyricState(L, 8)).toEqual({ active: -1, interludeAfter: -1, current: 0 })
    expect(lyricState(L, 21).active).toBe(1)
  })
})

