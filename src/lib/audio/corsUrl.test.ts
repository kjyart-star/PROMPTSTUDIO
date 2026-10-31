import { describe, it, expect } from 'vitest'
import { withCorsCacheKey, bustCorsCacheKey } from './corsUrl'

describe('withCorsCacheKey', () => {
  it('쿼리 없는 http 주소에는 ? 로 붙인다', () => {
    expect(withCorsCacheKey('https://cookiemusic-cdn.kjyart.workers.dev/audio/a.mp3')).toBe('https://cookiemusic-cdn.kjyart.workers.dev/audio/a.mp3?cors=1')
  })
  it('서명 주소는 & 로 이어 붙이고 token 은 그대로 둔다', () => {
    const u = 'https://x.supabase.co/storage/v1/object/sign/tracks/a.mp3?token=abc.def.ghi'
    expect(withCorsCacheKey(u)).toBe(`${u}&cors=1`)
  })
  it('해시 앞에 붙고, 이미 있으면 중복하지 않는다', () => {
    expect(withCorsCacheKey('https://a.test/x.mp3#t=5')).toBe('https://a.test/x.mp3?cors=1#t=5')
    expect(withCorsCacheKey('https://a.test/x.mp3?cors=1')).toBe('https://a.test/x.mp3?cors=1')
  })
  it('blob·data·상대 경로는 건드리지 않는다', () => {
    for (const u of ['blob:http://l/1', 'data:audio/mp3;base64,AA', '/x.mp3', '']) expect(withCorsCacheKey(u)).toBe(u)
  })
})

describe('bustCorsCacheKey', () => {
  it('cors 값만 바꾸고 나머지 쿼리는 유지한다', () => {
    const r = bustCorsCacheKey('https://a.test/x.mp3?token=t&cors=1')
    expect(r).toMatch(/^https:\/\/a\.test\/x\.mp3\?token=t&cors=[a-z0-9]+$/)
    expect(r).not.toContain('cors=1')
  })
  it('cors 만 있던 주소도 처리한다', () => {
    expect(bustCorsCacheKey('https://a.test/x.mp3?cors=1')).toMatch(/^https:\/\/a\.test\/x\.mp3\?cors=[a-z0-9]+$/)
  })
})
