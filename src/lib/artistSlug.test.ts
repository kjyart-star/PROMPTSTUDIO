import { describe, it, expect, vi, beforeEach } from 'vitest'

let rows: any[] = []
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => { const o: any = { select: () => o, ilike: () => o, neq: () => o, limit: async () => ({ data: rows }) }; return o } }),
}))
import { HANDLE_RE, legacySlugToHandle, handleClashesWithLegacySlug } from './artistSlug'

beforeEach(() => { rows = []; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://s'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k' })

describe('아티스트 주소', () => {
  it('handle 모양: 영숫자·._- 2~32자', () => {
    for (const ok of ['user-1a2b3c4d', 'ab', 'a.b_c-d']) expect(HANDLE_RE.test(ok)).toBe(true)
    for (const bad of ['a', '-ab', 'a b', 'a/b', 'a@b.c', '', 'x'.repeat(40)]) expect(HANDLE_RE.test(bad)).toBe(false)
  })
  it('옛 주소는 계정이 하나일 때만 새 handle 로', async () => {
    rows = [{ handle: 'user-abcd1234' }]
    expect(await legacySlugToHandle('kjyart')).toBe('user-abcd1234')
    rows = [{ handle: 'a' }, { handle: 'b' }]
    expect(await legacySlugToHandle('kjyart')).toBeNull()
    rows = []
    expect(await legacySlugToHandle('kjyart')).toBeNull()
    rows = [{ handle: 'kjyart' }]
    expect(await legacySlugToHandle('kjyart')).toBeNull()
  })
  it('이상한 slug 는 조회하지 않는다', async () => {
    rows = [{ handle: 'user-1' }]
    expect(await legacySlugToHandle('a/../b')).toBeNull()
  })
  it('남의 옛 주소와 겹치는 handle 은 거절', async () => {
    rows = [{ id: 'other' }]
    expect(await handleClashesWithLegacySlug('kjyart', 'me')).toBe(true)
    rows = []
    expect(await handleClashesWithLegacySlug('fresh-one', 'me')).toBe(false)
  })
})
