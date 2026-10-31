import { describe, it, expect } from 'vitest'
import { createSpectrumAnalyzer, BAR_COUNT } from './spectrum'
import { integratedLufs, gainToTarget } from './loudness'

function sine(freq: number, sec: number, fs = 48000, amp = 0.5): Float32Array {
  const a = new Float32Array(sec * fs)
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin(2 * Math.PI * freq * i / fs)
  return a
}

describe('spectrum', () => {
  it('고음 사인은 높은 쪽 막대, 저음 사인은 낮은 쪽 막대가 크다', () => {
    const fs = 48000
    const lo = createSpectrumAnalyzer([sine(120, 2), sine(120, 2)], fs)
    const hi = createSpectrumAnalyzer([sine(6000, 2), sine(6000, 2)], fs)
    let a = lo.at(0), b = hi.at(0)
    for (let t = 0.03; t < 1; t += 1 / 30) { a = lo.at(t); b = hi.at(t) }
    const peak = (x: Float32Array) => x.indexOf(Math.max(...x))
    expect(a.bars.length).toBe(BAR_COUNT)
    expect(peak(a.bars)).toBeLessThan(peak(b.bars))
    expect(Math.max(...a.bars)).toBeGreaterThan(0.5)
  })
  it('무음은 0에 가깝다', () => {
    const z = new Float32Array(48000)
    const s = createSpectrumAnalyzer([z, z], 48000).at(0.5)
    expect(Math.max(...s.bars)).toBeLessThan(0.02)
  })
  it('같은 입력이면 같은 값(결정적)', () => {
    const x = [sine(440, 1), sine(440, 1)]
    const r = (): number[] => { const s = createSpectrumAnalyzer(x, 48000); let o = s.at(0); for (let t = 0.03; t < 0.5; t += 1 / 30) o = s.at(t); return Array.from(o.bars) }
    expect(r()).toEqual(r())
  })
})

describe('loudness', () => {
  it('0.5 진폭 1kHz 사인은 약 -6 LUFS (두 채널 합산)', () => {
    const l = sine(1000, 5)
    const v = integratedLufs([l, l], 48000)
    expect(v).toBeGreaterThan(-6.4); expect(v).toBeLessThan(-5.6)
  })
  it('-14 목표로 맞추면 다시 쟀을 때 -14 근처', () => {
    const l = sine(1000, 5, 48000, 0.2)
    const g = gainToTarget([l, l], 48000, -14)
    const m = l.map(x => x * g.gain)
    expect(Math.abs(integratedLufs([m, m], 48000) + 14)).toBeLessThan(0.3)
  })
  it('피크가 넘치면 제한된다', () => {
    const l = sine(1000, 5, 48000, 0.9)
    const g = gainToTarget([l, l], 48000, 3)
    expect(g.limited).toBe(true); expect(g.gain * 0.9).toBeLessThanOrEqual(0.9801)
  })
})
