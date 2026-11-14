import { describe, it, expect } from 'vitest'
import nextConfig, { SECURITY_HEADERS } from '../next.config'

describe('보안 헤더 (M-11)', () => {
  it('모든 경로에 걸리고 필수 헤더가 있다', async () => {
    const rules = await nextConfig.headers!()
    expect(rules[0].source).toBe('/:path*')
    const keys = rules[0].headers.map((h) => h.key)
    for (const k of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy-Report-Only']) expect(keys).toContain(k)
  })
  it('프레임은 같은 출처·허브만, nosniff', () => {
    const h = Object.fromEntries(SECURITY_HEADERS.map((x) => [x.key, x.value]))
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN')
    expect(h['Content-Security-Policy-Report-Only']).toContain("frame-ancestors 'self' https://cookieplay.app")
  })
})
