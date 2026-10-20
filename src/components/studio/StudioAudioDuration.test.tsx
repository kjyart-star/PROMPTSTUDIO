// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { AudioDuration } from './StudioAudioDuration'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AudioDuration (스튜디오)', () => {
  it('스토리지 경로는 서명 URL 로 바꿔 길이를 읽는다(-:- 에 머물지 않는다)', async () => {
    const srcs: string[] = []
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ signedUrl: 'https://x.test/s.mp3' }) })))
    class FakeAudio extends EventTarget {
      preload = ''; muted = false; duration = 185.4
      set src(v: string) { srcs.push(v); if (v) setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 0) }
    }
    vi.stubGlobal('Audio', FakeAudio)
    const { container, rerender } = render(<AudioDuration url="audio/p1.mp3" />)
    expect(container.textContent).toBe('-:-')
    await waitFor(() => expect(container.textContent).toBe('3:05'))
    expect(srcs).toContain('https://x.test/s.mp3')
    // 같은 url 로 다시 그려도 새로 불러오지 않는다
    const n = srcs.length
    rerender(<AudioDuration url="audio/p1.mp3" />)
    expect(srcs.length).toBe(n)
  })
})
