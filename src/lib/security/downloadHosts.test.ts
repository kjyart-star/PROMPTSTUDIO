import { describe, it, expect } from 'vitest'
import { isAllowedDownloadHost, readCapped } from './downloadHosts'

const u = (s: string) => new URL(s)
describe('download 허용 호스트 (M-12)', () => {
  it('허용: 우리 저장소·CDN·공급자 CDN·R2 설정 호스트', () => {
    for (const s of ['https://cookiemusic-cdn.kjyart.workers.dev/a.mp3', 'https://abc.supabase.co/storage/v1/x', 'https://cdn1.suno.ai/a.mp3', 'https://cdn.apipass.dev/a.mp3', 'https://cookieplay.app/x'])
      expect(isAllowedDownloadHost(u(s), undefined), s).toBe(true)
    expect(isAllowedDownloadHost(u('https://r2.example-cdn.dev/a.mp3'), 'https://r2.example-cdn.dev')).toBe(true)
  })
  it('거부: 임의 호스트·http·닮은 호스트', () => {
    for (const s of ['https://evil.example/a.mp3', 'http://cdn1.suno.ai/a.mp3', 'https://suno.ai.evil.com/a', 'https://evilsupabase.co/a', 'https://example.com/'])
      expect(isAllowedDownloadHost(u(s), undefined), s).toBe(false)
  })
})
describe('readCapped', () => {
  it('상한 이하는 읽고, 넘으면 null', async () => {
    expect((await readCapped(new Response(new Uint8Array(10)), 100))?.length).toBe(10)
    expect(await readCapped(new Response(new Uint8Array(200)), 100)).toBeNull()
  })
})
