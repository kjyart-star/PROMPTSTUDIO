import { describe, it, expect, vi } from 'vitest'

let rpcResult: any = { data: 'ok', error: null }
const rpc = vi.fn(async () => rpcResult)
vi.mock('./openSwitch', () => ({ adminDb: () => ({ rpc }) }))
import { takeQuota, QUOTAS } from './usageLimit'

describe('유료 기능 남용 방지', () => {
  it('통과하면 null, 상한은 함수 인자로 전달', async () => {
    expect(await takeQuota('u1', 'stem')).toBeNull()
    expect(rpc).toHaveBeenCalledWith('studio_take_quota', { p_user: 'u1', p_feature: 'stem', p_burst: QUOTAS.stem.burst, p_burst_secs: QUOTAS.stem.burstSecs, p_daily: QUOTAS.stem.daily })
  })
  it('연타(burst)와 하루 상한(daily)은 429 와 각각 다른 안내', async () => {
    rpcResult = { data: 'burst', error: null }
    const b = (await takeQuota('u1', 'albumArt'))!
    expect(b.status).toBe(429); expect((await b.json()).code).toBe('burst')
    rpcResult = { data: 'daily', error: null }
    const d = (await takeQuota('u1', 'albumArt'))!
    expect(d.status).toBe(429); expect((await d.json()).error).toContain('내일')
  })
  it('DB 오류면 통과시키지 않는다(503)', async () => {
    rpcResult = { data: null, error: new Error('x') }
    expect((await takeQuota('u1', 'stem'))!.status).toBe(503)
  })
})
