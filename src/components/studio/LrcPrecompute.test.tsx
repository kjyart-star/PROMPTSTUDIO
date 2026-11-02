// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

const autoAlign = vi.fn()
vi.mock('@/lib/player/lyricSyncClient', () => ({
  analyzeSpans: vi.fn(async () => null),
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAutoAlign: () => true,
  canAlignForPublish: () => true,
  batteryLow: async () => false,
  markFailed: vi.fn(),
  recentlyFailed: () => false,
  saveCachedLrc: vi.fn(),
}))
vi.mock('@/lib/studio/audioUrl', () => ({ resolveStudioAudioUrl: async (p: string) => `https://cdn/${p}` }))
import LrcPrecompute from './LrcPrecompute'
import { resetAlignJobs } from '@/lib/player/alignJobs'

const song = (id: string) => ({ id, audio_url: `${id}.mp3`, lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다', form: {}, status: 'completed' })
const result = { ok: true, lrc: [{ t: 2, text: '첫째 줄입니다' }, { t: 20, text: '둘째 줄입니다' }, { t: 41, text: '셋째 줄입니다' }] }
const fetchMock = vi.fn(async () => ({ ok: true }))

beforeEach(() => {
  resetAlignJobs()
  vi.useFakeTimers()
  autoAlign.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('LrcPrecompute (스튜디오 가사 시간 미리 계산)', () => {
  it('한가해지면 곡마다 한 곡씩 백그라운드로 맞춰 초안으로 저장하고, 진행 표시는 하지 않는다', async () => {
    let finish1!: (v: unknown) => void
    autoAlign.mockImplementationOnce((_u: string, _l: string[], _d: number, _s: unknown, onPhase: (p: string, n: number) => void) => {
      onPhase('listen', 25)
      return new Promise((r) => { finish1 = r })
    }).mockResolvedValue(result)
    const onSaved = vi.fn()
    render(<LrcPrecompute userId="u1" history={[song('a'), song('b')]} lang="KO" onSaved={onSaved} />)
    expect(screen.queryByTestId('lrc-precompute')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(12_500) })
    expect(screen.queryByTestId('lrc-precompute')).toBeNull() // 생성 화면에서는 가사만, 진행 표시 없음
    expect(autoAlign).toHaveBeenCalledTimes(1) // 동시에 1곡
    await act(async () => { finish1(result) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('/api/song-history/a')
    expect(JSON.parse(call[1].body as string)).toMatchObject({ lrc_auto_v: 5 })
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

  it('생성·업로드가 막 끝난 곡은 12초를 기다리지 않고 곧바로 백그라운드로 맞춘다', async () => {
    autoAlign.mockResolvedValue(result)
    const onSaved = vi.fn()
    const done = { ...song('old'), form: { lrc_auto: result.lrc, lrc_auto_v: 4 } }
    const generating = { ...song('new'), status: 'processing' } // 아직 생성 중
    const { rerender } = render(<LrcPrecompute userId="u1" history={[generating, done]} lang="KO" onSaved={onSaved} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(autoAlign).not.toHaveBeenCalled() // 생성 중인 곡은 아직 맞추지 않는다
    rerender(<LrcPrecompute userId="u1" history={[song('new'), done]} lang="KO" onSaved={onSaved} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(autoAlign).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledWith('new', result.lrc)
  })

  it('처음 들어왔을 때 남아 있던 곡(창을 닫아 못 끝낸 곡)은 다음 방문에 한가해진 뒤 이어서 맞춘다', async () => {
    autoAlign.mockResolvedValue(result)
    render(<LrcPrecompute userId="u1" history={[song('left')]} lang="KO" onSaved={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(autoAlign).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000) })
    expect(autoAlign).toHaveBeenCalledTimes(1)
  })
})

describe('LrcPrecompute — 가사 시간 확인 권유', () => {
  it('신뢰도가 낮은 곡이 있으면 「가사 시간 확인」을 권하고 누르면 편집기를 연다', async () => {
    const onReview = vi.fn()
    const low = { ...song('low'), title: '조용히좀해', form: { lrc_auto: result.lrc, lrc_auto_v: 5, lrc_review: { reason: 'low-confidence' } } }
    render(<LrcPrecompute userId="u1" history={[low]} lang="KO" onSaved={vi.fn()} onReview={onReview} />)
    expect(screen.getByTestId('lrc-review').textContent).toContain('「조용히좀해」 가사 시간이 정확하지 않을 수 있어요')
    await act(async () => { screen.getByText('가사 시간 확인').click() })
    expect(onReview).toHaveBeenCalledWith(low)
  })
  it('사람이 고친 곡은 권하지 않는다', () => {
    const fixed = { ...song('f'), form: { lrc_review: { reason: 'low-confidence' }, lrc_by: 'user', lrc: result.lrc } }
    render(<LrcPrecompute userId="u1" history={[fixed]} lang="KO" onSaved={vi.fn()} onReview={vi.fn()} />)
    expect(screen.queryByTestId('lrc-review')).toBeNull()
  })
})
