import { describe, it, expect } from 'vitest'
import { initialLyrics, plainLines, activeIndexAt, suspectLines, autoAlign, toLrc } from './lyrics'
import { outputSize, avcCodecString, formatClock, estimateBytes } from './output'

describe('lyrics', () => {
  it('시간표가 있으면 exact, 없으면 estimated 이고 구간 표지는 뺀다', () => {
    expect(initialLyrics('[00:05.00]가\n[00:10.50]나\n[00:20.00]다', 100).mode).toBe('exact')
    const r = initialLyrics('[Verse]\n첫 줄\n둘째 줄\n\n[Chorus]\n셋째 줄', 180)
    expect(r.mode).toBe('estimated')
    expect(r.lines.map(l => l.text)).toEqual(['첫 줄', '둘째 줄', '셋째 줄'])
    expect(r.lines[0].start).toBeLessThan(r.lines[2].start)
  })
  it('가사 없음', () => { expect(initialLyrics('', 100).mode).toBe('none'); expect(plainLines('[Intro]\n\n')).toEqual([]) })
  it('activeIndexAt: 시작 전 -1, 경계, 마지막 줄 뒤 12초 넘으면 -1', () => {
    const l = [{ text: 'a', start: 5 }, { text: 'b', start: 10 }]
    expect(activeIndexAt(l, 1)).toBe(-1); expect(activeIndexAt(l, 5)).toBe(0); expect(activeIndexAt(l, 9.99)).toBe(0); expect(activeIndexAt(l, 11)).toBe(1); expect(activeIndexAt(l, 30)).toBe(-1)
  })
  it('suspectLines: 역행·너무 가까움·벌어짐·곡 밖', () => {
    const l = [{ text: 'a', start: 5 }, { text: 'b', start: 4 }, { text: 'c', start: 4.3 }, { text: 'd', start: 50 }, { text: 'e', start: 400 }]
    expect([...suspectLines(l, 200)].sort()).toEqual([1, 2, 3, 4])
  })
  it('autoAlign: 소리가 시작되는 지점 이후에 단조 증가로 놓는다', () => {
    const env = new Float32Array(600) // 60초
    for (let i = 100; i < 500; i++) env[i] = i % 30 < 25 ? 0.5 : 0.02 // 10초부터 소리, 3초마다 숨
    const out = autoAlign(['하나 둘 셋', '넷 다섯 여섯', '일곱 여덟 아홉', '열 열하나 열둘'], env, 0.1, 60)
    expect(out[0].start).toBeGreaterThanOrEqual(9.5)
    for (let i = 1; i < out.length; i++) expect(out[i].start).toBeGreaterThan(out[i - 1].start)
    expect(out[3].start).toBeLessThan(50)
  })
  it('toLrc', () => { expect(toLrc([{ text: '가', start: 65.5 }])).toBe('[01:05.50]가') })
})

describe('output', () => {
  it('해상도·비율은 짝수 크기', () => {
    expect(outputSize('16:9', 1080)).toEqual({ w: 1920, h: 1080 })
    expect(outputSize('9:16', 1080)).toEqual({ w: 1080, h: 1920 })
    expect(outputSize('1:1', 720)).toEqual({ w: 720, h: 720 })
    expect(outputSize('4:3', 1080)).toEqual({ w: 1440, h: 1080 })
  })
  it('코덱 레벨·시간·용량', () => {
    expect(avcCodecString(1920, 1080, 30)).toBe('avc1.640028'); expect(avcCodecString(1920, 1080, 60)).toBe('avc1.64002a'); expect(avcCodecString(2560, 1440, 30)).toBe('avc1.64002a')
    expect(formatClock(3725)).toBe('1:02:05'); expect(formatClock(65)).toBe('1:05')
    expect(estimateBytes(60, 1920, 1080, 30)).toBeGreaterThan(1e6)
  })
})
