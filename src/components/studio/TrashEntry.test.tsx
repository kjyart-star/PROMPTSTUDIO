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
  it('상세 패널은 onTrash 를 넘기지 않으면 휴지통 버튼이 없다(보관함·음악 생성 탭은 넘기지 않는다)', () => {
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
