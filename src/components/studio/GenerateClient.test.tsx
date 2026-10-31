// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/lib/credits/useSuiteCredits', () => ({
  useSuiteCredits: () => ({ balance: 100, loading: false, refresh: vi.fn(), prices: {}, getPrice: () => 0 }),
}))
vi.mock('./StudioAudioDuration', () => ({ AudioDuration: () => <span>3:00</span> }))

import { GenerateClient } from './GenerateClient'
import TrackMenu from './TrackMenu'
import { usePlayerStore } from '@/stores/playerStore'

const rows = [
  { id: 'a', title: 'Song A', status: 'completed', audio_url: 'audio/a.mp3', image_url: '', prompt: 'pop', created_at: '2026-10-02', form: {} },
  { id: 'b', title: 'Song B', status: 'completed', audio_url: 'audio/b.mp3', image_url: '', prompt: 'rock', created_at: '2026-10-01', form: {} },
]

beforeEach(() => {
  const mem: Record<string, string> = { 'studio-detail-collapsed': '1' }
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: () => {} })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => rows })))
  usePlayerStore.setState({ currentTrack: null, isPlaying: false, queue: [], queueIndex: -1 })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('GenerateClient 곡 행 클릭', () => {
  it('행 한 번 클릭 → 재생 상태 + 상세 패널(접혀 있어도)에 그 곡, 다른 곡을 누르면 상세도 바뀐다', async () => {
    const { findByText, container } = render(<GenerateClient user={{ id: 'u', email: 'u@x.y' }} />)
    const rowB = (await findByText('Song B')).closest('[role=button]') as HTMLElement
    const rowA = (await findByText('Song A')).closest('[role=button]') as HTMLElement
    const detail = () => container.querySelectorAll('aside')[0]?.textContent ?? ''

    fireEvent.click(rowA)
    await waitFor(() => expect(usePlayerStore.getState().currentTrack?.id).toBe('a'))
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await waitFor(() => expect(detail()).toContain('Song A'))
    // 접힌 레일이 아니라 펼쳐진 패널이어야 한다
    expect(container.querySelector('aside button[aria-expanded="true"]')).not.toBeNull()

    fireEvent.click(rowB)
    await waitFor(() => expect(usePlayerStore.getState().currentTrack?.id).toBe('b'))
    await waitFor(() => expect(detail()).toContain('Song B'))
  })

  it('행 안의 아이콘 버튼은 재생·상세를 건드리지 않는다', async () => {
    const { findByText, container } = render(<GenerateClient user={{ id: 'u', email: 'u@x.y' }} />)
    const rowA = (await findByText('Song A')).closest('[role=button]') as HTMLElement
    const icon = rowA.querySelector('button') as HTMLElement
    fireEvent.click(icon)
    expect(usePlayerStore.getState().currentTrack).toBeNull()
    expect(container.querySelector('aside')).toBeNull()
  })
})

describe('GenerateClient 곡 ⋯ 메뉴', () => {
  it('곡마다 ⋯ 메뉴가 있고 간단 마스터링으로 들어간다, 아이콘 버튼엔 aria-label 이 있다', async () => {
    const onQuick = vi.fn()
    const renderTrackMenu = (item: any, buttonClass: string, iconClass: string) => (
      <TrackMenu uiLanguage="KO" item={item} playlists={[]} signedIn buttonClass={buttonClass} iconClass={iconClass}
        onUpdate={() => {}} onRestorePrompt={() => {}} onPublish={() => {}} onMastering={() => {}} onQuickMaster={onQuick}
        onEditTiming={() => {}} onAlbumArt={() => {}} onStem={() => {}} artMilli={1000} stemMilli={3000} onDownload={() => {}} onTrash={() => {}} />
    )
    const { findByText, container, getAllByLabelText, getByText } = render(
      <GenerateClient user={{ id: 'u', email: 'u@x.y' }} renderTrackMenu={renderTrackMenu} />,
    )
    await findByText('Song A')
    expect(getAllByLabelText('더보기')).toHaveLength(2)
    expect(getAllByLabelText(/좋아요|Like/).length).toBe(2)
    expect(getAllByLabelText(/다운로드|Download/).length).toBe(2)
    expect(getAllByLabelText(/재생|Play/).length).toBeGreaterThanOrEqual(2)
    fireEvent.click(getAllByLabelText('더보기')[0])
    // 이 곡들은 Suno 곡 id 가 없어 스템 항목은 아예 보이지 않는다(눌러 보고 실패하는 일 금지)
    expect(container.textContent).not.toContain('스템 분리')
    expect(getByText('✦1')).toBeTruthy()
    fireEvent.click(getByText('마스터링'))
    expect(onQuick).toHaveBeenCalled()
    // 메뉴를 눌러도 곡이 재생되지 않는다
    expect(usePlayerStore.getState().currentTrack).toBeNull()
    expect(container).toBeTruthy()
  })
})

describe('GenerateClient 재생은 서버 서명 주소로', () => {
  it('저장소 경로 곡을 누르면 서버 서명 라우트로 받은 https 주소를 플레이어에 넘긴다', async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes('/api/tracks/signed-url')) return new Response(JSON.stringify({ signedUrl: 'https://signed.example/a.mp3?t=1' }))
      return new Response(JSON.stringify(rows))
    })
    vi.stubGlobal('fetch', f)
    const { findByText } = render(<GenerateClient user={{ id: 'u', email: 'u@x.y' }} />)
    const rowA = (await findByText('Song A')).closest('[role=button]') as HTMLElement
    fireEvent.click(rowA)
    await waitFor(() => expect(usePlayerStore.getState().currentTrack?.file_url).toBe('https://signed.example/a.mp3?t=1'))
    expect((usePlayerStore.getState().currentTrack as any).raw_file_url).toBe('audio/a.mp3')
  })
})

describe('GenerateClient 곡 목록 행 휴지통 아이콘', () => {
  it('행마다 휴지통 아이콘이 있고 누르면 확인 단계로 넘기며 곡은 재생되지 않는다', async () => {
    const onTrash = vi.fn()
    const { findByText, getAllByLabelText, container } = render(
      <GenerateClient user={{ id: 'u', email: 'u@x.y' }} onTrashTrack={onTrash} />,
    )
    await findByText('Song A')
    const btns = getAllByLabelText(/휴지통으로 이동|Move to trash/)
    expect(btns).toHaveLength(2)
    fireEvent.click(btns[0])
    expect(onTrash).toHaveBeenCalledTimes(1)
    expect(onTrash.mock.calls[0][0].id).toBe('a')
    expect(usePlayerStore.getState().currentTrack).toBeNull()
    // 상세 패널에는 큰 휴지통 버튼이 없다
    expect(container.textContent).not.toMatch(/휴지통으로 이동/)
  })

  it('공개 곡의 휴지통 아이콘은 비활성이다', async () => {
    const pub = [{ ...rows[0], is_published: true }, rows[1]]
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => pub })))
    const onTrash = vi.fn()
    const { findByText, getAllByLabelText } = render(<GenerateClient user={{ id: 'u', email: 'u@x.y' }} onTrashTrack={onTrash} />)
    await findByText('Song A')
    const btns = getAllByLabelText(/휴지통으로 이동|Move to trash/) as HTMLButtonElement[]
    expect(btns.filter((b) => b.disabled)).toHaveLength(1)
    fireEvent.click(btns.find((b) => b.disabled)!)
    expect(onTrash).not.toHaveBeenCalled()
  })
})
