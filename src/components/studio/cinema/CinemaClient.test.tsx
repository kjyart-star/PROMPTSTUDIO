// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

vi.mock('../mastering/actions', () => ({ fetchLibrary: async () => ({ songs: [] }), fetchSongBlob: async () => new Blob() }))

import CinemaClient from './CinemaClient'

HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']

describe('CinemaClient', () => {
  it('템플릿 9종·형태 12종·색상 6종 이상·설정 항목이 보인다', () => {
    render(<CinemaClient />)
    expect(screen.getByRole('radiogroup', { name: '장면 템플릿' }).querySelectorAll('[role=radio]').length).toBe(9)
    expect(screen.getByRole('radiogroup', { name: '스펙트럼 형태' }).querySelectorAll('[role=radio]').length).toBe(12)
    expect(screen.getByRole('radiogroup', { name: '색상' }).querySelectorAll('[role=radio]').length).toBeGreaterThanOrEqual(6)
    for (const t of ['앨범 블러', '포토 스테이지', '바이닐 라운지', '페이퍼 플레이어', '시네마 플로우', '사운드 갤러리', '카세트', '레트로 TV', '코르크보드']) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    expect(screen.getByText('가사 영상')).toBeTruthy(); expect(screen.getByText('경음악 영상')).toBeTruthy()
    expect(screen.getByText('현재 설정 저장')).toBeTruthy()
    expect(screen.getByLabelText('전체 반복 횟수')).toBeTruthy()
    expect((screen.getByTestId('cinema-start') as HTMLButtonElement).disabled).toBe(true) // 곡이 없으면 만들 수 없다
    cleanup()
  })
  it('템플릿·형태를 고르면 선택 상태가 바뀐다', () => {
    render(<CinemaClient />)
    const g = screen.getByRole('radiogroup', { name: '장면 템플릿' })
    const radios = g.querySelectorAll('[role=radio]')
    fireEvent.click(radios[2])
    expect(radios[2].getAttribute('aria-checked')).toBe('true')
    expect(radios[0].getAttribute('aria-checked')).toBe('false')
    cleanup()
  })
})
