// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import { ImmersivePlayer } from './ImmersivePlayer'
import { usePlayerStore } from '@/stores/playerStore'

const trk = (id: string, extra: any = {}) =>
  ({ id, title: `곡 ${id}`, file_url: 'a', duration_sec: 120, lyrics: null, album: { title: '앨범', cover_url: `/c/${id}.png` }, ...extra }) as any

beforeEach(() => {
  const mem: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })
})
afterEach(cleanup)

describe('ImmersivePlayer', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    usePlayerStore.setState({ isImmersiveOpen: false, currentTrack: trk('1') })
    render(<ImmersivePlayer />)
    expect(screen.queryByTestId('immersive-player')).toBeNull()
  })

  it('시간표 없는 가사는 「가사 시간 추정」을 보이고 현재 줄을 강조한다', () => {
    const t = trk('1', { lyrics: '첫째 줄입니다\n둘째 줄입니다\n셋째 줄입니다' })
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 100, duration: 120, isPlaying: false })
    render(<ImmersivePlayer />)
    expect(screen.getByText('가사 시간 추정')).toBeTruthy()
    expect(screen.getByText('셋째 줄입니다').getAttribute('aria-current')).toBe('true')
  })

  it('시간표가 있는 가사는 추정 표시가 없다', () => {
    const t = trk('1', { lyrics: '[00:01.00]하나\n[00:10.00]둘' })
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, currentTime: 11, duration: 120 })
    render(<ImmersivePlayer />)
    expect(screen.queryByText('가사 시간 추정')).toBeNull()
    expect(screen.getByText('둘').getAttribute('aria-current')).toBe('true')
  })

  it('가사가 없으면 안내 문구', () => {
    const t = trk('1')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0 })
    render(<ImmersivePlayer />)
    expect(screen.getByText('등록된 가사가 없습니다')).toBeTruthy()
  })

  it('재생목록이면 커버플로우가 기본이고 옆 커버를 누르면 그 곡을 재생한다', () => {
    const q = [trk('1'), trk('2'), trk('3')]
    const playTrack = vi.fn()
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: q[1], queue: q, queueIndex: 1, playTrack })
    render(<ImmersivePlayer />)
    expect(screen.getByText('02 / 03', { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('곡 3'))
    expect(playTrack).toHaveBeenCalledWith(q[2], q)
  })

  it('곡이 하나여도 「지금 재생 / 재생목록」 토글이 있고 재생목록 보기로 바꿀 수 있다', () => {
    const t = trk('1', { style_prompt: 'dreamy synth pop' })
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0 })
    render(<ImmersivePlayer />)
    expect(screen.getByText('지금 재생').closest('button')!.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByText('재생목록'))
    expect(screen.getByTestId('playlist-coverflow')).toBeTruthy()
    expect(screen.getByText('dreamy synth pop')).toBeTruthy()
    fireEvent.click(screen.getByText('지금 재생'))
    expect(screen.queryByTestId('playlist-coverflow')).toBeNull()
  })

  it('커버플로: 좌우 키는 미리보기만 옮기고 멈춘 뒤에야 재생하며, 「지금 재생 중인 곡으로」로 되돌릴 수 있다', () => {
    vi.useFakeTimers()
    try {
      const q = [trk('1'), trk('2'), trk('3')]
      const playTrack = vi.fn()
      usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: q[1], queue: q, queueIndex: 1, playTrack })
      render(<ImmersivePlayer />)
      act(() => { fireEvent.keyDown(window, { key: 'ArrowRight' }) })
      expect(playTrack).not.toHaveBeenCalled()
      expect(screen.getByText('03 / 03', { exact: false })).toBeTruthy()
      act(() => { vi.advanceTimersByTime(800) })
      expect(playTrack).toHaveBeenLastCalledWith(q[2], q)
      // 되돌리기
      usePlayerStore.setState({ currentTrack: q[1], queueIndex: 1 })
      act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })
      act(() => { fireEvent.click(screen.getByText('지금 재생 중인 곡으로')) })
      act(() => { vi.advanceTimersByTime(1000) })
      expect(playTrack).toHaveBeenCalledTimes(1)
      expect(screen.getByText('02 / 03', { exact: false })).toBeTruthy()
    } finally { vi.useRealTimers() }
  })

  it('첫 곡에서 왼쪽 키는 아무것도 하지 않는다', () => {
    const q = [trk('1'), trk('2')]
    const playTrack = vi.fn()
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: q[0], queue: q, queueIndex: 0, playTrack })
    render(<ImmersivePlayer />)
    act(() => { fireEvent.keyDown(window, { key: 'ArrowLeft' }) })
    expect(playTrack).not.toHaveBeenCalled()
  })

  it('가사형 커버 뒤에 LP 판이 있고, 카세트 디자인은 버튼이 재생 상태에 연결된다', () => {
    const t = trk('1')
    const togglePlay = vi.fn(); const seek = vi.fn()
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0, isPlaying: false, togglePlay, seek, currentTime: 20, duration: 120 })
    render(<ImmersivePlayer />)
    expect(screen.getByTestId('lp-disc')).toBeTruthy()
    fireEvent.click(screen.getByText('카세트'))
    expect(screen.getByTestId('cassette-player')).toBeTruthy()
    expect(screen.getByText('020')).toBeTruthy()
    const deck = within(screen.getByTestId('cassette-player'))
    fireEvent.click(deck.getByLabelText('재생'))
    expect(togglePlay).toHaveBeenCalledTimes(1)
    fireEvent.click(deck.getByLabelText('빨리감기'))
    expect(seek).toHaveBeenLastCalledWith(30)
  })

  it('닫아도 사라지는 움직임이 끝날 때까지는 화면이 남아 있다', () => {
    vi.useFakeTimers()
    try {
      const t = trk('1')
      usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0 })
      render(<ImmersivePlayer />)
      act(() => { usePlayerStore.setState({ isImmersiveOpen: false }) })
      expect(screen.getByTestId('immersive-player').className).toContain('imm-out')
      act(() => { vi.advanceTimersByTime(400) })
      expect(screen.queryByTestId('immersive-player')).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('디자인을 고르면 기억하고 다시 열 때 그 디자인으로 열린다', () => {
    const q = [trk('1'), trk('2'), trk('3')]
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: q[1], queue: q, queueIndex: 1 })
    const r = render(<ImmersivePlayer />)
    fireEvent.click(screen.getByText('원통형'))
    expect(document.querySelector('.pcf-arc')).toBeTruthy()
    r.unmount()
    render(<ImmersivePlayer />)
    expect(document.querySelector('.pcf-arc')).toBeTruthy()
    fireEvent.click(screen.getByText('지금 재생'))
    fireEvent.click(screen.getByText('카드형'))
    expect(document.querySelector('.imm-framed')).toBeTruthy()
  })

  it('Esc 로 닫힌다', () => {
    const t = trk('1')
    usePlayerStore.setState({ isImmersiveOpen: true, currentTrack: t, queue: [t], queueIndex: 0 })
    render(<ImmersivePlayer />)
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(usePlayerStore.getState().isImmersiveOpen).toBe(false)
  })
})
