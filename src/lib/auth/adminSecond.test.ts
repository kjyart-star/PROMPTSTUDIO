import { describe, it, expect } from 'vitest'
import { signAdminToken, verifyAdminToken, safeEqualStr, ADMIN2_TTL_SEC } from './adminSecond'
import { hit, isBlocked, resetBuckets } from '../rateLimit'

const SECRET = 'test-secret-value'
describe('관리자 2차 인증 토큰', () => {
  it('정상: 같은 사용자·비밀·기한 안', () => {
    const t = signAdminToken('u1', SECRET, 1_000_000)
    expect(verifyAdminToken(t, 'u1', SECRET, 1_000_000 + 1000)).toBe(true)
  })
  it('거부: 다른 사용자·다른 비밀·만료·변조·빈 값', () => {
    const t = signAdminToken('u1', SECRET, 1_000_000)
    expect(verifyAdminToken(t, 'u2', SECRET, 1_001_000)).toBe(false)
    expect(verifyAdminToken(t, 'u1', 'other', 1_001_000)).toBe(false)
    expect(verifyAdminToken(t, 'u1', SECRET, 1_000_000 + (ADMIN2_TTL_SEC + 1) * 1000)).toBe(false)
    const [uid, exp, sig] = t.split('.')
    expect(verifyAdminToken(`${uid}.${Number(exp) + 99999}.${sig}`, 'u1', SECRET, 1_001_000)).toBe(false)
    expect(verifyAdminToken('', 'u1', SECRET)).toBe(false)
    expect(verifyAdminToken(t, 'u1', undefined)).toBe(false)
  })
  it('상수 시간 비교: 길이가 달라도 안전하게 false', () => {
    expect(safeEqualStr('a', 'abc')).toBe(false)
    expect(safeEqualStr('abc', 'abc')).toBe(true)
  })
})

describe('속도 제한', () => {
  it('한도까지 허용하고 넘으면 거부, 창이 지나면 초기화', () => {
    resetBuckets()
    expect(hit('k', 2, 1000, 0)).toBe(true)
    expect(hit('k', 2, 1000, 1)).toBe(true)
    expect(hit('k', 2, 1000, 2)).toBe(false)
    expect(isBlocked('k', 2, 3)).toBe(true)
    expect(hit('k', 2, 1000, 1500)).toBe(true)
  })
})
