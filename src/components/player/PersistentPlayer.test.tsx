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
})
