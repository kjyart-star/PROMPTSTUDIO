// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import GenerateQueue from './GenerateQueue'

afterEach(cleanup)

describe('GenerateQueue', () => {
  it('아무것도 없으면 그리지 않는다', () => {
    const { container } = render(<GenerateQueue uiLanguage="KO" tasks={[]} failedRows={[]} onRetry={() => {}} onDismiss={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
  it('진행 중 작업의 상태·진행률과 실패 행의 다시 실행/지우기', () => {
    const onRetry = vi.fn(); const onDismiss = vi.fn()
    render(<GenerateQueue uiLanguage="KO"
      tasks={[{ id: 't1', title: '비 오는 밤', status: 'processing', state: 'generating', progress: 42 }]}
      failedRows={[{ id: 'f1', title: '실패곡' }]} onRetry={onRetry} onDismiss={onDismiss} />)
    expect(screen.getByText('생성 중')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42')
    fireEvent.click(screen.getByText('설정 다시 불러오기'))
    expect(onRetry).toHaveBeenCalledWith({ id: 'f1', title: '실패곡' })
    fireEvent.click(screen.getByText('지우기'))
    expect(onDismiss).toHaveBeenCalled()
    expect(screen.getByText(/크레딧은 「음악 생성」 버튼을 눌러야 차감/)).toBeTruthy()
  })
})
