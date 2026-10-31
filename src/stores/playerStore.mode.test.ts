import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlayerStore } from './playerStore'

const trk = (i: number) => ({ id: `t${i}`, title: `곡 ${i}`, file_url: 'x', duration_sec: 100 }) as any
const q = [0, 1, 2, 3, 4, 5].map(trk)

beforeEach(() => {
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
  usePlayerStore.setState({ currentTrack: null, queue: [], queueIndex: -1, isPlaying: false, isShuffle: false, repeatMode: 'off', originalQueue: null, currentTime: 0, modeNote: null })
})

describe('셔플·반복', () => {
  it('셔플을 켜면 현재 곡은 맨 앞에 두고 나머지만 섞고, 끄면 원래 순서·위치로 돌아간다', () => {
    usePlayerStore.getState().playTrack(q[2], q)
    usePlayerStore.getState().toggleShuffle()
    let s = usePlayerStore.getState()
    expect(s.isShuffle).toBe(true)
    expect(s.queue[0].id).toBe('t2')
    expect(s.queueIndex).toBe(0)
    expect(s.queue.map((t) => t.id).sort()).toEqual(q.map((t) => t.id).sort())
    expect(s.modeNote?.text).toBe('셔플 켬')
    s.toggleShuffle()
    s = usePlayerStore.getState()
    expect(s.queue).toBe(q)
    expect(s.queueIndex).toBe(2)
    expect(s.currentTrack?.id).toBe('t2')
  })

  it('셔플 중 같은 대기열 안에서 곡을 고르면 순서를 다시 섞지 않는다', () => {
    usePlayerStore.getState().playTrack(q[0], q)
    usePlayerStore.getState().toggleShuffle()
    const shuffled = usePlayerStore.getState().queue
    usePlayerStore.getState().playTrack(shuffled[3], shuffled)
    expect(usePlayerStore.getState().queue).toBe(shuffled)
    expect(usePlayerStore.getState().queueIndex).toBe(3)
  })

  it('반복 버튼은 끔 → 전체 → 한 곡 → 끔 순서로 돌고 저장된다', () => {
    const s = usePlayerStore.getState()
    s.toggleRepeatMode(); expect(usePlayerStore.getState().repeatMode).toBe('all')
    expect(usePlayerStore.getState().modeNote?.text).toBe('전체 반복')
    s.toggleRepeatMode(); expect(usePlayerStore.getState().repeatMode).toBe('one')
    expect(usePlayerStore.getState().modeNote?.text).toBe('한 곡 반복')
    s.toggleRepeatMode(); expect(usePlayerStore.getState().repeatMode).toBe('off')
    expect(JSON.parse(localStorage.getItem('cm.playmode')!).r).toBe('off')
  })

  it('다음 곡: 끝에서 끔이면 정지, 전체 반복이면 첫 곡', () => {
    usePlayerStore.getState().playTrack(q[5], q)
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().isPlaying).toBe(false)
    usePlayerStore.setState({ repeatMode: 'all', isPlaying: true })
    usePlayerStore.getState().next()
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t0')
  })
})
