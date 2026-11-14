import { describe, it, expect } from 'vitest'
import { passwordProblem, siteOrigin } from './siteOrigin'

const req = (host: string, fwd?: string) => new Request('https://x.test/', { headers: { host, ...(fwd ? { 'x-forwarded-host': fwd } : {}) } })

describe('가입·콜백 오리진 (M-10)', () => {
  it('허용 호스트는 그대로, 임의 Host 는 운영 도메인으로 고정', () => {
    expect(siteOrigin(req('cookieplay.app'), {})).toBe('https://cookieplay.app')
    expect(siteOrigin(req('x', 'evil.example'), {})).toBe('https://cookieplay.app')
    expect(siteOrigin(req('evil.example'), {})).toBe('https://cookieplay.app')
    expect(siteOrigin(req('cookieplay.app.evil.com'), {})).toBe('https://cookieplay.app')
  })
  it('localhost 는 개발에서만', () => {
    expect(siteOrigin(req('localhost:3000'), { NODE_ENV: 'development' })).toBe('http://localhost:3000')
    expect(siteOrigin(req('localhost:3000'), { NODE_ENV: 'production' })).toBe('https://cookieplay.app')
  })
  it('SITE_ORIGIN 이 있으면 우선', () => {
    expect(siteOrigin(req('evil.example'), { SITE_ORIGIN: 'https://cookieplay.app/' })).toBe('https://cookieplay.app')
  })
})

describe('비밀번호 규칙 (M-10)', () => {
  it('거부: 9자 이하·흔한 값·반복·이메일 포함', () => {
    expect(passwordProblem('short123', 'a@b.c')).toBeTruthy()
    expect(passwordProblem('1234567890', 'a@b.c')).toBeTruthy()
    expect(passwordProblem('aaaaaaaaaaaa', 'a@b.c')).toBeTruthy()
    expect(passwordProblem('myjohnsmith2026!', 'johnsmith@x.com')).toBeTruthy()
  })
  it('정상: 10자 이상 평범한 값', () => {
    expect(passwordProblem('plum-River-47x', 'a@b.c')).toBeNull()
  })
})
