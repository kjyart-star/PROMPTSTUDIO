// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LyricsHelper, { insertSection, LYRICS_MAX } from './LyricsHelper'

afterEach(cleanup)

describe('가사 도우미', () => {
  it('태그를 커서 위치에 끼우고 줄을 맞춘다', () => {
    expect(insertSection('', 'Verse', 0)).toEqual({ text: '[Verse]\n', pos: 8 })
    expect(insertSection('가나다', 'Chorus', 3).text).toBe('가나다\n\n[Chorus]\n')
  })
  it('버튼이 onChange 를 부르고 글자 수를 센다', () => {
    const onChange = vi.fn()
    render(<LyricsHelper uiLanguage="KO" value="abc" onChange={onChange} getCursor={() => 3} />)
    fireEvent.click(screen.getByText('[Bridge]'))
    expect(onChange).toHaveBeenCalledWith('abc\n\n[Bridge]\n', 14)
    expect(screen.getByText(/3 \/ 5,000 글자/)).toBeTruthy()
  })
  it('제한 초과를 알린다', () => {
    render(<LyricsHelper uiLanguage="KO" value={'x'.repeat(LYRICS_MAX + 1)} onChange={() => {}} getCursor={() => 0} />)
    expect(screen.getByText(/길이 제한을 넘었습니다/)).toBeTruthy()
  })
})
