import { describe, it, expect } from 'vitest'
import { validateAudioUrl } from './audioPath'

const U = '11111111-1111-4111-8111-111111111111'
const V = '22222222-2222-4222-8222-222222222222'
const SONG = '33333333-3333-4333-8333-333333333333'
const db = (row: any) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) })

describe('validateAudioUrl', () => {
  it('정상: 비어 있음·외부 https·본인 접두사·본인 곡 경로·공개 곡 경로', async () => {
    expect((await validateAudioUrl(db(null), U, null)).ok).toBe(true)
    expect((await validateAudioUrl(db(null), U, 'https://cdn.example.com/a.mp3')).ok).toBe(true)
    expect((await validateAudioUrl(db(null), U, `audio/${U}/x.mp3`)).ok).toBe(true)
    expect((await validateAudioUrl(db({ id: SONG, user_id: U, is_published: false }), U, `audio/${SONG}.mp3`)).ok).toBe(true)
    expect((await validateAudioUrl(db({ id: SONG, user_id: V, is_published: true }), U, `audio/${SONG}.mp3`)).ok).toBe(true)
  })
  it('거부: 남의 비공개 곡 경로(조회 안 됨)·남의 접두사·상위 경로·http·알 수 없는 형태', async () => {
    expect((await validateAudioUrl(db(null), U, `audio/${SONG}.mp3`)).ok).toBe(false)
    expect((await validateAudioUrl(db({ id: SONG, user_id: V, is_published: false }), U, `audio/${SONG}.mp3`)).ok).toBe(false)
    expect((await validateAudioUrl(db(null), U, `audio/${V}/x.mp3`)).ok).toBe(false)
    expect((await validateAudioUrl(db(null), U, `audio/${U}/../${V}/x.mp3`)).ok).toBe(false)
    expect((await validateAudioUrl(db(null), U, 'http://x/a.mp3')).ok).toBe(false)
    expect((await validateAudioUrl(db(null), U, 'secret/file.mp3')).ok).toBe(false)
    expect((await validateAudioUrl(db(null), U, 123)).ok).toBe(false)
  })
})
