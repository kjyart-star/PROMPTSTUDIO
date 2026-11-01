import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LRC_GPU_VERSION, LRC_GPU_MODEL } from '@/lib/studio/lyricsOf'

const SONG = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'x'.repeat(30)
const good = [{ t: 2, text: '첫 줄' }, { t: 20, text: '둘째 줄' }, { t: 41, text: '셋째 줄' }]
let rows: any[]
const updates: any[] = []
const upserts: any[] = []

const db = {
  from: (table: string) => ({
    select: () => ({
      limit: async () => ({ data: rows, error: null }),
      eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: rows.find((r) => r.id === id) ?? null }) }),
    }),
    update: (v: any) => ({ eq: async () => { updates.push({ table, v }); return { error: null } } }),
    upsert: async (v: any) => { upserts.push({ table, v }); return { error: null } },
  }),
  storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signed/${p}` } }) }) },
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
import { GET, POST } from './route'

const req = (method: string, body?: any, token = TOKEN) =>
  new Request('http://x/api/lrc-worker', { method, headers: { 'x-lrc-worker-token': token }, body: body ? JSON.stringify(body) : undefined })

beforeEach(() => {
  process.env.LRC_WORKER_TOKEN = TOKEN
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE = 'https://r2'
  rows = [{ id: SONG, title: 't', created_at: '2026-11-01', lyrics: '첫 줄\n둘째 줄\n셋째 줄', audio_url: 'audio/a.mp3', is_published: false, form: { keep: 1 } }]
  updates.length = 0
  upserts.length = 0
})

describe('/api/lrc-worker', () => {
  it('토큰이 틀리면 401', async () => {
    expect((await GET(req('GET', undefined, 'nope'))).status).toBe(401)
    expect((await POST(req('POST', {}, 'nope'))).status).toBe(401)
  })
  it('GET: 비공개 곡은 서명 주소로 준다', async () => {
    const j = await (await GET(req('GET'))).json()
    expect(j.total).toBe(1)
    expect(j.jobs[0]).toMatchObject({ id: SONG, audio_url: 'https://signed/audio/a.mp3', lines: ['첫 줄', '둘째 줄', '셋째 줄'] })
  })
  it('POST: form 에 새 필드만 더하고 공유 테이블에 upsert', async () => {
    const res = await POST(req('POST', { song_id: SONG, lrc: good, v: LRC_GPU_VERSION, model: LRC_GPU_MODEL }))
    expect(await res.json()).toEqual({ ok: true, stored: true })
    expect(updates[0].v.form).toMatchObject({ keep: 1, lrc_auto_v: LRC_GPU_VERSION, lrc_auto_model: LRC_GPU_MODEL })
    expect(upserts[0].v).toMatchObject({ song_id: SONG, v: LRC_GPU_VERSION, model: LRC_GPU_MODEL })
  })
  it('POST: 줄 끝·신뢰도는 lrc_auto 에, 단어 시각은 lrc_auto_words 에 따로 저장', async () => {
    const lrc = good.map((l) => ({ ...l, end: l.t + 3, conf: 0.8 }))
    const words = [[[2, 2.5, '첫']], [[20, 21, '둘째']], [[41, 42, '셋째']]]
    await POST(req('POST', { song_id: SONG, lrc, v: LRC_GPU_VERSION, model: LRC_GPU_MODEL, words }))
    expect(updates[0].v.form.lrc_auto[0]).toEqual({ t: 2, text: '첫 줄', end: 5, conf: 0.8 })
    expect(updates[0].v.form.lrc_auto_words).toEqual(words)
  })
  it('POST: 가사와 다르면 422, 사용자 시간표가 있으면 저장하지 않는다', async () => {
    expect((await POST(req('POST', { song_id: SONG, lrc: good.slice(0, 2).concat([{ t: 50, text: '다른 줄' }]), v: LRC_GPU_VERSION, model: LRC_GPU_MODEL }))).status).toBe(422)
    rows[0].form = { lrc: good, lrc_by: 'user' }
    expect(await (await POST(req('POST', { song_id: SONG, lrc: good, v: LRC_GPU_VERSION, model: LRC_GPU_MODEL }))).json()).toMatchObject({ stored: false })
    expect(updates).toHaveLength(0)
  })
  it('POST failed: 접은 표시만 남기고 공유 테이블은 건드리지 않으며, 다음 목록에서 빠진다', async () => {
    const r = await (await POST(req('POST', { song_id: SONG, failed: true, reason: 'x', v: LRC_GPU_VERSION, model: LRC_GPU_MODEL }))).json()
    expect(r).toMatchObject({ failed: true })
    expect(updates[0].v.form).toMatchObject({ keep: 1, lrc_auto_fail: { v: LRC_GPU_VERSION, reason: 'x' } })
    expect(upserts).toHaveLength(0)
    rows[0].form = updates[0].v.form
    const j = await (await GET(req('GET'))).json()
    expect(j).toMatchObject({ total: 1, done: 0, failed: 1, pending: 0 })
  })
})
