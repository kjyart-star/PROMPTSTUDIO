import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/basePath', () => ({ withBase: (p: string) => p }))
import { resolveStudioAudioUrl, cachedAudioUrl, clearAudioUrlCache } from './audioUrl'

beforeEach(() => { clearAudioUrlCache(); vi.unstubAllGlobals() })

describe('스튜디오 음원 주소', () => {
  it('http 주소는 그대로, 경로는 서버 서명 라우트로 받고 재사용한다', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ signedUrl: 'https://s/x?t=1' })))
    vi.stubGlobal('fetch', f)
    expect(await resolveStudioAudioUrl('https://a/b.mp3')).toBe('https://a/b.mp3')
    expect(f).not.toHaveBeenCalled()
    const [a, b] = await Promise.all([resolveStudioAudioUrl('audio/x.mp3'), resolveStudioAudioUrl('audio/x.mp3')])
    expect(a).toBe('https://s/x?t=1'); expect(b).toBe(a)
    expect(f).toHaveBeenCalledTimes(1)
    expect(cachedAudioUrl('audio/x.mp3')).toBe('https://s/x?t=1')
    await resolveStudioAudioUrl('audio/x.mp3')
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('서버가 거절하거나 끊기면 null(플레이어가 경로로 예전 방식 시도)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    expect(await resolveStudioAudioUrl('audio/y.mp3')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    expect(await resolveStudioAudioUrl('audio/z.mp3')).toBeNull()
  })
})
