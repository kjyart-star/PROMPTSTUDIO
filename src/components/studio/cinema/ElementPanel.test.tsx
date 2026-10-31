// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ElementPanel } from './ElementPanel'
import { DEFAULT_SETTINGS } from './model'

describe('ElementPanel', () => {
  it('글자 요소: 크기·글꼴·색·그림자를 바꾸면 그 값으로 onPatch, 템플릿 기본값·실행 취소 버튼', () => {
    const onPatch = vi.fn(), onReset = vi.fn(), onUndo = vi.fn(), onClose = vi.fn()
    render(<ElementPanel el="title" adj={{}} onPatch={onPatch} onClose={onClose} onUndo={onUndo} onRedo={() => {}} onResetTemplate={onReset} settings={DEFAULT_SETTINGS} setSettings={() => {}} />)
    expect(screen.getByText('선택: 곡 제목')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('크기'), { target: { value: '150' } })
    expect(onPatch).toHaveBeenLastCalledWith({ scale: 1.5 })
    fireEvent.click(screen.getByText('손글씨'))
    expect(onPatch).toHaveBeenLastCalledWith({ font: 'hand' })
    fireEvent.change(screen.getByLabelText('그림자'), { target: { value: '40' } })
    expect(onPatch).toHaveBeenLastCalledWith({ shadow: 0.4 })
    fireEvent.click(screen.getByText('템플릿 기본값으로')); expect(onReset).toHaveBeenCalled()
    fireEvent.click(screen.getByText('실행 취소')); expect(onUndo).toHaveBeenCalled()
    fireEvent.click(screen.getByText('선택 풀기 (Esc)')); expect(onClose).toHaveBeenCalled()
    cleanup()
  })
  it('커버는 모서리·그림자, 스펙트럼은 형태 고르기가 보인다', () => {
    const { unmount } = render(<ElementPanel el="cover" adj={{}} onPatch={() => {}} onClose={() => {}} onUndo={() => {}} onRedo={() => {}} onResetTemplate={() => {}} settings={DEFAULT_SETTINGS} setSettings={() => {}} />)
    expect(screen.getByLabelText('모서리')).toBeTruthy(); unmount()
    render(<ElementPanel el="viz" adj={{}} onPatch={() => {}} onClose={() => {}} onUndo={() => {}} onRedo={() => {}} onResetTemplate={() => {}} settings={DEFAULT_SETTINGS} setSettings={() => {}} />)
    expect((screen.getByLabelText('스펙트럼 형태 고르기') as HTMLSelectElement).options.length).toBe(16)
    cleanup()
  })
})
