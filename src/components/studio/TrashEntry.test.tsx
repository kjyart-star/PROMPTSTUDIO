// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TrackDetailPanel } from './TrackDetailPanel'
import LibraryTrash from './LibraryTrash'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const panel = (track: any, onTrash?: () => void) => render(
  <TrackDetailPanel track={track} collapsed={false} onToggleCollapse={() => {}} onClose={() => {}} uiLanguage="KO"
    isPlaying={false} onPlayToggle={() => {}} onLikeToggle={() => {}} onDownload={() => {}} onLoadIntoForm={() => {}} onTrash={onTrash} />,
)

describe('휴지통 진입점', () => {
  it('상세 패널의 「휴지통으로 이동」이 동작한다', () => {
    const onTrash = vi.fn()
    panel({ id: 'a', title: '곡', is_published: false }, onTrash)
    fireEvent.click(screen.getAllByText('휴지통으로 이동')[0])
    expect(onTrash).toHaveBeenCalled()
  })
  it('공개된 곡은 상세 패널 휴지통 버튼이 비활성이다', () => {
    const onTrash = vi.fn()
    panel({ id: 'a', title: '곡', is_published: true }, onTrash)
    const bs = screen.getAllByText('휴지통으로 이동').map((e) => e.closest('button') as HTMLButtonElement)
    expect(bs.every((b) => b.disabled)).toBe(true)
    fireEvent.click(bs[0])
    expect(onTrash).not.toHaveBeenCalled()
  })
  it('onTrash 를 넘기지 않으면 버튼이 없다', () => {
    panel({ id: 'a', title: '곡' })
    expect(screen.queryByText('휴지통으로 이동')).toBeNull()
  })
  it('사이드바에서 연 휴지통은 처음부터 펼쳐져 목록과 복원·영구 삭제가 보인다(영구 삭제는 확인 창 뒤)', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`)
      return new Response(JSON.stringify([{ id: 't1', title: '지운 곡', trashed_at: new Date().toISOString() }]))
    }))
    render(<LibraryTrash defaultOpen uiLanguage="KO" refreshKey={0} onRestored={() => {}} />)
    expect(await screen.findByText('지운 곡')).toBeTruthy()
    fireEvent.click(screen.getByText('영구 삭제'))
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
