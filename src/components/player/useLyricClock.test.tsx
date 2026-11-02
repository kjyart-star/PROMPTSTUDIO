// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLyricClock } from './useLyricClock'

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

function audioAt(t: number) {
  const a = document.createElement('audio')
  Object.defineProperty(a, 'currentSrc', { get: () => 'blob:x' })
  let now = t
  Object.defineProperty(a, 'currentTime', { get: () => now, set: (v) => { now = v } })
  document.body.appendChild(a)
  return { set: (v: number) => { now = v } }
}
const lineOf = (t: number) => (t >= 10 ? 2 : t >= 5 ? 1 : 0)
const renders = { n: 0 }

describe('useLyricClock — 줄 강조는 오디오 실제 재생 시각을 프레임마다 읽는다', () => {
  it('재생 중에는 스토어 시각(timeupdate)이 늦어도 오디오 시각으로 바로 줄이 바뀐다', async () => {
    vi.useFakeTimers()
    const a = audioAt(4.9)
    const { result } = renderHook(() => useLyricClock(true, 4.0, lineOf, (x, y) => x === y))
    expect(result.current).toBe(0)
    a.set(5.02) // 스토어는 아직 4.0(다음 timeupdate 전)
    await act(async () => { await vi.advanceTimersByTimeAsync(20) })
    expect(result.current).toBe(1)
  })
  it('줄이 그대로면 다시 그리지 않는다', async () => {
    vi.useFakeTimers()
    const a = audioAt(6)
    renders.n = 0
    renderHook(() => { renders.n++; return useLyricClock(true, 6, lineOf, (x, y) => x === y) })
    const base = renders.n
    for (let i = 0; i < 30; i++) { a.set(6 + i * 0.05); await act(async () => { await vi.advanceTimersByTimeAsync(17) }) }
    expect(renders.n).toBe(base)
  })
  it('멈춰 있으면 스토어 시각(탐색 포함)으로 계산한다', () => {
    audioAt(0)
    const { result, rerender } = renderHook(({ t }) => useLyricClock(false, t, lineOf, (x, y) => x === y), { initialProps: { t: 3 } })
    expect(result.current).toBe(0)
    rerender({ t: 11 })
    expect(result.current).toBe(2)
  })
})
