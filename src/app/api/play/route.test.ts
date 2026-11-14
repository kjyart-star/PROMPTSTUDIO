import { describe, it, expect, vi, beforeEach } from 'vitest'
const inserts: any[] = []
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (t: string) => ({
      insert: async (v: any) => { inserts.push(v); return { error: null } },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  }),
}))
import { POST } from './route'
import { resetBuckets } from '@/lib/rateLimit'
const T = '33333333-3333-4333-8333-333333333333'
const req = (b: any, ip = '9.9.9.9') => new Request('https://x.test/api/play', { method: 'POST', body: JSON.stringify(b), headers: { 'x-forwarded-for': ip } })
beforeEach(() => { inserts.length = 0; resetBuckets() })

describe('POST /api/play', () => {
  it('잘못된 곡 id·시간은 400', async () => {
    expect((await POST(req({ track_id: 'x', duration_played: 5 }))).status).toBe(400)
    expect((await POST(req({ track_id: T, duration_played: -1 }))).status).toBe(400)
    expect((await POST(req({ track_id: T, duration_played: 999999 }))).status).toBe(400)
  })
  it('같은 IP·같은 곡은 1분에 3번까지만 기록', async () => {
    for (let i = 0; i < 6; i++) expect((await POST(req({ track_id: T, duration_played: 30 }))).status).toBe(200)
    expect(inserts.length).toBe(3)
  })
  it('다른 IP 는 따로 센다', async () => {
    await POST(req({ track_id: T, duration_played: 30 }, '1.1.1.1'))
    await POST(req({ track_id: T, duration_played: 30 }, '2.2.2.2'))
    expect(inserts.length).toBe(2)
  })
})
