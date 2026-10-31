import { describe, it, expect } from 'vitest'
import { lyricsOfItem, styleOfItem } from './lyricsOf'
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
