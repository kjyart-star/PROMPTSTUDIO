import { describe, it, expect } from 'vitest'
import { lyricsOfItem, styleOfItem, lrcOfItem, lrcPickOf, LRC_AUTO_VERSION } from './lyricsOf'
import { buildHistoryQueue, queueWithPlayable, historyItemToTrack } from './playQueue'

const opts = { artistName: '나', slug: 'me' }
const orig = { id: 'a', title: '우리이야기 (v2)', audio_url: 'p/a.mp3', lyrics: '', form: { prompt: '[Verse 1]\n우리 이야기' }, prompt: 'warm ballad' }
const master = { id: 'm', title: '우리이야기 (마스터링)', audio_url: 'p/m.mp3', lyrics: '', form: { kind: 'mastering', source_id: 'a' } }

describe('스튜디오 곡 가사', () => {
  it('lyrics → form.lyrics → form.prompt 순으로 찾는다', () => {
    expect(lyricsOfItem(orig)).toContain('우리 이야기')
    expect(lyricsOfItem({ lyrics: '직접', form: { prompt: 'x' } })).toBe('직접')
    expect(lyricsOfItem({ form: { lyrics: '폼' } })).toBe('폼')
  })
  it('마스터링 파생곡은 원곡 가사를 물려받는다', () => {
    expect(lyricsOfItem(master)).toBe('')
    expect(lyricsOfItem(master, [orig, master])).toContain('우리 이야기')
  })
  it('대기열의 Track 에 가사·스타일이 실린다(마스터링본 포함)', () => {
    const q = buildHistoryQueue([orig, master], opts)
    expect(q.map((t) => !!t.lyrics)).toEqual([true, true])
    expect(q[0].style_prompt).toBe('warm ballad')
  })
  it('누른 곡을 재생 주소로 바꿔 끼워도 가사가 유지된다', () => {
    const q = buildHistoryQueue([orig, master], opts)
    const cur = historyItemToTrack(master, opts, 'https://x/p.mp3') // 파생곡 단독 변환은 가사가 비어 있다
    expect(cur.lyrics).toBeNull()
    const merged = queueWithPlayable(q, cur)
    expect(merged[1].lyrics).toContain('우리 이야기')
    expect(merged[1].file_url).toBe('https://x/p.mp3')
  })
  it('스타일은 prompt → form.style → genre', () => {
    expect(styleOfItem({ form: { style: 's' }, genre: 'g' })).toBe('s')
    expect(styleOfItem({ genre: 'g' })).toBe('g')
  })
})

describe('가사 시간표 출처', () => {
  const L = [{ t: 1, text: '가' }, { t: 5, text: '나' }]
  const A = [{ t: 2, text: '가' }, { t: 6, text: '나' }]
  it('사용자 시간표(lrc_by=user)가 자동 맞추기보다 먼저다', () => {
    expect(lrcOfItem({ form: { lrc: L, lrc_by: 'user', lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION } })).toBe(L)
  })
  it('표시 없는 옛 form.lrc(1차 자동 맞추기 결과)는 쓰지 않는다', () => {
    expect(lrcOfItem({ form: { lrc: L } })).toBeNull()
  })
  it('읽을 수 있는 판(3 이상)만 쓴다 — 판 2 이하·표시 없음은 무시, 다시 계산 중인 판 3 은 쓴다', () => {
    expect(lrcOfItem({ form: { lrc_auto: A } })).toBeNull()
    expect(lrcOfItem({ form: { lrc_auto: A, lrc_auto_v: 2 } })).toBeNull()
    expect(lrcOfItem({ form: { lrc_auto: A, lrc_auto_v: 3 } })).toBe(A)
    expect(lrcOfItem({ form: { lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION } })).toBe(A)
  })
  it('마스터링본은 원곡의 사용자 시간표만 물려받고, 자동 결과는 물려받지 않는다', () => {
    const m = { id: 'm', form: { kind: 'mastering', source_id: 'o' } }
    expect(lrcOfItem(m, [{ id: 'o', form: { lrc: L, lrc_by: 'user' } }, m])).toBe(L)
    expect(lrcOfItem(m, [{ id: 'o', form: { lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION } }, m])).toBeNull()
  })
  it('재생성 v2 는 원곡 시간표를 물려받지 않는다', () => {
    const v2 = { id: 'v', form: { parent_id: 'o' } }
    expect(lrcOfItem(v2, [{ id: 'o', form: { lrc: L, lrc_by: 'user' } }, v2])).toBeNull()
  })
  it('출처를 함께 돌려준다 — 사용자 LRC 는 user, 자동 결과는 auto, 옛 표시 없는 값은 없음', () => {
    expect(lrcPickOf({ form: { lrc: L, lrc_by: 'user', lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION } })).toEqual({ lines: L, by: 'user' })
    expect(lrcPickOf({ form: { lrc: L, lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION } })).toEqual({ lines: A, by: 'auto' })
    expect(lrcPickOf({ form: { lrc: L } })).toBeNull()
    const m = { id: 'm', form: { kind: 'mastering', source_id: 'o' } }
    expect(lrcPickOf(m, [{ id: 'o', form: { lrc: L, lrc_by: 'user' } }, m])).toEqual({ lines: L, by: 'user' })
  })
})

describe('믿을 수 없다고 접은 곡', () => {
  it('lrc_auto_fail 판이 결과 판 이상이면 자동 결과를 쓰지 않는다(사용자 LRC 는 그대로)', async () => {
    const { lrcOfItem } = await import('./lyricsOf')
    const A2 = [{ t: 1, text: 'a' }, { t: 9, text: 'b' }]
    expect(lrcOfItem({ form: { lrc_auto: A2, lrc_auto_v: 3, lrc_auto_fail: { v: 4 } } })).toBeNull()
    expect(lrcOfItem({ form: { lrc_auto: A2, lrc_auto_v: 4, lrc_auto_fail: { v: 3 } } })).toBe(A2)
    expect(lrcOfItem({ form: { lrc: A2, lrc_by: 'user', lrc_auto_fail: { v: 4 } } })).toBe(A2)
  })
})


describe('자동 시간표 ↔ 음원 파일 1:1', () => {
  it('저장 경로와 CDN 주소는 같은 파일로 보고, 다른 파일이면 시간표를 쓰지 않는다', async () => {
    const { audioKeyOf, lrcPickOf } = await import('./lyricsOf')
    expect(audioKeyOf('audio/abc.mp3')).toBe('abc.mp3')
    expect(audioKeyOf('https://cdn.example/audio/abc.mp3?cors=1')).toBe('abc.mp3')
    const lines = [{ t: 1, text: 'a' }, { t: 9, text: 'b' }]
    const form = { lrc_auto: lines, lrc_auto_v: 5, lrc_auto_audio: 'abc.mp3' }
    expect(lrcPickOf({ audio_url: 'https://cdn.example/audio/abc.mp3', form })?.by).toBe('auto')
    expect(lrcPickOf({ audio_url: 'audio/zzz.mp3', form })).toBeNull()
    expect(lrcPickOf({ audio_url: 'audio/zzz.mp3', form: { lrc_auto: lines, lrc_auto_v: 4 } })?.by).toBe('auto') // 묶인 표시가 없는 옛 결과
  })
})
