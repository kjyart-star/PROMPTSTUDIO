import { describe, it, expect } from 'vitest'
import { PAID_FEATURES, worstCostKrw, meetsFloor, floorCredits, netMultiple } from './margin'
import { CREDIT_ACTIONS } from './suite'

/** 배포 게이트 — 모든 유료 기능은 CR×80 ≥ 최악 원가×2 를 지켜야 한다(대표 확정 2026-11-01). */
describe('유료 기능 마진 하한', () => {
  for (const f of PAID_FEATURES) {
    it(`${f.id}: ${f.credits}CR 이 최악 원가 ₩${worstCostKrw(f).toFixed(1)} ×2 이상`, () => {
      expect(meetsFloor(f)).toBe(true)
      expect(f.credits).toBeGreaterThanOrEqual(floorCredits(f))
      expect(Number.isInteger(f.credits)).toBe(true)
      expect(netMultiple(f)).toBeGreaterThan(1.9) // 결제 수수료까지 뺀 실수령도 거의 2배 이상
    })
  }
  it('쿠키뮤직 서비스의 유료 action 은 전부 CREDIT_ACTIONS 에 등록돼 있다', () => {
    for (const f of PAID_FEATURES.filter((x) => x.serviceId === 'cookiemusic')) {
      expect(CREDIT_ACTIONS as readonly string[]).toContain(f.action)
    }
  })
  it('원가가 불확실한 스텝은 큰 쪽($0.06)으로 잡혀 있다', () => {
    expect(PAID_FEATURES.find((f) => f.id === 'music.stem2')!.costUsd).toBeGreaterThanOrEqual(0.06)
  })
})
