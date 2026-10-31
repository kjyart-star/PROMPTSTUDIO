// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import TrackMenu from './TrackMenu'

afterEach(cleanup)

const base = (over: any = {}) => ({
  uiLanguage: 'KO' as const,
  item: { id: 'a', title: '곡', lyrics: '가사', is_published: false, playlist_id: null, status: 'completed', audio_url: 'audio/a.mp3', suno_task_id: 'apipass:T', form: { suno_audio_id: 'A1' } },
  playlists: [{ id: 'p1', title: '아침' }],
  signedIn: true,
  buttonClass: 'b', iconClass: 'i',
  onUpdate: vi.fn(), onRestorePrompt: vi.fn(), onPublish: vi.fn(), onMastering: vi.fn(), onQuickMaster: vi.fn(), onEditTiming: vi.fn(), onAlbumArt: vi.fn(), onStem: vi.fn(), artMilli: 1000, stemMilli: 3000, onDownload: vi.fn(), onTrash: vi.fn(),
  ...over,
})

describe('TrackMenu', () => {
  it('휴지통·내려받기·재생목록 추가가 동작한다', () => {
    const p = base()
    render(<TrackMenu {...p} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('재생목록에 추가 ›'))
    fireEvent.click(screen.getByText('아침'))
    expect(p.onUpdate).toHaveBeenCalledWith({ playlist_id: 'p1' })
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('내려받기'))
    expect(p.onDownload).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('휴지통으로 이동'))
    expect(p.onTrash).toHaveBeenCalled()
  })

  it('공개된 곡은 휴지통 항목이 비활성이고 안내가 보인다', () => {
    const p = base({ item: { id: 'a', is_published: true, form: {} } })
    render(<TrackMenu {...p} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    expect((screen.getByText('휴지통으로 이동') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(/공개된 곡은 휴지통으로 보낼 수 없습니다/).length).toBeGreaterThan(0)
  })

  it('제목·가사 수정 저장', async () => {
    const p = base()
    render(<TrackMenu {...p} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('제목 · 가사 수정'))
    fireEvent.change(screen.getByDisplayValue('곡'), { target: { value: '새 제목' } })
    fireEvent.click(screen.getByText('[Chorus]'))
    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => expect(p.onUpdate).toHaveBeenCalled())
    const arg = p.onUpdate.mock.calls[0][0]
    expect(arg.title).toBe('새 제목')
    expect(arg.lyrics).toContain('[Chorus]')
  })

  it('LRC 파일을 읽어 lrc 로 저장한다', async () => {
    const p = base()
    const { container } = render(<TrackMenu {...p} />)
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    const file = new File(['[00:01.00]안녕\n[00:05.00]반가워'], 'a.lrc')
    ;(file as any).text = async () => '[00:01.00]안녕\n[00:05.00]반가워'
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(p.onUpdate).toHaveBeenCalledWith({ lrc: [{ t: 1, text: '안녕' }, { t: 5, text: '반가워' }] }))
  })

  it('마스터링은 간단 창, 고급은 기존 화면으로 간다', () => {
    const p = base()
    render(<TrackMenu {...p} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('마스터링'))
    expect(p.onQuickMaster).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('더보기'))
    fireEvent.click(screen.getByText('고급 마스터링'))
    expect(p.onMastering).toHaveBeenCalled()
  })

  it('시간표가 있는 곡에만 LRC 내보내기가 보인다', () => {
    const none = base()
    const { unmount } = render(<TrackMenu {...none} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    expect(screen.queryByText('LRC 내보내기')).toBeNull()
    unmount()
    render(<TrackMenu {...base({ item: { id: 'a', form: { lrc: [{ t: 1, text: 'x' }] } } })} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    expect(screen.getByText('LRC 내보내기')).toBeTruthy()
  })

  it('유료 항목에는 ✦ 크레딧 표기가 붙고 스템이 끝난 곡은 「스템 보기」로 바뀐다', () => {
    const p = base()
    const { unmount } = render(<TrackMenu {...p} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    expect(screen.getByText('✦1')).toBeTruthy()
    expect(screen.getByText('✦3')).toBeTruthy()
    fireEvent.click(screen.getByText(/앨범아트 만들기/))
    expect(p.onAlbumArt).toHaveBeenCalled()
    unmount()
    render(<TrackMenu {...base({ item: { id: 'a', form: { stems: { status: 'done' } } } })} />)
    fireEvent.click(screen.getByLabelText('더보기'))
    expect(screen.getByText('스템 보기')).toBeTruthy()
  })

  it('스템을 나눌 수 없는 곡(올린 파일·id 없는 예전 곡·kie)은 메뉴에서 아예 숨긴다', () => {
    for (const item of [
      { id: 'u', status: 'completed', audio_url: 'audio/u.mp3', form: { source: 'upload' } },
      { id: 'o', status: 'completed', audio_url: 'audio/o.mp3', suno_task_id: 'task_old', form: {} },
      { id: 'k', status: 'completed', audio_url: 'audio/k.mp3', suno_task_id: 'kie:T', form: { suno_audio_id: 'x' } },
    ]) {
      const { unmount } = render(<TrackMenu {...base({ item })} />)
      fireEvent.click(screen.getByLabelText('더보기'))
      expect(screen.queryByText(/스템 분리|스템 보기/)).toBeNull()
      expect(screen.getByText('앨범아트 만들기 · 올리기')).toBeTruthy()
      unmount()
    }
  })
})
