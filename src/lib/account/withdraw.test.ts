import { describe, expect, it, vi } from 'vitest'
import { anonymizedChannel, anonymizedProfile, originAllowed, runWithdrawal } from './withdraw'

const deps = (over: Record<string, any> = {}) => ({
  callWorker: vi.fn(async () => ({ ok: true as const, done: true })),
  anonymizeProfile: vi.fn(async () => true),
  disableAuth: vi.fn(async () => true),
  ...over,
})

describe('runWithdrawal', () => {
  it('워커 → 프로필 → 계정 정지 순서로 끝낸다', async () => {
    const d = deps()
    expect(await runWithdrawal(d)).toEqual({ ok: true })
    const order = (f: any) => f.mock.invocationCallOrder[0]
    expect(order(d.callWorker)).toBeLessThan(order(d.anonymizeProfile))
    expect(order(d.anonymizeProfile)).toBeLessThan(order(d.disableAuth))
  })
  it('워커가 done:false 를 돌려주면 done:true 가 될 때까지 반복한다', async () => {
    let n = 0
    const d = deps({ callWorker: vi.fn(async () => ({ ok: true as const, done: ++n >= 3 })) })
    expect((await runWithdrawal(d)).ok).toBe(true)
    expect(d.callWorker).toHaveBeenCalledTimes(3)
  })
  it('끝없이 done:false 면 상한에서 멈추고 프로필·계정은 건드리지 않는다', async () => {
    const d = deps({ callWorker: vi.fn(async () => ({ ok: true as const, done: false })) })
    const out = await runWithdrawal(d, 4)
    expect(out).toMatchObject({ ok: false, step: 'worker', retryable: true })
    expect(d.callWorker).toHaveBeenCalledTimes(4)
    expect(d.anonymizeProfile).not.toHaveBeenCalled()
    expect(d.disableAuth).not.toHaveBeenCalled()
  })
  it('워커 실패면 재시도 가능 오류, 계정 정지는 하지 않는다 / 관리자(409)는 재시도 불가', async () => {
    const d = deps({ callWorker: vi.fn(async () => ({ ok: false as const, status: 500 })) })
    expect(await runWithdrawal(d)).toMatchObject({ ok: false, step: 'worker', retryable: true })
    expect(d.disableAuth).not.toHaveBeenCalled()
    const a = deps({ callWorker: vi.fn(async () => ({ ok: false as const, status: 409 })) })
    expect(await runWithdrawal(a)).toMatchObject({ ok: false, status: 409, retryable: false })
  })
  it('프로필 익명화가 실패하면 계정 정지는 하지 않는다', async () => {
    const d = deps({ anonymizeProfile: vi.fn(async () => false) })
    expect(await runWithdrawal(d)).toMatchObject({ ok: false, step: 'profile', retryable: true })
    expect(d.disableAuth).not.toHaveBeenCalled()
  })
  it('계정 정지가 실패하면 재시도 가능 오류 (앞 단계는 멱등)', async () => {
    expect(await runWithdrawal(deps({ disableAuth: vi.fn(async () => false) }))).toMatchObject({ ok: false, step: 'auth', retryable: true })
  })
})

describe('originAllowed', () => {
  it('운영 도메인·서브도메인과 Origin 없음은 허용, 남의 사이트는 거부', () => {
    expect(originAllowed(null, 'production')).toBe(true)
    expect(originAllowed('https://cookieplay.app', 'production')).toBe(true)
    expect(originAllowed('https://music.cookieplay.app', 'production')).toBe(true)
    expect(originAllowed('https://evil.example', 'production')).toBe(false)
    expect(originAllowed('https://cookieplay.app.evil.example', 'production')).toBe(false)
    expect(originAllowed('http://cookieplay.app', 'production')).toBe(false)
    expect(originAllowed('http://localhost:3000', 'production')).toBe(false)
    expect(originAllowed('http://localhost:3000', 'development')).toBe(true)
  })
})

describe('anonymizedProfile', () => {
  it('같은 id 는 같은 값, 이름은 「탈퇴한 사용자」, 개인 항목은 비운다', () => {
    const a = anonymizedProfile('abc123')
    expect(a).toEqual(anonymizedProfile('abc123'))
    expect(a.display_name).toBe('탈퇴한 사용자')
    expect(a.avatar_url).toBeNull()
    expect(a.bio).toBeNull()
    expect(a.handle).toBe('deleted-abc123')
    expect(a.email.endsWith('@deleted.invalid')).toBe(true)
  })
})

describe('anonymizedChannel', () => {
  it('이름은 「탈퇴한 사용자」, 소개·아바타·배너·외부 링크는 비운다', () => {
    expect(anonymizedChannel()).toEqual({ name: '탈퇴한 사용자', bio: null, avatar_url: null, banner_url: null, links: {} })
  })
})
