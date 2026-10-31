// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

let signDelay = 50
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    storage: {
      from: () => ({
        createSignedUrl: (p: string) =>
          new Promise((r) => setTimeout(() => r({ data: { signedUrl: `https://x.test/sign/${p}?t=${Math.random()}` }, error: null }), signDelay)),
      }),
    },
  }),
}))
vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }))

import { PersistentPlayer } from './PersistentPlayer'
import { usePlayerStore } from '@/stores/playerStore'

const track = (id: string) => ({ id, title: id, file_url: `audio/${id}.mp3`, duration_sec: 180 }) as any

let srcSets: string[] = []
let calls: string[] = []
let srcNow = ''

beforeEach(() => {
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
  srcSets = []; calls = []; srcNow = ''
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return srcNow },
    set(v: string) { srcNow = v; srcSets.push(v) },
  })
  HTMLMediaElement.prototype.load = vi.fn(() => { calls.push('load') })
  HTMLMediaElement.prototype.pause = vi.fn(function (this: HTMLMediaElement) { calls.push('pause') })
  HTMLMediaElement.prototype.play = vi.fn(function () {
    calls.push(`play@${srcNow ? 'src' : 'empty'}`)
    return srcNow ? Promise.resolve() : Promise.reject(new DOMException('no src', 'NotSupportedError'))
  })
  usePlayerStore.setState({ currentTrack: null, isPlaying: false, queue: [], queueIndex: -1 })
})
afterEach(cleanup)

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

describe('PersistentPlayer', () => {
  it('서명 대기 중에는 빈 src 로 play() 하지 않고, 재생 상태가 꺼졌다 켜지지 않는다', async () => {
    const seen: boolean[] = []
    const unsub = usePlayerStore.subscribe((s) => seen.push(s.isPlaying))
    render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    await wait(120)
    expect(calls.filter((c) => c === 'play@empty')).toHaveLength(0)
    expect(seen).not.toContain(false)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    unsub()
  })

  it('다음 곡으로 넘어가면 그 곡 차례에 서버 서명 라우트로 주소를 받아 cors=1 로 붙인다', async () => {
    const fetchMock = vi.fn(async (u: string) => ({ ok: true, json: async () => ({ signedUrl: `https://x.test/signed/${decodeURIComponent(u.split('file_path=')[1])}` }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PersistentPlayer />)
    const a = { ...track('a'), file_url: 'https://x.test/signed/audio/a.mp3' }
    act(() => usePlayerStore.getState().playTrack(a, [a, track('b'), track('c')]))
    await wait(60)
    expect(fetchMock).not.toHaveBeenCalled()
    act(() => usePlayerStore.getState().next())
    await wait(60)
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/tracks/signed-url?file_path=audio%2Fb.mp3')
    expect(srcSets[srcSets.length - 1]).toContain('https://x.test/signed/audio/b.mp3')
    expect(srcSets[srcSets.length - 1]).toContain('cors=1')
    vi.unstubAllGlobals()
  })

  it('재생 중 timeupdate 가 와도 src 가 다시 설정되지 않는다', async () => {
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    await wait(120)
    const before = srcSets.length
    const audio = container.querySelector('audio')!
    for (let i = 0; i < 20; i++) {
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: i })
      act(() => { audio.dispatchEvent(new Event('timeupdate')) })
    }
    await wait(50)
    expect(srcSets.length).toBe(before)
    expect(srcSets).toHaveLength(1)
  })

  it('곡을 바꾸면 이전 곡을 먼저 멈추고, 그 pause 가 재생 상태를 끄지 않는다', async () => {
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    await wait(120)
    const audio = container.querySelector('audio')!
    act(() => { audio.dispatchEvent(new Event('play')) })
    act(() => usePlayerStore.getState().playTrack(track('b')))
    act(() => { audio.dispatchEvent(new Event('pause')) }) // 전환용 pause 이벤트
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await wait(120)
    expect(srcSets).toHaveLength(2)
    expect(srcSets[1]).toContain('audio/b.mp3')
    act(() => { audio.dispatchEvent(new Event('loadstart')) })
    act(() => { audio.dispatchEvent(new Event('pause')) }) // 사용자의 정지는 반영된다
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })
  it('crossOrigin 으로 불러오는 http 주소에는 cors=1 을 붙이고, 서명 쿼리는 & 로 이어 붙인다', async () => {
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    await wait(120)
    const audio = container.querySelector('audio')!
    expect(audio.crossOrigin).toBe('anonymous')
    expect(srcSets[0]).toMatch(/^https:\/\/x\.test\/sign\/audio\/a\.mp3\?t=[^&]+&cors=1$/)
    act(() => usePlayerStore.getState().playTrack({ ...track('c'), file_url: 'https://cdn.test/audio/c.mp3' }))
    await wait(120)
    expect(srcSets[srcSets.length - 1]).toBe('https://cdn.test/audio/c.mp3?cors=1')
  })

  it('CORS 로드가 실패하면 crossOrigin 없이 한 번만 다시 불러와 재생한다', async () => {
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    await wait(120)
    const audio = container.querySelector('audio')!
    const before = srcSets.length
    act(() => { audio.dispatchEvent(new Event('error')) })
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(srcSets).toHaveLength(before + 1)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    // 두 번째 오류는 더 재시도하지 않고 실패로 처리한다
    act(() => { audio.dispatchEvent(new Event('error')) })
    expect(srcSets).toHaveLength(before + 1)
    expect(usePlayerStore.getState().isPlaying).toBe(false)
  })
  it('재생/정지를 오가도 src 는 곡마다 고정값이고 다시 로드되지 않으며, 연속 재생도 곡당 한 번만 설정된다', async () => {
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack({ ...track('a'), file_url: 'https://cdn.test/audio/a.mp3' }))
    await wait(60)
    const audio = container.querySelector('audio')!
    const first = srcSets[0]
    for (let i = 0; i < 4; i++) {
      act(() => usePlayerStore.getState().togglePlay())
      await wait(10)
    }
    expect(srcSets).toEqual([first])
    expect(first).toBe('https://cdn.test/audio/a.mp3?cors=1')
    expect(audio.getAttribute('crossorigin')).toBe('anonymous')
    act(() => usePlayerStore.getState().playTrack({ ...track('b'), file_url: 'https://cdn.test/audio/b.mp3' }))
    await wait(60)
    expect(srcSets).toEqual([first, 'https://cdn.test/audio/b.mp3?cors=1'])
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('오른쪽 패널이 없는 화면(스튜디오)에서는 「지금 재생 중 열기」가 전체 화면 지금 재생을 연다', () => {
    usePlayerStore.setState({ isImmersiveOpen: false, isNowPlayingOpen: false })
    const { getByTitle } = render(<PersistentPlayer />)
    act(() => usePlayerStore.getState().playTrack(track('a')))
    act(() => { getByTitle('지금 재생 중 열기').click() })
    expect(usePlayerStore.getState().isImmersiveOpen).toBe(true)
    expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false)
  })

  it('오른쪽 패널이 있는 화면에서는 종전대로 패널을 토글한다', () => {
    usePlayerStore.setState({ isImmersiveOpen: false, isNowPlayingOpen: false })
    const { getByTitle } = render(<PersistentPlayer hasSidePanel />)
    act(() => { getByTitle('지금 재생 중 열기').click() })
    expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true)
    expect(usePlayerStore.getState().isImmersiveOpen).toBe(false)
  })

  it('곡이 끝나면: 끔은 마지막 곡에서 정지, 전체 반복은 첫 곡으로, 한 곡 반복은 같은 곡을 처음부터', async () => {
    const q = [track('a'), track('b')]
    const { container } = render(<PersistentPlayer />)
    act(() => usePlayerStore.setState({ repeatMode: 'off', isShuffle: false }))
    act(() => usePlayerStore.getState().playTrack(q[1], q))
    await wait(100)
    const audio = container.querySelector('audio')!
    act(() => { audio.dispatchEvent(new Event('ended')) })
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b')
    act(() => usePlayerStore.setState({ repeatMode: 'all', isPlaying: true }))
    act(() => { audio.dispatchEvent(new Event('ended')) })
    expect(usePlayerStore.getState().currentTrack?.id).toBe('a')
    act(() => usePlayerStore.setState({ repeatMode: 'one', isPlaying: true }))
    act(() => { audio.dispatchEvent(new Event('ended')) })
    expect(usePlayerStore.getState().currentTrack?.id).toBe('a')
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })
})
