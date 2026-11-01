import { describe, it, expect, vi, beforeEach } from 'vitest'

const SONG = '11111111-1111-4111-8111-111111111111'
const lyrics = '[Verse]\n첫 줄입니다\n둘째 줄입니다\n셋째 줄입니다'
const good = [{ t: 2, text: '첫 줄입니다' }, { t: 20, text: '둘째 줄입니다' }, { t: 41, text: '셋째 줄입니다' }]

let user: any
let songRow: any
let stored: any[]
let insertError: any
const inserted: any[] = []

const supa = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: (table: string) => {
    if (table === 'song_history') {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: songRow, error: null }) }) }) }
    }
    return {
      select: () => ({ eq: (_c: string, id: string) => ({ eq: (_c2: string, v: number) => ({ maybeSingle: async () => ({ data: stored.find((r) => r.song_id === id && r.v === v) ?? null, error: null }) }) }) }),
      insert: async (row: any) => { if (insertError) return { error: insertError }; inserted.push(row); stored.push(row); return { error: null } },
    }
  },
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))
import { GET, POST } from './route'

const post = (body: any) => POST(new Request('http://x/api/song-lrc-auto', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  user = { id: 'u1' }
  songRow = { id: SONG, is_published: true, lyrics, form: {} }
  stored = []
  inserted.length = 0
  insertError = null
})

describe('POST /api/song-lrc-auto', () => {
  it('로그인하지 않으면 401', async () => {
    user = null
    expect((await post({ song_id: SONG, lrc: good, v: 2 })).status).toBe(401)
  })
  it('공개 곡의 유효한 결과를 제출자와 함께 저장한다', async () => {
    const res = await post({ song_id: SONG, lrc: good, v: 2 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, stored: true })
    expect(inserted[0]).toMatchObject({ song_id: SONG, v: 2, submitted_by: 'u1', model: 'whisper-small-dtw' })
    expect(inserted[0].lrc).toHaveLength(3)
  })
  it('비공개 곡이거나 없는 곡이면 404', async () => {
    songRow = { ...songRow, is_published: false }
    expect((await post({ song_id: SONG, lrc: good, v: 2 })).status).toBe(404)
    songRow = null
    expect((await post({ song_id: SONG, lrc: good, v: 2 })).status).toBe(404)
  })
  it('판 번호가 다르면 409, 곡 id 형식이 틀리면 400', async () => {
    expect((await post({ song_id: SONG, lrc: good, v: 1 })).status).toBe(409)
    expect((await post({ song_id: 'nope', lrc: good, v: 2 })).status).toBe(400)
  })
  it('시간이 거꾸로이거나 가사와 다르면 422 이고 저장하지 않는다', async () => {
    const back = [good[0], { t: 1, text: '둘째 줄입니다' }, good[2]]
    const r1 = await post({ song_id: SONG, lrc: back, v: 2 })
    expect(r1.status).toBe(422)
    expect((await r1.json()).reason).toBe('not-monotonic')
    const other = [good[0], { t: 20, text: '다른 줄' }, good[2]]
    expect((await (await post({ song_id: SONG, lrc: other, v: 2 })).json()).reason).toBe('lyrics-mismatch')
    expect(inserted).toHaveLength(0)
  })
  it('곡 길이 범위를 벗어나면 422', async () => {
    songRow = { ...songRow, form: { duration_sec: 30 } }
    expect((await (await post({ song_id: SONG, lrc: good, v: 2 })).json()).reason).toBe('beyond-duration')
  })
  it('이미 있으면 첫 값을 지키고 새로 쓰지 않는다 (동시 제출 충돌도 같다)', async () => {
    stored.push({ song_id: SONG, v: 2, lrc: good })
    expect(await (await post({ song_id: SONG, lrc: good, v: 2 })).json()).toEqual({ ok: true, stored: false })
    expect(inserted).toHaveLength(0)
    stored.length = 0
    insertError = { code: '23505', message: 'dup' }
    expect(await (await post({ song_id: SONG, lrc: good, v: 2 })).json()).toEqual({ ok: true, stored: false })
  })
  it('원곡 song_history 는 수정하지 않는다 (update 를 부르지 않음)', async () => {
    const spy = vi.spyOn(supa, 'from')
    await post({ song_id: SONG, lrc: good, v: 2 })
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['song_history', 'song_lrc_auto', 'song_lrc_auto'])
  })
})

describe('GET /api/song-lrc-auto', () => {
  it('저장된 결과를 돌려주고 없으면 404', async () => {
    stored.push({ song_id: SONG, v: 2, lrc: good })
    const hit = await GET(new Request(`http://x/api/song-lrc-auto?id=${SONG}&v=2`))
    expect(hit.status).toBe(200)
    expect((await hit.json()).lrc).toHaveLength(3)
    expect((await GET(new Request(`http://x/api/song-lrc-auto?id=${SONG}&v=1`))).status).toBe(404)
    expect((await GET(new Request('http://x/api/song-lrc-auto?id=bad'))).status).toBe(400)
  })
})
