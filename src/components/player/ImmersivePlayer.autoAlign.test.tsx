// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { usePlayerStore } from '@/stores/playerStore'

const autoAlign = vi.fn()

vi.mock('@/lib/player/lyricSyncClient', () => ({
  analyzeSpans: vi.fn(async () => null),
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAutoAlign: () => true,
  clearCachedLrc: vi.fn(),
  currentAudioSrc: () => 'blob:song',
  loadCachedLrc: () => null,
  loadCachedSpans: () => null,
  loadOffset: () => 0,
  markFailed: vi.fn(),
  recentlyFailed: () => false,
  saveCachedLrc: vi.fn(),
  saveOffset: vi.fn(),
  takeLegacyOffset: (id: string) => legacy.has(id),
}))
const legacy = new Set<string>()
import { ImmersivePlayer } from './ImmersivePlayer'

const trk = (id: string, extra: any = {}) =>
  ({ id, title: `곡 ${id}`, file_url: 'a', duration_sec: 120, lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다', album: { title: '앨범', cover_url: '/c.png' }, ...extra }) as any

beforeEach(() => {
  vi.useFakeTimers()
  autoAlign.mockReset()
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('가사 자동 맞추기 (재생 시작 시 백그라운드)', () => {
  it('처음 재생하면 추정으로 보이다가, 맞춤 결과가 나오면 시간표로 교체되고 추정 표시가 사라진다', async () => {
    autoAlign.mockResolvedValue({ ok: true, lrc: [{ t: 3, text: '첫째 줄입니다' }, { t: 30, text: '둘째 줄입니다' }, { t: 60, text: '셋째 줄입니다' }] })
    const t = trk('1')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 31, duration: 120, isPlaying: true })
    render(<ImmersivePlayer />)
    expect(screen.getByText('가사 시간 추정')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(autoAlign).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('가사 시간 추정')).toBeNull()
    expect(screen.getByText('둘째 줄입니다').getAttribute('aria-current')).toBe('true')
  })

  it('재생 중이 아니면 자동으로 돌리지 않는다', async () => {
    const t = trk('2')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 1, duration: 120, isPlaying: false })
    render(<ImmersivePlayer />)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(autoAlign).not.toHaveBeenCalled()
  })

  it('옛 시간표에 맞춰 넣었던 오프셋이 있던 곡은 초기화 안내 뒤, 새로 맞추면 「다시 맞췄어요」를 보인다', async () => {
    autoAlign.mockResolvedValue({ ok: true, lrc: [{ t: 3, text: '첫째 줄입니다' }, { t: 30, text: '둘째 줄입니다' }, { t: 60, text: '셋째 줄입니다' }] })
    legacy.add('4')
    const t = trk('4')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 1, duration: 120, isPlaying: true })
    render(<ImmersivePlayer />)
    expect(screen.getByText(/직접 넣은 빠르게·느리게 값은 초기화했어요/)).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('가사 시간을 다시 맞췄어요')).toBeTruthy()
    expect(screen.getByText('0.00s')).toBeTruthy()
  })

  it('맞추지 못하면 추정을 그대로 두고 실패 안내만 보인다', async () => {
    autoAlign.mockResolvedValue({ ok: false })
    const t = trk('3')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 1, duration: 120, isPlaying: true })
    render(<ImmersivePlayer />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('가사 시간 추정')).toBeTruthy()
    expect(screen.getByText('자동으로 맞추지 못했어요')).toBeTruthy()
  })
})
