import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: any = null
let isAdmin = false
const writes: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: isAdmin }, error: null }) }) }) }),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => ({ update: (v: any) => { writes.push(`${t}:${JSON.stringify(v)}`); const o: any = { eq: () => o, then: (r: any) => r({ error: null }) }; return o } }) }),
}))
let second = true
vi.mock('@/lib/auth/adminSecond', () => ({ hasAdminSecondFactor: async () => second }))
import { PUT } from './route'
const req = (body: any) => new Request('https://x.test/api/admin/users/ban', { method: 'PUT', body: JSON.stringify(body) })

beforeEach(() => { second = true; user = null; isAdmin = false; writes.length = 0; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://s'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k' })

describe('정지 API', () => {
  it('비로그인 401, 일반 사용자 403, 쓰기 없음', async () => {
    expect((await PUT(req({ target_user_id: 't', is_banned: true }))).status).toBe(401)
    user = { id: 'u' }
    expect((await PUT(req({ target_user_id: 't', is_banned: true }))).status).toBe(403)
    expect(writes).toEqual([])
  })
  it('관리자라도 2차 인증 쿠키가 없으면 403', async () => {
    user = { id: 'a' }; isAdmin = true; second = false
    expect((await PUT(req({ target_user_id: 't', is_banned: true }))).status).toBe(403)
    expect(writes).toEqual([])
  })
  it('관리자도 잘못된 본문·본인 정지는 400', async () => {
    user = { id: 'a' }; isAdmin = true
    expect((await PUT(req({ target_user_id: 't', is_banned: 'yes' }))).status).toBe(400)
    expect((await PUT(req({ target_user_id: 'a', is_banned: true }))).status).toBe(400)
    expect(writes).toEqual([])
  })
  it('관리자 정상 정지: 프로필 + 곡·앨범 비공개', async () => {
    user = { id: 'a' }; isAdmin = true
    expect((await PUT(req({ target_user_id: 't', is_banned: true }))).status).toBe(200)
    expect(writes).toEqual(['profiles:{"is_banned":true}', 'song_history:{"is_published":false}', 'user_playlists:{"is_published":false}'])
  })
})
