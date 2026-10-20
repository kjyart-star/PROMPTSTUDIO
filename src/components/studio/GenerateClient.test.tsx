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
    expect(usePlayerStore.getState().currentTrack?.id).toBe('a')
    expect(usePlayerStore.getState().isPlaying).toBe(true)
    await waitFor(() => expect(detail()).toContain('Song A'))
    // 접힌 레일이 아니라 펼쳐진 패널이어야 한다
    expect(container.querySelector('aside button[aria-expanded="true"]')).not.toBeNull()

    fireEvent.click(rowB)
    expect(usePlayerStore.getState().currentTrack?.id).toBe('b')
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
