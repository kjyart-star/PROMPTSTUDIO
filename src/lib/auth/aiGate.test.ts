import { describe, it, expect, vi, beforeEach } from 'vitest'

let user: any = { id: 'u1' }
let profile: any = { is_admin: false, is_banned: false }
let open = false
vi.mock('@/lib/studio/openSwitch', () => ({ isStudioOpen: async () => open }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }), maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  }),
}))
import { requireAiAccess, hasAiAccess } from './aiGate'

beforeEach(() => { user = { id: 'u1' }; profile = { is_admin: false, is_banned: false }; open = false })

describe('스튜디오 공개 스위치 문', () => {
  it('비로그인은 늘 401', async () => {
    user = null
    for (const o of [false, true]) { open = o; const g: any = await requireAiAccess('x'); expect(g.ok).toBe(false); expect(g.response.status).toBe(401) }
  })
  it('꺼져 있으면 일반 사용자는 403(오픈 전)', async () => {
    const g: any = await requireAiAccess('x')
    expect(g.ok).toBe(false); expect(g.response.status).toBe(403)
    expect(await hasAiAccess()).toBe(false)
  })
  it('꺼져 있어도 관리자는 통과', async () => {
    profile = { is_admin: true }
    expect((await requireAiAccess('x')).ok).toBe(true)
  })
  it('켜지면 로그인한 일반 사용자도 통과', async () => {
    open = true
    expect((await requireAiAccess('x')).ok).toBe(true)
    expect(await hasAiAccess()).toBe(true)
  })
  it('켜져 있어도 차단 계정은 403', async () => {
    open = true; profile = { is_banned: true }
    const g: any = await requireAiAccess('x')
    expect(g.ok).toBe(false); expect(g.response.status).toBe(403)
  })
})
