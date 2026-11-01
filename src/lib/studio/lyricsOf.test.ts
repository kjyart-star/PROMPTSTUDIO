import { describe, it, expect } from 'vitest'
import { lyricsOfItem, styleOfItem, lrcOfItem, LRC_AUTO_VERSION } from './lyricsOf'
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
  it('판이 다른 lrc_auto 는 무시하고, 현재 판만 쓴다', () => {
    expect(lrcOfItem({ form: { lrc_auto: A } })).toBeNull()
    expect(lrcOfItem({ form: { lrc_auto: A, lrc_auto_v: LRC_AUTO_VERSION - 1 } })).toBeNull()
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
})
