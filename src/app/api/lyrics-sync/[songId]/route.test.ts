import { describe, it, expect, vi, beforeEach } from 'vitest'

const SONG = '11111111-1111-4111-8111-111111111111'
const lines = [{ t: 2, text: '첫 줄' }, { t: 20, text: '둘째 줄' }]
let songRow: any
let shared: any
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (t: string) => t === 'song_history'
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: songRow }) }) }) }
      : { select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: shared }) }) }) }) }) }) }) },
  }),
}))
import { GET } from './route'
const get = (h: Record<string, string> = {}) => GET(new Request(`http://x/api/lyrics-sync/${SONG}`, { headers: h }), { params: Promise.resolve({ songId: SONG }) })

beforeEach(() => { songRow = { id: SONG, form: {} }; shared = null })

describe('GET /api/lyrics-sync/{songId} (웹·앱 공용 시간표)', () => {
  it('사람이 고친 시간표가 최우선', async () => {
    songRow.form = { lrc_by: 'user', lrc: lines, lrc_auto: [{ t: 9, text: 'x' }, { t: 19, text: 'y' }], lrc_auto_v: 5 }
    const b = await (await get()).json()
    expect(b).toMatchObject({ source: 'user', lines })
  })
  it('곡 기록의 자동 결과를 단어 시각과 함께 준다', async () => {
    songRow.form = { lrc_auto: lines, lrc_auto_v: 4, lrc_auto_model: 'gpu-whisper-large-v3', lrc_auto_words: [[[2, 3, 'a']], [[20, 21, 'b']]] }
    const b = await (await get()).json()
    expect(b).toMatchObject({ source: 'auto', v: 4, lines, model: 'gpu-whisper-large-v3' })
    expect(b.words).toHaveLength(2)
  })
  it('곡 기록에 없으면 공개 결과', async () => {
    shared = { lrc: lines, v: 5, model: 'browser-whisper-base' }
    expect(await (await get()).json()).toMatchObject({ source: 'auto', v: 5, lines })
  })
  it('같은 값이면 ETag 로 304', async () => {
    shared = { lrc: lines, v: 5, model: 'm' }
    const r1 = await get()
    const tag = r1.headers.get('etag')!
    expect(tag).toMatch(/^W\//)
    expect((await get({ 'if-none-match': tag })).status).toBe(304)
  })
  it('처리 중인 곡은 pending, 접은 곡은 failed, 없으면 404', async () => {
    songRow.form = { publish_pending: { at: '2026-11-02T00:00:00Z' } }
    const p = await get()
    expect(p.status).toBe(404)
    expect((await p.json()).pending).toBe(true)
    songRow.form = { lrc_auto_fail: { v: 4 }, lrc_auto: lines, lrc_auto_v: 4 }
    expect((await (await get()).json()).failed).toBe(true)
    songRow = null
    expect((await get()).status).toBe(404)
  })
})
