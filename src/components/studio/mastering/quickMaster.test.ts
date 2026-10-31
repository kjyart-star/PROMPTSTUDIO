import { describe, it, expect } from 'vitest'
import { quickTemplate, QUICK_LUFS, QUICK_PEAK, QUICK_TONES } from './quickMaster'

describe('간단 마스터링 템플릿', () => {
  it('고른 음량·피크가 템플릿과 리미터 천장에 그대로 들어간다', () => {
    for (const lufs of QUICK_LUFS) for (const tp of QUICK_PEAK) for (const tone of QUICK_TONES) {
      const t = quickTemplate('pop', tone, lufs, tp)
      expect(t.lufs).toBe(lufs)
      expect(t.tp).toBe(tp)
      expect(t.build().limiter.ceiling).toBe(tp)
    }
  })
})
