// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LibraryTrash, { trashDaysLeft } from './LibraryTrash'

const old = new Date(Date.now() - 31 * 86_400_000).toISOString()
const fresh = new Date(Date.now() - 2 * 86_400_000).toISOString()
let calls: { url: string; method: string }[] = []

beforeEach(() => {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method || 'GET' })
    if (url.startsWith('/api/song-history?trash=1')) {
      return { ok: true, json: async () => [{ id: 'a', title: '새 곡', trashed_at: fresh }, { id: 'b', title: '옛 곡', trashed_at: old }] }
    }
    return { ok: true, json: async () => ({ success: true }) }
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('LibraryTrash', () => {
  it('남은 일수 계산', () => {
    expect(trashDaysLeft(fresh)).toBe(28)
    expect(trashDaysLeft(old)).toBeLessThanOrEqual(0)
  })

  it('남은 일수·정리 대상 표시, 자동 삭제 호출 없음', async () => {
    render(<LibraryTrash uiLanguage="KO" refreshKey={0} onRestored={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /휴지통/ }))
    expect(await screen.findByText('28일 남음')).toBeTruthy()
    expect(screen.getByText('정리 대상')).toBeTruthy()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
  })

  it('복원은 PUT, 영구 삭제는 확인 창을 거친다', async () => {
    const onRestored = vi.fn()
    render(<LibraryTrash uiLanguage="KO" refreshKey={0} onRestored={onRestored} />)
    fireEvent.click(await screen.findByRole('button', { name: /휴지통/ }))
    fireEvent.click((await screen.findAllByText('복원'))[0])
    await waitFor(() => expect(onRestored).toHaveBeenCalled())
    expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/a'))).toBe(true)

    fireEvent.click(screen.getAllByText('영구 삭제')[0])
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getAllByText('영구 삭제').pop()!)
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('permanent=1'))).toBe(true))
  })

  it('전체 비우기도 확인 후에만', async () => {
    render(<LibraryTrash uiLanguage="KO" refreshKey={0} onRestored={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /휴지통/ }))
    fireEvent.click(await screen.findByText('휴지통 비우기'))
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getAllByText('영구 삭제').pop()!)
    await waitFor(() => expect(calls.some((c) => c.url.includes('empty=1'))).toBe(true))
  })
})
