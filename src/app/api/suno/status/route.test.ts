import { describe, it, expect, vi, beforeEach } from 'vitest'

let balance = 10
const spent = new Set(['L1'])
const refunded = new Set<string>()
const refundMock = vi.fn(async (id: string) => {
  if (!spent.has(id)) return { ok: false }
  if (!refunded.has(id)) { refunded.add(id); balance += 3 }
  return { ok: true }
})
vi.mock('@/lib/credits/suite', () => ({ refundCredits: (id: string) => refundMock(id) }))
vi.mock('@/lib/lyricsSync/kick', () => ({ kickFreeQueue: vi.fn() }))
vi.mock('@/lib/suno/channel', () => ({ getSunoStatus: async () => ({ ok: true, channel: 'apipass', state: 'failed', results: [], message: 'x' }) }))

let row: any
const supa = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    update: (patch: any) => ({ eq: () => ({ eq: async () => { row = { ...row, ...patch }; return { error: null } } }) }),
  }),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))

import { GET } from './route'
const call = async () => (await GET(new Request('http://x/api/suno/status?taskId=T1&historyId=H1'))).json()

describe('suno/status 실패 자동 환불', () => {
  beforeEach(() => { balance = 10; refunded.clear(); refundMock.mockClear(); row = { id: 'H1', suno_task_id: 'T1', status: 'processing', form: { ledger_id: 'L1' } } })

  it('실패 확정 시 환불하고 안내 문구를 준다', async () => {
    const r = await call()
    expect(r).toMatchObject({ status: 'failed', refunded: true, message: '만들지 못해 크레딧을 돌려드렸어요.' })
    expect(balance).toBe(13)
    expect(row.form.refund.ok).toBe(true)
  })

  it('여러 번 확인해도 한 번만 환불한다', async () => {
    await call(); await call(); await call()
    expect(balance).toBe(13)
    expect(refundMock).toHaveBeenCalledTimes(1)
  })

  it('동시에 두 번 확인해도 잔액은 한 번만 늘어난다', async () => {
    await Promise.all([call(), call()])
    expect(balance).toBe(13)
  })

  it('원장 id 가 없는 옛 기록은 환불하지 않고 처리 중 문구를 준다', async () => {
    row.form = {}
    const r = await call()
    expect(r.refunded).toBe(false)
    expect(refundMock).not.toHaveBeenCalled()
  })

  it('환불 호출이 실패하면 표시를 남기지 않아 다음에 다시 시도한다', async () => {
    row.form = { ledger_id: 'NOPE' }
    expect((await call()).refunded).toBe(false)
    expect(row.form.refund).toBeUndefined()
    spent.add('NOPE')
    expect((await call()).refunded).toBe(true)
  })
})
