// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

const autoAlign = vi.fn()
vi.mock('@/lib/player/lyricSyncClient', () => ({
  analyzeSpans: vi.fn(async () => null),
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAutoAlign: () => true,
  markFailed: vi.fn(),
  recentlyFailed: () => false,
  saveCachedLrc: vi.fn(),
}))
vi.mock('@/lib/studio/audioUrl', () => ({ resolveStudioAudioUrl: async (p: string) => `https://cdn/${p}` }))
import LrcPrecompute from './LrcPrecompute'

const song = (id: string) => ({ id, audio_url: `${id}.mp3`, lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다', form: {}, status: 'completed' })
const result = { ok: true, lrc: [{ t: 2, text: '첫째 줄입니다' }, { t: 20, text: '둘째 줄입니다' }, { t: 41, text: '셋째 줄입니다' }] }
const fetchMock = vi.fn(async () => ({ ok: true }))

beforeEach(() => {
  vi.useFakeTimers()
  autoAlign.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('LrcPrecompute (스튜디오 가사 시간 미리 계산)', () => {
  it('한가해지면 곡마다 한 곡씩 맞춰 서버에 저장하고 「n/총」 표시를 보인다', async () => {
    let finish1!: (v: unknown) => void
    autoAlign.mockImplementationOnce((_u: string, _l: string[], _d: number, _s: unknown, onPhase: (p: string, n: number) => void) => {
      onPhase('listen', 25)
      return new Promise((r) => { finish1 = r })
    }).mockResolvedValue(result)
    const onSaved = vi.fn()
    render(<LrcPrecompute userId="u1" history={[song('a'), song('b')]} lang="KO" onSaved={onSaved} />)
    expect(screen.queryByTestId('lrc-precompute')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(12_500) })
    expect(screen.getByTestId('lrc-precompute').textContent).toBe('내 곡 가사 시간 맞추는 중 1/2 · 40%')
    expect(autoAlign).toHaveBeenCalledTimes(1) // 동시에 1곡
    await act(async () => { finish1(result) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('/api/song-history/a')
    expect(JSON.parse(call[1].body as string)).toMatchObject({ lrc_auto_v: 3 })
    expect(onSaved).toHaveBeenCalledWith('a', result.lrc)
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(autoAlign).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenCalledWith('b', result.lrc)
  })

  it('로그인하지 않았거나 맞출 곡이 없으면 아무것도 하지 않는다', async () => {
    const done = { ...song('a'), form: { lrc_auto: result.lrc, lrc_auto_v: 3 } }
    render(<LrcPrecompute userId="u1" history={[done]} lang="KO" onSaved={vi.fn()} />)
    render(<LrcPrecompute userId={null} history={[song('b')]} lang="KO" onSaved={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(autoAlign).not.toHaveBeenCalled()
  })

  it('맞추지 못한 곡은 저장하지 않는다', async () => {
    autoAlign.mockResolvedValue({ ok: false })
    const onSaved = vi.fn()
    render(<LrcPrecompute userId="u1" history={[song('a')]} lang="KO" onSaved={onSaved} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(13_000) })
    expect(autoAlign).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
