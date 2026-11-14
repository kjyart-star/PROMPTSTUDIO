import { describe, it, expect } from 'vitest'
import { isBannedUser } from './ban'

const db = (res: any) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => res }) }) }) })

describe('isBannedUser', () => {
  it('is_banned=true 면 정지', async () => { expect(await isBannedUser(db({ data: { is_banned: true }, error: null }), 'u')).toBe(true) })
  it('false·행 없음은 정상', async () => {
    expect(await isBannedUser(db({ data: { is_banned: false }, error: null }), 'u')).toBe(false)
    expect(await isBannedUser(db({ data: null, error: null }), 'u')).toBe(false)
  })
  it('조회 오류면 정상으로 본다(중단 방지)', async () => { expect(await isBannedUser(db({ data: null, error: { code: '42703' } }), 'u')).toBe(false) })
})
