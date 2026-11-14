import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: string[] = []
let handle: string | null = 'deleted-abc'
let authError: { status: number } | null = null
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: handle === null ? null : { handle }, error: null }) }) }) }),
    auth: { admin: { updateUserById: async (id: string, a: any) => { calls.push(`${id}:${JSON.stringify(a)}`); return { error: authError } } } },
  }),
}))
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://s.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test'
process.env.COOKIEPLAY_SERVICE_TOKEN = 'svc-token-test'

import { POST } from './route'
const U = '11111111-1111-4111-8111-111111111111'
const call = (action: string, headers: Record<string, string>, body: unknown = { userId: U }) =>
  POST(new Request('https://x.test/music/api/internal/account/x', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({ action }) })
const OK = { 'x-service-token': 'svc-token-test' }

beforeEach(() => { calls.length = 0; handle = 'deleted-abc'; authError = null })

describe('내부 탈퇴 연동 라우트', () => {
  it('토큰이 없거나 틀리면 401, 아무것도 호출하지 않는다', async () => {
    expect((await call('restore', {})).status).toBe(401)
    expect((await call('restore', { 'x-service-token': 'bad' })).status).toBe(401)
    expect(calls).toEqual([])
  })
  it('알 수 없는 동작은 404, 사용자 id 형식이 틀리면 400', async () => {
    expect((await call('wipe', OK)).status).toBe(404)
    expect((await call('restore', OK, { userId: 'x' })).status).toBe(400)
    expect(calls).toEqual([])
  })
  it('탈퇴 처리되지 않은 계정은 409 — 멀쩡한 계정을 건드리지 못한다', async () => {
    handle = 'someone'
    expect((await call('finalize', OK)).status).toBe(409)
    handle = null
    expect((await call('restore', OK)).status).toBe(409)
    expect(calls).toEqual([])
  })
  it('restore: 로그인 정지만 푼다', async () => {
    expect((await call('restore', OK)).status).toBe(200)
    expect(calls).toEqual([`${U}:{"ban_duration":"none"}`])
  })
  it('finalize: 원래 이메일을 익명 값으로 바꾼다(계정 삭제 없음)', async () => {
    expect((await call('finalize', OK)).status).toBe(200)
    expect(calls[0]).toMatch(new RegExp(`^${U}:\\{"email":"deleted-[0-9a-f]{12}@deleted\\.invalid","email_confirm":true\\}$`))
  })
  it('Supabase 가 실패하면 502 (워커가 재시도)', async () => {
    authError = { status: 500 }
    expect((await call('restore', OK)).status).toBe(502)
    expect((await call('finalize', OK)).status).toBe(502)
  })
})
