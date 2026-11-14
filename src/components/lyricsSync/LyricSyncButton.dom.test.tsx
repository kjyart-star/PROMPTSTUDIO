// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const autoAlign = vi.fn()
vi.mock('@/lib/player/lyricSyncClient', () => ({
  autoAlign: (...a: unknown[]) => autoAlign(...a),
  canAlignForPublish: () => true,
}))
vi.mock('@/lib/studio/audioUrl', () => ({ resolveStudioAudioUrl: async () => 'https://x/a.mp3' }))
vi.mock('@/lib/audio/corsUrl', () => ({ withCorsCacheKey: (u: string) => u }))
vi.mock('@/components/studio/LyricTimingEditor', () => ({
  default: ({ onSave }: any) => <button data-testid="editor" onClick={() => onSave([{ t: 2, text: '첫째 줄입니다' }, { t: 6, text: '둘째 줄입니다' }])}>editor</button>,
}))
import LyricSyncButton from './LyricSyncButton'

const LY = '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다'
const OUT = [{ t: 1, text: '첫째 줄입니다' }, { t: 5, text: '둘째 줄입니다' }, { t: 9, text: '셋째 줄입니다' }]
const mem: Record<string, string> = {}
const fetchMock = vi.fn()

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k]
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', fetchMock)
  autoAlign.mockReset().mockResolvedValue({ ok: true, lrc: OUT })
})
afterEach(() => cleanup())

const props = { songId: 's1', lyrics: LY, audioPath: 'u/a.mp3', synced: false }

describe('LyricSyncButton', () => {
  it('다시 맞추기도 자동 결과(lrc_auto)로 저장하고, 직접 확인한 시간표가 남아 있으면 안내한다', async () => {
    mem['cm.align-model-ready'] = '1'
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ form: { lrc_by: 'user', lrc: OUT } }) })
    render(<LyricSyncButton {...props} synced />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-error').textContent).toContain('직접 확인한 시간표'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).lrc).toBeUndefined()
  })
  it('사용자가 「시간 확인·고치기」에서 저장했을 때만 user(lrc)로 저장한다', async () => {
    mem['cm.align-model-ready'] = '1'
    render(<LyricSyncButton {...props} song={{ id: 's1' }} />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-edit')).toBeTruthy())
    fireEvent.click(screen.getByTestId('lyric-sync-edit'))
    fetchMock.mockClear()
    fireEvent.click(screen.getByTestId('editor'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).lrc).toHaveLength(2)
  })
  it('무료 배지를 달고 ✦ 비용 표시는 없다', () => {
    render(<LyricSyncButton {...props} />)
    expect(screen.getByText('가사 동기화')).toBeTruthy()
    expect(screen.getByText('무료 · 내 컴퓨터에서 처리')).toBeTruthy()
    expect(document.body.textContent).not.toContain('✦')
  })
  it('이미 동기화된 곡은 「다시 맞추기」', () => {
    render(<LyricSyncButton {...props} synced />)
    expect(screen.getByText('다시 맞추기')).toBeTruthy()
  })
  it('visible=false 면 아무것도 그리지 않는다(남의 곡)', () => {
    const { container } = render(<LyricSyncButton {...props} visible={false} />)
    expect(container.innerHTML).toBe('')
  })
  it('처음엔 모델 내려받기 안내 → 시작하면 계산하고 결과 시간표만 저장·즉시 반영한다', async () => {
    const applied = vi.fn()
    render(<LyricSyncButton {...props} onApplied={applied} />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    expect(screen.getByTestId('lyric-sync-confirm').textContent).toContain('처음 한 번 약 77~291MB')
    fireEvent.click(screen.getByTestId('lyric-sync-start'))
    await waitFor(() => expect(applied).toHaveBeenCalledWith(OUT))
    expect(autoAlign).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/song-history/s1')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body.lrc_auto).toEqual(OUT) // 업로드는 결과 JSON 뿐
    expect(body.lrc).toBeUndefined() // 출처 user 로 저장하지 않는다 — 공개 때 싱크 확인을 거친다
    expect(screen.getByTestId('lyric-sync-done')).toBeTruthy()
    // 두 번째부터는 안내 없이 바로 시작
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    expect(screen.queryByTestId('lyric-sync-confirm')).toBeNull()
  })
  it('진행 중 취소하면 멈추고 결과를 저장하지 않는다', async () => {
    mem['cm.align-model-ready'] = '1'
    autoAlign.mockImplementation((_u: string, _l: string[], _d: number, _s: unknown, _p: unknown, signal: AbortSignal) =>
      new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))))
    render(<LyricSyncButton {...props} />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-progress')).toBeTruthy())
    fireEvent.click(screen.getByTestId('lyric-sync-cancel'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-run')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('찾지 못하면 원인을 안내하고, 곡 정보가 있으면 직접 찍기를 권한다', async () => {
    mem['cm.align-model-ready'] = '1'
    autoAlign.mockResolvedValue({ ok: false })
    render(<LyricSyncButton {...props} song={{ id: 's1' }} />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-error').textContent).toContain('가사 위치를 찾지 못했어요'))
    expect(autoAlign).toHaveBeenCalledTimes(2) // WebGPU 실패 뒤 WASM 재시도
    fireEvent.click(screen.getByTestId('lyric-sync-edit'))
    expect(screen.getByTestId('editor')).toBeTruthy()
  })
  it('가사가 2줄 미만이면 계산하지 않고 안내한다', async () => {
    mem['cm.align-model-ready'] = '1'
    render(<LyricSyncButton {...props} lyrics="한 줄" />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-error').textContent).toContain('2줄 이상'))
    expect(autoAlign).not.toHaveBeenCalled()
  })
  it('로그인이 풀렸으면 저장 실패를 로그인 안내로 알린다', async () => {
    mem['cm.align-model-ready'] = '1'
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    render(<LyricSyncButton {...props} />)
    fireEvent.click(screen.getByTestId('lyric-sync-run'))
    await waitFor(() => expect(screen.getByTestId('lyric-sync-error').textContent).toContain('로그인'))
  })
})
