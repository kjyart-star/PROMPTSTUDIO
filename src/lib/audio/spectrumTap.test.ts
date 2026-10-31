import { describe, it, expect } from 'vitest'
import { binSpectrum, attachSpectrumTap } from './spectrumTap'

describe('binSpectrum', () => {
  it('n 개로 줄이고 0~1 범위다', () => {
    const r = binSpectrum(new Uint8Array(256).fill(255), 32)
    expect(r).toHaveLength(32)
    expect(Math.min(...r)).toBe(1)
    expect(binSpectrum(new Uint8Array(256), 8).every((v) => v === 0)).toBe(true)
  })
})

describe('attachSpectrumTap', () => {
  it('CORS 로 불러온 음원이 아니면 붙이지 않는다(무음 방지)', async () => {
    expect(await attachSpectrumTap({ crossOrigin: null } as unknown as HTMLAudioElement)).toBeNull()
  })
})
