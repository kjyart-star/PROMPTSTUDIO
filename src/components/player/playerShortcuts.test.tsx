// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import { createRef } from 'react'
import { handlePlayerShortcut } from './playerShortcuts'
import { ShortcutHelp } from './ShortcutHelp'
import { usePlayerStore } from '@/stores/playerStore'

const audio = () => { const a = document.createElement('audio'); Object.defineProperty(a, 'duration', { value: 200, configurable: true }); a.currentTime = 50 as any; return a }
const press = (key: string, init: KeyboardEventInit = {}, target: Element | Window = window) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  Object.defineProperty(ev, 'target', { value: target === window ? document.body : target })
  return handlePlayerShortcut(ev, ref)
}
let ref: any
const base = () => usePlayerStore.setState({
  currentTrack: { id: 'a', title: 'a' } as any, queue: [], queueIndex: 0, isPlaying: false, volume: 0.5, isMuted: false,
  isShuffle: false, repeatMode: 'off', isImmersiveOpen: false, isShortcutHelpOpen: false, currentTime: 50, duration: 200,
  togglePlay: vi.fn(), next: vi.fn(), prev: vi.fn(),
})
beforeEach(() => { ref = createRef(); ref.current = audio(); base() })
afterEach(() => { cleanup(); document.body.innerHTML = '' })

describe('플레이어 단축키', () => {
  it('Space·K 는 재생/일시정지', () => {
    press(' '); press('k')
    expect(usePlayerStore.getState().togglePlay).toHaveBeenCalledTimes(2)
  })
  it('←/→ 5초, J/L 10초, 0~9 는 10% 단위 위치', () => {
    press('ArrowRight'); expect(ref.current.currentTime).toBe(55)
    press('ArrowLeft'); expect(ref.current.currentTime).toBe(50)
    press('l'); expect(ref.current.currentTime).toBe(60)
    press('j'); expect(ref.current.currentTime).toBe(50)
    press('5'); expect(ref.current.currentTime).toBe(100)
    press('0'); expect(ref.current.currentTime).toBe(0)
  })
  it('Shift+←/→ 와 Shift+N/P 는 이전·다음 곡', () => {
    const s = usePlayerStore.getState()
    press('ArrowRight', { shiftKey: true }); expect(s.next).toHaveBeenCalledTimes(1)
    press('ArrowLeft', { shiftKey: true }); expect(s.prev).toHaveBeenCalledTimes(1)
    press('N', { shiftKey: true }); expect(s.next).toHaveBeenCalledTimes(2)
    press('P', { shiftKey: true }); expect(s.prev).toHaveBeenCalledTimes(2)
  })
  it('↑/↓ 볼륨 5%, M 음소거, S 셔플, R 반복, F 전체 화면', () => {
    press('ArrowUp'); expect(usePlayerStore.getState().volume).toBe(0.55)
    press('ArrowDown'); press('ArrowDown'); expect(usePlayerStore.getState().volume).toBe(0.45)
    expect(usePlayerStore.getState().volumeHudTick).toBeGreaterThan(0)
    press('m'); expect(usePlayerStore.getState().isMuted).toBe(true)
    press('s'); expect(usePlayerStore.getState().isShuffle).toBe(true)
    press('r'); expect(usePlayerStore.getState().repeatMode).toBe('all')
    press('f'); expect(usePlayerStore.getState().isImmersiveOpen).toBe(true)
    press('F'); expect(usePlayerStore.getState().isImmersiveOpen).toBe(false)
  })
  it('입력칸·IME 조합 중·Cmd/Ctrl 조합에서는 동작하지 않는다', () => {
    const inp = document.createElement('input'); document.body.appendChild(inp); inp.focus()
    expect(press('k', {}, inp)).toBe(false)
    inp.blur()
    const ce = document.createElement('div'); ce.setAttribute('contenteditable', 'true'); document.body.appendChild(ce)
    expect(press('k', {}, ce)).toBe(false)
    expect(press('k', { isComposing: true })).toBe(false)
    expect(press('r', { metaKey: true })).toBe(false)
    expect(press('f', { ctrlKey: true })).toBe(false)
    expect(usePlayerStore.getState().togglePlay).not.toHaveBeenCalled()
  })
  it('자체 단축키 화면(data-own-shortcuts)이 있으면 양보한다', () => {
    const d = document.createElement('div'); d.setAttribute('data-own-shortcuts', ''); document.body.appendChild(d)
    expect(press(' ')).toBe(false)
    expect(usePlayerStore.getState().togglePlay).not.toHaveBeenCalled()
  })
  it('커버플로 보기에서는 맨 방향키를 양보하지만 Shift+방향키는 동작한다', () => {
    const d = document.createElement('div'); d.setAttribute('data-testid', 'playlist-coverflow'); document.body.appendChild(d)
    expect(press('ArrowRight')).toBe(false)
    expect(ref.current.currentTime).toBe(50)
    press('ArrowRight', { shiftKey: true })
    expect(usePlayerStore.getState().next).toHaveBeenCalled()
  })
  it('? 는 안내 창을 열고 Esc 로 닫는다(전체 화면은 그대로)', () => {
    usePlayerStore.setState({ isImmersiveOpen: true })
    render(<ShortcutHelp />)
    act(() => { press('?') })
    expect(screen.getByRole('dialog', { name: '단축키 안내' })).toBeTruthy()
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(screen.queryByTestId('shortcut-help')).toBeNull()
  })
})
