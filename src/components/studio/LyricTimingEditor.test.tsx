// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { parseClock, formatClock, linesFromLyrics } from './lrc'

vi.mock('./mastering/actions', () => ({ fetchSongBlob: vi.fn(async () => new Blob(['x'])) }))
import LyricTimingEditor from './LyricTimingEditor'

afterEach(cleanup)

describe('가사 시간 도구', () => {
  it('시계 문자열 변환', () => {
    expect(parseClock('1:05.5')).toBe(65.5)
    expect(parseClock('abc')).toBeNull()
    expect(formatClock(65.5)).toBe('1:05.50')
  })
  it('가사 본문에서 섹션 태그·빈 줄을 뺀다', () => {
    expect(linesFromLyrics('[Verse]\n안녕\n\n[Chorus]\n반가워').map((l) => l.text)).toEqual(['안녕', '반가워'])
  })
})

describe('LyricTimingEditor', () => {
  it('시간을 직접 입력해 저장한다', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
    const onSave = vi.fn()
    render(<LyricTimingEditor song={{ id: 'a', title: '곡', lyrics: '[Verse]\n첫 줄\n둘째 줄' }} onSave={onSave} onClose={() => {}} />)
    expect((screen.getByText('저장') as HTMLButtonElement).disabled).toBe(true)
    const t2 = screen.getByLabelText('2번 줄 시간')
    fireEvent.change(t2, { target: { value: '0:09.00' } }); fireEvent.blur(t2)
    const t1 = screen.getByLabelText('1번 줄 시간')
    fireEvent.change(t1, { target: { value: '0:03.50' } }); fireEvent.blur(t1)
    fireEvent.click(screen.getByText('저장'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ t: 3.5, text: '첫 줄' }, { t: 9, text: '둘째 줄' }]))
  })

  it('사용자 LRC 가 없으면 자동 맞춤 결과를 초기값으로 불러오고, 옛 표시 없는 form.lrc 는 쓰지 않는다', () => {
    const auto = [{ t: 4, text: '자동 첫' }, { t: 9, text: '자동 둘' }]
    const { unmount } = render(<LyricTimingEditor song={{ id: 'a', lyrics: '첫\n둘', form: { lrc_auto: auto, lrc_auto_v: 2, lrc: [{ t: 1, text: '옛' }, { t: 2, text: '옛2' }] } }} onSave={() => {}} onClose={() => {}} />)
    expect((screen.getByLabelText('1번 줄 시간') as HTMLInputElement).value).toBe('0:04.00')
    unmount()
    render(<LyricTimingEditor song={{ id: 'b', lyrics: '첫\n둘', form: { lrc: [{ t: 1, text: '옛' }, { t: 2, text: '옛2' }] } }} onSave={() => {}} onClose={() => {}} />)
    expect((screen.getByLabelText('1번 줄 시간') as HTMLInputElement).value).not.toBe('0:01.00')
  })
})
