import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: any = null
let isAdmin = false
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: isAdmin } }) }) }) }),
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
import { POST, GET } from './route'
import { resetBuckets } from '@/lib/rateLimit'
const req = (body: any) => new Request('https://x.test/api/admin/verify', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '1.2.3.4' } })

beforeEach(() => { user = null; isAdmin = false; resetBuckets(); process.env.ADMIN_SECONDARY_PASSWORD = 'pw-secret' })

describe('POST /api/admin/verify', () => {
  it('비로그인 401 · 일반 사용자 403', async () => {
    expect((await POST(req({ id: 'admin', password: 'pw-secret' }))).status).toBe(401)
    user = { id: 'u' }
    expect((await POST(req({ id: 'admin', password: 'pw-secret' }))).status).toBe(403)
  })
  it('틀린 비밀번호는 401 이고 쿠키가 없다, 5회 실패하면 429', async () => {
    user = { id: 'a' }; isAdmin = true
    for (let i = 0; i < 5; i++) {
      const r = await POST(req({ id: 'admin', password: 'bad' }))
      expect(r.status).toBe(401)
      expect(r.headers.get('set-cookie')).toBeNull()
    }
    expect((await POST(req({ id: 'admin', password: 'pw-secret' }))).status).toBe(429)
  })
  it('맞으면 서명 쿠키(HttpOnly·Strict)를 내려 준다', async () => {
    user = { id: 'a' }; isAdmin = true
    const r = await POST(req({ id: 'admin', password: 'pw-secret' }))
    expect(r.status).toBe(200)
    const c = r.headers.get('set-cookie') || ''
    expect(c).toContain('cm_admin2=')
    expect(c.toLowerCase()).toContain('httponly')
    expect(c.toLowerCase()).toContain('samesite=strict')
  })
  it('GET: 쿠키가 없으면 verified=false', async () => {
    user = { id: 'a' }; isAdmin = true
    expect(await (await GET()).json()).toEqual({ verified: false })
  })
})
