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
      select: () => ({ eq: (_c: string, id: string) => ({
        eq: (_c2: string, v: number) => ({ maybeSingle: async () => ({ data: stored.find((r) => r.song_id === id && r.v === v) ?? null, error: null }) }),
        gte: (_c2: string, lo: number) => ({ lte: (_c3: string, hi: number) => ({ order: () => ({ limit: () => ({
          maybeSingle: async () => ({ data: stored.filter((r) => r.song_id === id && r.v >= lo && r.v <= hi).sort((a, b) => b.v - a.v)[0] ?? null, error: null }),
        }) }) }) }),
      }) }),
      insert: async (row: any) => { if (insertError) return { error: insertError }; inserted.push(row); stored.push(row); return { error: null } },
    }
  },
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

// 제출 표(서버 전용) — song_lrc_submissions 흉내
let subs: any[] = []
const adminDb = {
  from: (table: string) => table === 'song_lrc_auto' ? supa.from(table) : ({
    upsert: async (row: any) => { subs = subs.filter((r) => !(r.song_id === row.song_id && r.v === row.v && r.user_id === row.user_id)); subs.push(row); return { error: null } },
    select: () => ({ eq: (_c: string, id: string) => ({ eq: (_c2: string, v: number) => ({ neq: (_c3: string, uid: string) => ({
      limit: async () => ({ data: subs.filter((r) => r.song_id === id && r.v === v && r.user_id !== uid), error: null }),
    }) }) }) }),
  }),
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => adminDb }))
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa'
import { GET, POST } from './route'

const post = (body: any) => POST(new Request('http://x/api/song-lrc-auto', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  user = { id: 'u1' }
  songRow = { id: SONG, is_published: true, lyrics, form: {}, user_id: 'u1' }
  subs = []
  stored = []
  inserted.length = 0
  insertError = null
})

describe('POST /api/song-lrc-auto', () => {
  it('로그인하지 않으면 401', async () => {
    user = null
    expect((await post({ song_id: SONG, lrc: good, v: 5 })).status).toBe(401)
  })
  it('곡 주인의 유효한 결과는 바로 공개 결과로 저장한다', async () => {
    const res = await post({ song_id: SONG, lrc: good, v: 5 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, stored: true })
    expect(inserted[0]).toMatchObject({ song_id: SONG, v: 5, submitted_by: 'u1', model: 'browser-whisper-base' })
    expect(inserted[0].lrc).toHaveLength(3)
  })
  it('비공개 곡이거나 없는 곡이면 404', async () => {
    songRow = { ...songRow, is_published: false }
    expect((await post({ song_id: SONG, lrc: good, v: 5 })).status).toBe(404)
    songRow = null
    expect((await post({ song_id: SONG, lrc: good, v: 5 })).status).toBe(404)
  })
  it('판 번호가 다르면 409, 곡 id 형식이 틀리면 400', async () => {
    expect((await post({ song_id: SONG, lrc: good, v: 1 })).status).toBe(409)
    expect((await post({ song_id: 'nope', lrc: good, v: 5 })).status).toBe(400)
  })
  it('시간이 거꾸로이거나 가사와 다르면 422 이고 저장하지 않는다', async () => {
    const back = [good[0], { t: 1, text: '둘째 줄입니다' }, good[2]]
    const r1 = await post({ song_id: SONG, lrc: back, v: 5 })
    expect(r1.status).toBe(422)
    expect((await r1.json()).reason).toBe('not-monotonic')
    const other = [good[0], { t: 20, text: '다른 줄' }, good[2]]
    expect((await (await post({ song_id: SONG, lrc: other, v: 5 })).json()).reason).toBe('lyrics-mismatch')
    expect(inserted).toHaveLength(0)
  })
  it('곡 길이 범위를 벗어나면 422', async () => {
    songRow = { ...songRow, form: { duration_sec: 30 } }
    expect((await (await post({ song_id: SONG, lrc: good, v: 5 })).json()).reason).toBe('beyond-duration')
  })
  it('이미 있으면 첫 값을 지키고 새로 쓰지 않는다 (동시 제출 충돌도 같다)', async () => {
    stored.push({ song_id: SONG, v: 5, lrc: good })
    expect(await (await post({ song_id: SONG, lrc: good, v: 5 })).json()).toEqual({ ok: true, stored: false })
    expect(inserted).toHaveLength(0)
    stored.length = 0
    insertError = { code: '23505', message: 'dup' }
    expect(await (await post({ song_id: SONG, lrc: good, v: 5 })).json()).toEqual({ ok: true, stored: false })
  })
  it('원곡 song_history 는 수정하지 않는다 (update 를 부르지 않음)', async () => {
    const spy = vi.spyOn(supa, 'from')
    await post({ song_id: SONG, lrc: good, v: 5 })
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['song_history', 'song_lrc_auto', 'song_lrc_auto'])
    expect(spy.mock.calls.map((c) => c[0])).not.toContain('song_lrc_submissions') // 곡 주인은 제출 표를 거치지 않는다
  })
})

describe('POST /api/song-lrc-auto — 남의 공개 곡은 두 사람이 일치해야 공개', () => {
  const near = good.map((l) => ({ ...l, t: l.t + 0.6 }))
  const far = good.map((l) => ({ ...l, t: l.t + 3 }))
  beforeEach(() => { songRow = { ...songRow, user_id: 'owner' } })
  it('첫 제출은 남겨 두기만 하고 공개 결과로 쓰지 않는다', async () => {
    expect(await (await post({ song_id: SONG, lrc: good, v: 5 })).json()).toEqual({ ok: true, stored: false, pending: true })
    expect(inserted).toHaveLength(0)
    expect(subs).toHaveLength(1)
  })
  it('같은 사람이 다시 내도 일치로 치지 않는다', async () => {
    await post({ song_id: SONG, lrc: good, v: 5 })
    expect((await (await post({ song_id: SONG, lrc: near, v: 5 })).json()).pending).toBe(true)
    expect(inserted).toHaveLength(0)
  })
  it('다른 사람 결과와 1초 안에서 일치하면 공개 결과로 저장한다', async () => {
    await post({ song_id: SONG, lrc: good, v: 5 })
    user = { id: 'u2' }
    expect(await (await post({ song_id: SONG, lrc: near, v: 5 })).json()).toEqual({ ok: true, stored: true, agreed: true })
    expect(inserted[0]).toMatchObject({ song_id: SONG, v: 5, submitted_by: 'u2' })
  })
  it('다른 사람 결과와 1초 넘게 어긋나면 공개하지 않는다', async () => {
    await post({ song_id: SONG, lrc: good, v: 5 })
    user = { id: 'u2' }
    expect((await (await post({ song_id: SONG, lrc: far, v: 5 })).json()).pending).toBe(true)
    expect(inserted).toHaveLength(0)
  })
})

describe('GET /api/song-lrc-auto', () => {
  it('저장된 결과를 돌려주고 없으면 404', async () => {
    stored.push({ song_id: SONG, v: 3, lrc: good })
    // 판 4 를 요청해도 다시 계산되기 전의 판 3 결과를 받는다
    const hit = await GET(new Request(`http://x/api/song-lrc-auto?id=${SONG}&v=4`))
    expect(hit.status).toBe(200)
    expect((await hit.json()).lrc).toHaveLength(3)
    expect((await GET(new Request(`http://x/api/song-lrc-auto?id=${SONG}&v=1`))).status).toBe(404)
    expect((await GET(new Request('http://x/api/song-lrc-auto?id=bad'))).status).toBe(400)
  })
})
