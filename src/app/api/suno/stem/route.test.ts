import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ── 가짜 원장: 차감·환불을 기록하고, 같은 멱등키는 이전 결과를 돌려준다(워커와 같은 규칙) ── */
const ledger: { id: string; key: string; amount: number; refunded: boolean }[] = []
let balance = 10
const spendMock = vi.fn(async (p: any) => {
  const hit = ledger.find((l) => l.key === p.idempotencyKey)
  if (hit) return { ok: true, ledgerId: hit.id, balance }
  if (balance < 3) return { ok: false, kind: 'insufficient', balance, required: 3 }
  balance -= 3
  const e = { id: `L${ledger.length + 1}`, key: p.idempotencyKey, amount: 3, refunded: false }
  ledger.push(e)
  return { ok: true, ledgerId: e.id, balance }
})
const refundMock = vi.fn(async (id: string) => {
  const e = ledger.find((l) => l.id === id)
  if (!e) return { ok: false }
  if (!e.refunded) { e.refunded = true; balance += e.amount }
  return { ok: true }
})
vi.mock('@/lib/credits/suite', () => ({
  spendCredits: (p: any) => spendMock(p),
  refundCredits: (id: string) => refundMock(id),
  creditErrorResponse: (r: any) => new Response(JSON.stringify({ error: r.kind }), { status: r.kind === 'insufficient' ? 402 : 503 }),
}))
vi.mock('@/lib/auth/aiGate', () => ({ requireAiAccess: async () => ({ ok: true }) }))
vi.mock('@/lib/suite/provider', () => ({ SUNO_COST_USD_PER_SONG: { apipass: 0.06, kie: 0.06 }, reportProviderUsage: vi.fn() }))

let row: any
const supa = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    update: (patch: any) => ({ eq: () => ({ eq: async () => { row = { ...row, ...patch }; return { error: null } } }) }),
  }),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'https://signed/x' } }) }) } }),
}))

let createOutcome: any
let statusOutcome: any
vi.mock('@/lib/suno/channel', async () => {
  const actual = await vi.importActual<any>('@/lib/suno/channel')
  return { ...actual, createStemTask: vi.fn(async () => createOutcome), getSunoStatus: vi.fn(async () => statusOutcome) }
})
globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))) as any

import { POST, GET } from './route'

const post = async () => (await POST(new Request('http://x/api/suno/stem', { method: 'POST', body: JSON.stringify({ historyId: 'h1' }) })))!
const get = async () => (await GET(new Request('http://x/api/suno/stem?historyId=h1')))!

beforeEach(() => {
  ledger.length = 0; balance = 10; spendMock.mockClear(); refundMock.mockClear()
  row = { id: 'h1', user_id: 'u1', title: '곡', status: 'completed', audio_url: 'audio/h1.mp3', suno_task_id: 'apipass:T1', form: { suno_audio_id: 'A1' } }
  createOutcome = { ok: true, taskRef: 'apipass:S1', channel: 'apipass' }
  statusOutcome = { ok: true, channel: 'apipass', state: 'processing', results: [] }
})

describe('스템 분리 — 크레딧 원장 정합', () => {
  it('접수 성공: 3CR 한 번 차감, 환불 없음', async () => {
    const r = await post()
    expect((await r.json()).status).toBe('processing')
    expect(ledger).toHaveLength(1)
    expect(balance).toBe(7)
    expect(refundMock).not.toHaveBeenCalled()
  })

  it('같은 곡을 연타해도 한 번만 빠진다', async () => {
    await post(); await post(); await post()
    expect(ledger).toHaveLength(1)
    expect(balance).toBe(7)
  })

  it('접수 실패: 차감 뒤 즉시 환불, 잔액 원상복구', async () => {
    createOutcome = { ok: false, message: 'x', attempts: [] }
    const r = await post()
    expect(r.status).toBe(502)
    expect((await r.json()).refunded).toBe(true)
    expect(balance).toBe(10)
    expect(ledger[0].refunded).toBe(true)
  })

  it('접수 실패 뒤 다시 누르면 새 멱등키로 새로 차감된다(옛 환불 차감을 재사용하지 않는다)', async () => {
    createOutcome = { ok: false, message: 'x', attempts: [] }
    await post()
    createOutcome = { ok: true, taskRef: 'apipass:S2', channel: 'apipass' }
    await post()
    expect(ledger).toHaveLength(2)
    expect(ledger[0].key).not.toBe(ledger[1].key)
    expect(balance).toBe(7)
  })

  it('잔액이 모자라면 공급사를 부르지 않는다', async () => {
    balance = 1
    const { createStemTask } = await import('@/lib/suno/channel')
    ;(createStemTask as any).mockClear()
    const r = await post()
    expect(r.status).toBe(402)
    expect(createStemTask).not.toHaveBeenCalled()
  })

  it('공급사 쪽 실패: 확인할 때 한 번만 환불, 여러 번 확인해도 한 번', async () => {
    await post()
    statusOutcome = { ok: true, channel: 'apipass', state: 'failed', results: [] }
    expect((await (await get()).json()).status).toBe('failed')
    await get(); await get()
    expect(ledger[0].refunded).toBe(true)
    expect(balance).toBe(10)
    expect(refundMock.mock.calls.filter(([id]) => id === ledger[0].id).length).toBe(1)
  })

  it('완료: 두 트랙 저장·서명 주소 반환, 추가 차감 없음', async () => {
    await post()
    statusOutcome = { ok: true, channel: 'apipass', state: 'succeeded', results: [
      { id: 'a', type: 'instrumental', audio_url: 'https://c/i.mp3' }, { id: 'b', type: 'vocals', audio_url: 'https://c/v.mp3' }] }
    const body = await (await get()).json()
    expect(body.status).toBe('done')
    expect(body.vocalsUrl).toBeTruthy()
    expect(row.form.stems.vocals).toContain('vocals')
    expect(ledger).toHaveLength(1)
    expect(balance).toBe(7)
    // 이미 끝난 곡을 다시 누르면 새로 빠지지 않는다
    await post()
    expect(ledger).toHaveLength(1)
  })

  it('원본 곡 id 가 없으면(옛 곡·조회 실패) 돈을 받기 전에 막는다', async () => {
    row.form = {}
    statusOutcome = { ok: false, channel: 'apipass', message: 'x' }
    const r = await post()
    expect(r.status).toBe(409)
    expect(spendMock).not.toHaveBeenCalled()
  })

  it('kie 로 만든 곡은 지원하지 않는다고 알리고 차감하지 않는다', async () => {
    row.suno_task_id = 'kie:T1'
    const r = await post()
    expect(r.status).toBe(409)
    expect(spendMock).not.toHaveBeenCalled()
  })
})
