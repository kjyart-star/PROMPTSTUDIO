// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { batteryLow, canAutoAlign } from './lyricSyncClient'

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'
function nav(over: Record<string, unknown>) {
  const base = { userAgent: DESKTOP, maxTouchPoints: 0, deviceMemory: 8, connection: undefined, userAgentData: undefined }
  vi.stubGlobal('navigator', { ...base, ...over })
  vi.stubGlobal('Worker', class {})
}
afterEach(() => vi.unstubAllGlobals())

describe('기기 조건 — 브라우저가 가사 시간을 계산해도 되는지', () => {
  it('데스크톱(WebGPU 유무와 무관, 모델은 워커가 고른다)은 계산한다', () => {
    nav({}); expect(canAutoAlign()).toBe(true)
  })
  it('폰·태블릿(안드로이드·아이폰·아이패드OS)은 계산하지 않는다', () => {
    nav({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36' }); expect(canAutoAlign()).toBe(false)
    nav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' }); expect(canAutoAlign()).toBe(false)
    nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 }); expect(canAutoAlign()).toBe(false)
    nav({ userAgentData: { mobile: true } }); expect(canAutoAlign()).toBe(false)
  })
  it('데이터 절약·느린 회선·저메모리는 계산하지 않는다', () => {
    nav({ connection: { saveData: true } }); expect(canAutoAlign()).toBe(false)
    nav({ connection: { effectiveType: '3g' } }); expect(canAutoAlign()).toBe(false)
    nav({ deviceMemory: 2 }); expect(canAutoAlign()).toBe(false)
  })
  it('배터리 30% 미만이고 충전 중이 아니면 부족, 알 수 없으면 부족하지 않다', async () => {
    nav({ getBattery: async () => ({ level: 0.2, charging: false }) }); expect(await batteryLow()).toBe(true)
    nav({ getBattery: async () => ({ level: 0.2, charging: true }) }); expect(await batteryLow()).toBe(false)
    nav({}); expect(await batteryLow()).toBe(false)
  })
})

describe('공개 단계 계산 조건', () => {
  it('태블릿·폰 UA 여도 공개 단계에서는 계산한다(워커만 있으면)', async () => {
    const { canAlignForPublish } = await import('./lyricSyncClient')
    nav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 })
    expect(canAutoAlign()).toBe(false)
    expect(canAlignForPublish()).toBe(true)
  })
})
