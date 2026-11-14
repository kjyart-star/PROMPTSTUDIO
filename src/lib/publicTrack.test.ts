import { describe, expect, it } from 'vitest'
import { isPublicTrackKey, validTrackKey } from './publicTrack'
import { purgeTrackCache } from './cdnPurge'

// 아주 작은 가짜 DB: 체인 어디서든 마지막에 결과를 돌려준다
function fakeDb(songs: { user_id: string }[], banned: string[]) {
  const chain = (result: unknown) => { const c: any = new Proxy(() => {}, { get: (_t, p) => (p === 'then' ? (r: any) => r({ data: result }) : () => c) }); return c }
  return { from: (t: string) => ({ select: () => chain(t === 'song_history' ? songs : banned.map((id) => ({ id }))) }) }
}

describe('공개 음원 판정 (M-7)', () => {
  it('키 모양 검사', () => {
    expect(validTrackKey('audio/a.mp3')).toBe(true)
    for (const k of ['', null, 'audio/../x', 'a\\b', 'x'.repeat(501)]) expect(validTrackKey(k)).toBe(false)
  })
  it('공개 곡 + 정상 주인 → true', async () => {
    expect(await isPublicTrackKey(fakeDb([{ user_id: 'u1' }], []), 'audio/a.mp3')).toBe(true)
  })
  it('공개 행이 없으면(비공개·휴지통·없는 키) false', async () => {
    expect(await isPublicTrackKey(fakeDb([], []), 'audio/a.mp3')).toBe(false)
  })
  it('주인이 정지됐으면 false, 정지 안 된 다른 주인(복사본)이 있으면 true', async () => {
    expect(await isPublicTrackKey(fakeDb([{ user_id: 'u1' }], ['u1']), 'k')).toBe(false)
    expect(await isPublicTrackKey(fakeDb([{ user_id: 'u1' }, { user_id: 'u2' }], ['u1']), 'k')).toBe(true)
  })
})

describe('CDN 퍼지 훅', () => {
  it('자격이 없으면 조용히 건너뛴다', async () => {
    expect(await purgeTrackCache(['audio/a.mp3'], {})).toBe('skipped')
  })
  it('절대 URL·상위 경로 키는 거른다', async () => {
    expect(await purgeTrackCache(['https://x/a.mp3', 'a/../b'], { CF_API_TOKEN: 't', CF_ZONE_ID: 'z', CDN_PURGE_BASE: 'https://c' })).toBe('skipped')
  })
})
