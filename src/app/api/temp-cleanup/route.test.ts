import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: any = null
let isAdmin = false
const deleted: string[] = []
const chain = (tag: string) => { const o: any = { delete: () => { deleted.push(tag); return o }, is: () => o, eq: () => o, lt: () => o, then: (r: any) => r({ error: null }) }; return o }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (t: string) => t === 'profiles'
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: isAdmin } }) }) }) }
      : chain('user'),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => chain('cron') }) }))

import { GET, POST } from './route'
const req = (init: any = {}) => new Request('https://x.test/music/api/temp-cleanup', { method: 'POST', ...init })

beforeEach(() => { user = null; isAdmin = false; deleted.length = 0
  process.env.CRON_SECRET = 'cron-secret-value'; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://s'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k' })

describe('temp-cleanup', () => {
  it('GET 은 삭제하지 않고 405', async () => { expect((await GET()).status).toBe(405); expect(deleted).toEqual([]) })
  it('비로그인 401, 일반 사용자 403, 다른 출처 403', async () => {
    expect((await POST(req())).status).toBe(401)
    user = { id: 'u' }
    expect((await POST(req())).status).toBe(403)
    isAdmin = true
    expect((await POST(req({ headers: { origin: 'https://evil.test' } }))).status).toBe(403)
    expect(deleted).toEqual([])
  })
  it('틀린 크론 비밀은 거부', async () => {
    expect((await POST(req({ headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
    expect(deleted).toEqual([])
  })
  it('관리자와 올바른 크론 비밀은 통과', async () => {
    user = { id: 'a' }; isAdmin = true
    expect((await POST(req({ body: '{}' }))).status).toBe(200)
    expect((await POST(req({ headers: { authorization: 'Bearer cron-secret-value' } }))).status).toBe(200)
    expect(deleted).toEqual(['user', 'cron'])
  })
})
