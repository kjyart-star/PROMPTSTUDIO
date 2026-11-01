// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { usePlayerStore } from '@/stores/playerStore'

const autoAlign = vi.fn()
const markFailed = vi.fn()

vi.mock('@/lib/player/lyricSyncClient', () => ({
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAutoAlign: () => true,
  batteryLow: async () => false,
  currentAudioSrc: () => 'blob:song',
  currentAudioTime: () => 31,
  loadCachedLrc: () => null,
  markFailed: (...a: unknown[]) => markFailed(...a),
  recentlyFailed: () => false,
  saveCachedLrc: vi.fn(),
}))
import { releaseAlignLock } from '@/lib/player/alignLock'
import { lyricSyncConfig } from './useLyricSync'
import { ImmersivePlayer } from './ImmersivePlayer'

const FULL = [{ t: 3, text: '첫째 줄입니다' }, { t: 30, text: '둘째 줄입니다' }, { t: 60, text: '셋째 줄입니다' }]
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

const trk = (id: string, extra: any = {}) =>
  ({ id, title: `곡 ${id}`, file_url: 'a', duration_sec: 120, lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다', album: { title: '앨범', cover_url: '/c.png' }, ...extra }) as any
const open = (t: any, extra: any = {}) =>
  usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 31, duration: 120, isPlaying: true, ...extra })

/** 서버 조회 응답을 흉내 낸다 — shared 가 null 이면 404 */
const serverReturns = (get: () => unknown[] | null) =>
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    if (!String(u).includes('/api/lyrics-sync/')) return { ok: true }
    const lines = get()
    return lines ? { ok: true, json: async () => ({ lines, v: 3, source: 'auto' }) } : { ok: false, status: 404 }
  }))

beforeEach(() => {
  lyricSyncConfig.listenerCompute = true // 이 묶음은 (지금은 꺼 둔) 듣는 사람 계산 경로를 검사한다
  vi.useFakeTimers()
  autoAlign.mockReset()
  markFailed.mockReset()
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
  serverReturns(() => null)
})
afterEach(() => { cleanup(); releaseAlignLock(); vi.useRealTimers() })

const currentLines = () => Array.from(document.querySelectorAll('[aria-current="true"]')).map((e) => e.textContent)

describe('가사 싱크 (서버 우선, 브라우저는 폴백)', () => {
  it('시간표가 없으면 추정하지 않고 일반 가사로 보인다: 강조·버튼·배너·추정 표시가 없다', async () => {
    autoAlign.mockReturnValue(new Promise(() => {}))
    open(trk('1'), { isPlaying: false })
    const { container } = render(<ImmersivePlayer />)
    await flush()
    expect(currentLines()).toEqual([])
    expect(screen.getByText('둘째 줄입니다')).toBeTruthy()
    expect(container.querySelector('.imm-lyrics')!.className).toContain('is-plain')
    expect((screen.getByText('둘째 줄입니다') as HTMLElement).style.opacity).toBe('0.85')
    expect(screen.queryByText('가사 시간 추정')).toBeNull()
    expect(screen.queryByRole('button', { name: /가사 (빠르게|느리게|자동 맞추기|다시 맞추기)/ })).toBeNull()
    expect(screen.queryByTestId('align-banner')).toBeNull()
    expect(screen.queryByText(/0\.00s/)).toBeNull()
  })

  it('일반 가사 줄을 눌러도 탐색하지 않는다', async () => {
    open(trk('1'), { isPlaying: false })
    render(<ImmersivePlayer />)
    await flush()
    const seek = vi.fn()
    await act(async () => { usePlayerStore.setState({ seek }) })
    fireEvent.click(screen.getByText('셋째 줄입니다'))
    expect(seek).not.toHaveBeenCalled()
  })

  it('서버에 판 3 시간표가 있으면 브라우저 계산 없이 강조가 시작되고 줄을 누르면 이동한다', async () => {
    serverReturns(() => FULL)
    open(trk('6'))
    render(<ImmersivePlayer />)
    await flush()
    expect(autoAlign).not.toHaveBeenCalled()
    expect(currentLines()).toEqual(['둘째 줄입니다'])
    const seek = vi.fn()
    await act(async () => { usePlayerStore.setState({ seek }) })
    fireEvent.click(screen.getByText('셋째 줄입니다'))
    expect(seek).toHaveBeenCalledWith(60)
  })

  it('줄 끝을 지나 다음 줄까지 2초 넘게 남으면 간주: 강조를 끄고 ♪ 를 보이며, 다음 줄은 0.3초 전에 켠다', async () => {
    const withEnd = [{ t: 3, text: '첫째 줄입니다', end: 8, conf: 0.9 }, { t: 30, text: '둘째 줄입니다', end: 34, conf: 0.9 }, { t: 60, text: '셋째 줄입니다', end: 64, conf: 0.9 }]
    open(trk('7', { lrc: withEnd }), { currentTime: 20 })
    render(<ImmersivePlayer />)
    await flush()
    expect(currentLines()).toEqual([])
    expect(screen.getByTestId('lyric-interlude').textContent).toBe('♪')
    await act(async () => { usePlayerStore.setState({ currentTime: 29.75 }) })
    expect(currentLines()).toEqual(['둘째 줄입니다'])
    expect(screen.queryByTestId('lyric-interlude')).toBeNull()
  })

  it('신뢰도가 낮은 줄 구간은 강조하지 않는다', async () => {
    const low = [{ t: 3, text: '첫째 줄입니다', conf: 0.9 }, { t: 30, text: '둘째 줄입니다', conf: 0.1 }, { t: 60, text: '셋째 줄입니다', conf: 0.9 }]
    open(trk('8', { lrc: low }), { currentTime: 40 })
    render(<ImmersivePlayer />)
    await flush()
    expect(currentLines()).toEqual([])
    expect(screen.queryByTestId('lyric-interlude')).toBeNull()
    await act(async () => { usePlayerStore.setState({ currentTime: 61 }) })
    expect(currentLines()).toEqual(['셋째 줄입니다'])
  })

  it('오프셋 localStorage 값은 읽지 않는다', async () => {
    serverReturns(() => FULL)
    localStorage.setItem('cm.lyric-offset.v2:6', '5')
    open(trk('6'), { currentTime: 28 })
    render(<ImmersivePlayer />)
    await flush()
    expect(currentLines()).toEqual(['첫째 줄입니다'])
  })

  it('서버에 없고 재생 중이면 곧바로 현재 재생 위치부터 브라우저 계산을 시작하고, 부분 결과가 오면 강조한다', async () => {
    let onPartial!: (s: (number | null)[]) => void
    let finish!: (v: unknown) => void
    autoAlign.mockImplementation((...a: any[]) => { onPartial = a[6].onPartial; return new Promise((r) => { finish = r }) })
    open(trk('2'))
    render(<ImmersivePlayer />)
    await flush()
    expect(autoAlign).toHaveBeenCalledTimes(1)
    expect(autoAlign.mock.calls[0][6].startSec).toBe(31)
    expect(currentLines()).toEqual([]) // 아직 아는 줄이 없다
    await act(async () => { onPartial([null, 30, null]) })
    expect(currentLines()).toEqual(['둘째 줄입니다'])
    // 다음 줄 시각을 모르는 줄은 8초가 지나면 강조를 멈추고 일반 가사로 돌아간다
    await act(async () => { usePlayerStore.setState({ currentTime: 39 }) })
    expect(currentLines()).toEqual([])
    await act(async () => { onPartial([3, 30, null]); usePlayerStore.setState({ currentTime: 33 }) })
    expect(currentLines()).toEqual(['둘째 줄입니다'])
    await act(async () => { finish({ ok: true, lrc: FULL }) })
    await act(async () => { usePlayerStore.setState({ currentTime: 61 }) })
    expect(currentLines()).toEqual(['셋째 줄입니다'])
  })

  it('재생 중이 아니면 브라우저 계산을 시작하지 않는다', async () => {
    open(trk('3'), { isPlaying: false })
    render(<ImmersivePlayer />)
    await flush(6000)
    expect(autoAlign).not.toHaveBeenCalled()
  })

  it('서버 확인 응답이 오기 전에는 계산을 시작하지 않는다', async () => {
    let release!: (v: unknown) => void
    vi.stubGlobal('fetch', vi.fn((u: string) => (String(u).includes('/api/lyrics-sync/') ? new Promise((r) => { release = r }) : Promise.resolve({ ok: true }))))
    autoAlign.mockReturnValue(new Promise(() => {}))
    open(trk('7'))
    render(<ImmersivePlayer />)
    await flush(3000)
    expect(autoAlign).not.toHaveBeenCalled()
    await act(async () => { release({ ok: false }) })
    await flush()
    expect(autoAlign).toHaveBeenCalledTimes(1)
  })

  it('계산 도중 20초 뒤 서버에 결과가 생기면 폴백을 중단하고 서버 시간표로 교체한다', async () => {
    let shared: unknown[] | null = null
    serverReturns(() => shared)
    let signal!: AbortSignal
    autoAlign.mockImplementation((...a: any[]) => { signal = a[5]; return new Promise((_r, rej) => a[5].addEventListener('abort', () => rej(new Error('aborted')))) })
    open(trk('8'))
    render(<ImmersivePlayer />)
    await flush()
    expect(autoAlign).toHaveBeenCalledTimes(1)
    expect(signal.aborted).toBe(false)
    shared = FULL
    await flush(20_000)
    expect(signal.aborted).toBe(true)
    expect(markFailed).not.toHaveBeenCalled()
    expect(currentLines()).toEqual(['둘째 줄입니다'])
  })

  it('재생이 멈춰 있는 동안에는 서버에 다시 묻지 않는다', async () => {
    autoAlign.mockReturnValue(new Promise(() => {}))
    open(trk('9'), { isPlaying: false })
    render(<ImmersivePlayer />)
    await flush()
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const first = fetchMock.mock.calls.length
    await flush(60_000)
    expect(fetchMock.mock.calls.length).toBe(first)
    await act(async () => { usePlayerStore.setState({ isPlaying: true }) })
    await flush(20_000)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(first)
  })

  it('맞추지 못하면 일반 가사 그대로 두고 7일간 실패로 기록한다', async () => {
    autoAlign.mockResolvedValue({ ok: false })
    open(trk('10'))
    render(<ImmersivePlayer />)
    await flush()
    expect(markFailed).toHaveBeenCalledWith('10')
    expect(currentLines()).toEqual([])
  })

  it('내 스튜디오 곡은 맞춤 완료 후 lrc_auto 판 5(웹 정렬기 정보 포함)로 저장한다', async () => {
    autoAlign.mockResolvedValue({ ok: true, lrc: FULL })
    open(trk('11', { album_id: 'studio-generated' }))
    render(<ImmersivePlayer />)
    await flush()
    const calls = (globalThis.fetch as any).mock.calls.filter((c: any[]) => String(c[0]).includes('/api/song-history/11'))
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0][1].body)).toEqual({ lrc_auto: FULL, lrc_auto_v: 5, client: 'web', engine: 'transformers.js', model: 'browser-whisper-base' })
  })
})

describe('가사 싱크 — 2026-11-02 구조(공개 단계에서 확정)', () => {
  it('기본값에서는 서버에 시간표가 없어도 듣는 사람 브라우저가 계산하지 않는다(일반 가사)', async () => {
    lyricSyncConfig.listenerCompute = false
    open(trk('20'))
    render(<ImmersivePlayer />)
    await flush(3000)
    expect(autoAlign).not.toHaveBeenCalled()
  })
  it('비공개 스튜디오 곡은 서버에 묻지도, 계산하지도 않고 일반 가사로 둔다', async () => {
    lyricSyncConfig.listenerCompute = true
    open(trk('21', { lyrics_private: true }))
    render(<ImmersivePlayer />)
    await flush(3000)
    const asked = (globalThis.fetch as any).mock.calls.filter((c: any[]) => String(c[0]).includes('/api/lyrics-sync/21'))
    expect(asked).toHaveLength(0)
    expect(autoAlign).not.toHaveBeenCalled()
  })
})
