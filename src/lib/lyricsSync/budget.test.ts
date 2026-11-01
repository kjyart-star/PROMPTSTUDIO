import { describe, it, expect } from 'vitest'
import { DAILY_NEURON_CAP, FREE_DAILY_NEURONS, MemoryBudgetStore, estimateNeurons, withBudget } from './budget'

const day1 = new Date('2026-11-02T10:00:00Z')
const day2 = new Date('2026-11-03T00:00:01Z')

describe('Workers AI 무료 한도 하드 상한', () => {
  it('예상치가 실측(3분 곡 117~140 뉴런)보다 크게 잡힌다', () => {
    expect(estimateNeurons(180)).toBeGreaterThanOrEqual(150)
    expect(estimateNeurons(0)).toBe(estimateNeurons(600)) // 길이를 모르면 최대 길이로
  })
  it('하루 사용량이 상한(9,000)을 넘지 않고, 넘을 차례가 되면 그날은 멈춘다', async () => {
    const store = new MemoryBudgetStore()
    let calls = 0
    for (let i = 0; i < 200; i++) {
      const r = await withBudget(store, 180, async () => { calls++; return { value: 1, neurons: 140 } }, day1)
      if (!r) break
    }
    const u = await store.usage('2026-11-02')
    expect(u.used).toBeLessThanOrEqual(DAILY_NEURON_CAP)
    expect(u.used + estimateNeurons(180)).toBeGreaterThan(DAILY_NEURON_CAP - 140) // 상한 근처까지 썼다
    expect(calls).toBeGreaterThan(50)
    // 같은 날 더 부르면 부르지 않는다
    let called = false
    expect(await withBudget(store, 180, async () => { called = true; return { value: 1, neurons: 140 } }, day1)).toBeNull()
    expect(called).toBe(false)
  })
  it('다음 날(UTC)에는 새로 센다', async () => {
    const store = new MemoryBudgetStore()
    store.rows.set('2026-11-02', { used: DAILY_NEURON_CAP, reserved: 0 })
    expect(await withBudget(store, 180, async () => ({ value: 1, neurons: 140 }), day1)).toBeNull()
    expect(await withBudget(store, 180, async () => ({ value: 1, neurons: 140 }), day2)).toEqual({ value: 1, neurons: 140 })
  })
  it('호출이 실패하거나 사용량을 모르면 예상치를 쓴 것으로 센다', async () => {
    const store = new MemoryBudgetStore()
    await expect(withBudget(store, 180, async () => { throw new Error('ai down') }, day1)).rejects.toThrow('ai down')
    await withBudget(store, 180, async () => ({ value: 1, neurons: null }), day1)
    expect((await store.usage('2026-11-02')).used).toBe(estimateNeurons(180) * 2)
    expect((await store.usage('2026-11-02')).reserved).toBe(0)
  })
  it('상한을 무료 할당 위로 올려 부를 수 없고, 10분 넘는 곡은 보내지 않는다', async () => {
    const store = new MemoryBudgetStore()
    store.rows.set('2026-11-02', { used: DAILY_NEURON_CAP - 10, reserved: 0 })
    expect(await withBudget(store, 180, async () => ({ value: 1, neurons: 140 }), day1, FREE_DAILY_NEURONS + 5000)).toBeNull()
    await expect(withBudget(store, 601, async () => ({ value: 1, neurons: 1 }), day2)).rejects.toThrow('too-long')
  })
  it('동시에 여러 번 예약해도 합이 상한을 넘지 않는다', async () => {
    const store = new MemoryBudgetStore()
    const results = await Promise.all(Array.from({ length: 120 }, () => withBudget(store, 180, async () => ({ value: 1, neurons: estimateNeurons(180) }), day1)))
    const ok = results.filter(Boolean).length
    expect(ok * estimateNeurons(180)).toBeLessThanOrEqual(DAILY_NEURON_CAP)
    expect((await store.usage('2026-11-02')).used).toBeLessThanOrEqual(DAILY_NEURON_CAP)
  })
})
