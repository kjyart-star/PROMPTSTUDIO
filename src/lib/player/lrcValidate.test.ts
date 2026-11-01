import { describe, it, expect } from 'vitest'
import { alignLineTexts, validateAutoLrc } from './lrcValidate'

const ok = [{ t: 1, text: '첫 줄' }, { t: 12.345, text: '둘째 줄' }, { t: 30, text: '셋째 줄' }]

describe('validateAutoLrc', () => {
  it('단조 증가하는 정상 결과는 받고 시각을 소수 둘째 자리로 다듬는다', () => {
    const r = validateAutoLrc(ok)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lines[1].t).toBe(12.35)
  })
  it('줄 수가 모자라거나 넘치면 거부', () => {
    expect(validateAutoLrc([ok[0]])).toMatchObject({ ok: false, reason: 'line-count' })
    expect(validateAutoLrc(Array.from({ length: 2001 }, (_, i) => ({ t: i, text: 'x' })))).toMatchObject({ ok: false, reason: 'line-count' })
  })
  it('시간이 거꾸로 가면 거부', () => {
    expect(validateAutoLrc([{ t: 20, text: 'a' }, { t: 5, text: 'b' }, { t: 40, text: 'c' }])).toMatchObject({ ok: false, reason: 'not-monotonic' })
  })
  it('음수·NaN·문자열 시각, 빈 글은 거부', () => {
    expect(validateAutoLrc([{ t: -1, text: 'a' }, { t: 20, text: 'b' }])).toMatchObject({ ok: false, reason: 'bad-time' })
    expect(validateAutoLrc([{ t: NaN, text: 'a' }, { t: 20, text: 'b' }])).toMatchObject({ ok: false, reason: 'bad-time' })
    expect(validateAutoLrc([{ t: '1', text: 'a' }, { t: 20, text: 'b' }])).toMatchObject({ ok: false, reason: 'bad-time' })
    expect(validateAutoLrc([{ t: 1, text: ' ' }, { t: 20, text: 'b' }])).toMatchObject({ ok: false, reason: 'bad-text' })
  })
  it('곡 길이를 알면 길이 + 3초를, 모르면 30분을 넘지 못한다', () => {
    expect(validateAutoLrc(ok, { durationSec: 25 })).toMatchObject({ ok: false, reason: 'beyond-duration' })
    expect(validateAutoLrc(ok, { durationSec: 29 }).ok).toBe(true)
    expect(validateAutoLrc([{ t: 1, text: 'a' }, { t: 1900, text: 'b' }])).toMatchObject({ ok: false, reason: 'beyond-duration' })
  })
  it('가사 전체가 10초 안에 뭉쳐 있으면 정렬이 무너진 것', () => {
    expect(validateAutoLrc([{ t: 1, text: 'a' }, { t: 3, text: 'b' }, { t: 5, text: 'c' }])).toMatchObject({ ok: false, reason: 'too-short-span' })
  })
  it('곡 가사의 줄과 글·개수가 같아야 한다', () => {
    expect(validateAutoLrc(ok, { expectedTexts: ['첫 줄', '둘째 줄', '셋째 줄'] }).ok).toBe(true)
    expect(validateAutoLrc(ok, { expectedTexts: ['첫 줄', '둘째 줄'] })).toMatchObject({ ok: false, reason: 'lyrics-mismatch' })
    expect(validateAutoLrc(ok, { expectedTexts: ['첫 줄', '다른 줄', '셋째 줄'] })).toMatchObject({ ok: false, reason: 'lyrics-mismatch' })
  })
  it('배열이 아니면 거부', () => {
    expect(validateAutoLrc('x')).toMatchObject({ ok: false })
    expect(validateAutoLrc(null)).toMatchObject({ ok: false })
  })
})

describe('alignLineTexts', () => {
  it('구간 표지를 뺀 줄 목록을 돌려준다', () => {
    expect(alignLineTexts('[Verse]\n안녕\n반가워\n[Chorus]\n노래')).toEqual(['안녕', '반가워', '노래'])
  })
  it('이미 시각이 들어 있는 가사나 빈 가사는 대상이 아니다', () => {
    expect(alignLineTexts('[00:01.00]안녕\n[00:05.00]반가워')).toEqual([])
    expect(alignLineTexts('')).toEqual([])
    expect(alignLineTexts(null)).toEqual([])
  })
})
