import { beforeEach, describe, expect, it, vi } from 'vitest'

let sessionUser: { id: string } | null = null
const calls: string[] = []
let workerDone = true
let channelError: { code: string } | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: sessionUser } }),
      getSession: async () => ({ data: { session: sessionUser ? { access_token: 'tok-session' } : null } }),
    },
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (t: string) => ({ data: { user: t === 'good' ? { id: 'u-bearer' } : null } }),
      admin: {
        updateUserById: async (id: string, attrs: any) => { calls.push(`ban:${id}:${attrs.ban_duration}`); return { error: null } },
        signOut: async () => ({ error: null }),
      },
    },
    from: (t: string) => ({ update: (v: any) => ({ eq: async (c: string, id: string) => {
      if (t === 'artists') { calls.push(`channel:${c}:${id}:${v.name}:${v.bio}:${v.avatar_url}:${v.banner_url}:${JSON.stringify(v.links)}`); return { error: channelError } }
      calls.push(`profile:${t}:${id}:${v.display_name}`); return { error: null }
    } }) }),
  }),
}))
vi.stubGlobal('fetch', vi.fn(async () => {
  calls.push('worker')
  return new Response(JSON.stringify({ done: workerDone }), { status: 200 })
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://s.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-test'

import { POST, } from './route'
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://cookieplay.app/music/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

beforeEach(() => { sessionUser = null; calls.length = 0; workerDone = true; channelError = null })

describe('POST /api/account/delete', () => {
  it('비로그인 401 — 아무것도 호출하지 않는다', async () => {
    expect((await POST(req({ confirm: '계정 삭제' }))).status).toBe(401)
    expect(calls).toEqual([])
  })
  it('다른 사이트 Origin 은 403', async () => {
    sessionUser = { id: 'u1' }
    expect((await POST(req({ confirm: '계정 삭제' }, { origin: 'https://evil.example' }))).status).toBe(403)
    expect(calls).toEqual([])
  })
  it('확인 문구가 틀리면 400, 아무것도 바뀌지 않는다', async () => {
    sessionUser = { id: 'u1' }
    expect((await POST(req({ confirm: '삭제' }))).status).toBe(400)
    expect(calls).toEqual([])
  })
  it('세션 사용자: 워커 → 프로필 익명화 → 계정 정지 순서', async () => {
    sessionUser = { id: 'u1' }
    const res = await POST(req({ confirm: '계정 삭제' }, { origin: 'https://cookieplay.app' }))
    expect(res.status).toBe(200)
    expect(calls[0]).toBe('worker')
    expect(calls[1]).toBe('profile:profiles:u1:탈퇴한 사용자')
    expect(calls[2]).toBe('channel:owner_user_id:u1:탈퇴한 사용자:null:null:null:{}')
    expect(calls[3]).toBe('ban:u1:876000h')
  })
  it('공개 채널 익명화가 실패하면 502 이고 계정 정지는 하지 않는다(재호출로 이어짐)', async () => {
    sessionUser = { id: 'u1' }
    channelError = { code: 'x' }
    const res = await POST(req({ confirm: '계정 삭제' }))
    expect(res.status).toBe(502)
    expect(calls.some((c) => c.startsWith('ban:'))).toBe(false)
  })
  it('Bearer 토큰(쿠키드림)도 같은 흐름, 틀린 토큰은 401', async () => {
    expect((await POST(req({ confirm: '계정 삭제' }, { authorization: 'Bearer bad' }))).status).toBe(401)
    const ok = await POST(req({ confirm: '계정 삭제' }, { authorization: 'Bearer good' }))
    expect(ok.status).toBe(200)
    expect(calls.some((c) => c.startsWith('ban:u-bearer'))).toBe(true)
  })
  it('워커가 끝나지 않으면 502 이고 프로필·계정은 건드리지 않는다', async () => {
    sessionUser = { id: 'u1' }
    workerDone = false
    const res = await POST(req({ confirm: '계정 삭제' }))
    expect(res.status).toBe(502)
    expect(calls.every((c) => c === 'worker')).toBe(true)
  })
})
