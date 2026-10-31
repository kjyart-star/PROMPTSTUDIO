import { describe, it, expect, vi, beforeEach } from 'vitest'

let quotaResult: any = null
vi.mock('@/lib/studio/usageLimit', () => ({ takeQuota: async () => quotaResult }))
vi.mock('@/lib/auth/aiGate', () => ({ requireAiAccess: async () => ({ ok: true }) }))
vi.mock('@/lib/credits/suite', () => ({ SUITE_API_BASE: 'https://w', suiteAccessToken: async () => 'tok' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://pub/a.png' } }) }) } }),
}))

const calls: { url: string; init?: any }[] = []
let priceMilli = 1000
let submit: { status: number; body: any }
let job: any
globalThis.fetch = vi.fn(async (url: any, init?: any) => {
  const u = String(url)
  calls.push({ url: u, init })
  if (u.includes('/v1/public/prices')) return new Response(JSON.stringify({ prices: [{ action: 'image.generate.gpt-image-2-5', creditsMilli: priceMilli }] }))
  if (u.endsWith('/v1/ai/images')) return new Response(JSON.stringify(submit.body), { status: submit.status })
  if (u.includes('/v1/ai/jobs/')) return new Response(JSON.stringify(job))
  if (u.startsWith('https://img')) return new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/png' } })
  return new Response('{}', { status: 404 })
}) as any

import { GET, POST } from './route'

const post = async (body: any) => (await POST(new Request('http://x/api/studio/album-art', { method: 'POST', body: JSON.stringify(body) })))!
const submits = () => calls.filter((c) => c.url.endsWith('/v1/ai/images'))

beforeEach(() => {
  quotaResult = null; calls.length = 0; priceMilli = 1000
  submit = { status: 200, body: { taskId: 'job:1', creditsMilli: 1000, balanceMilli: 9000 } }
})

describe('앨범아트 — 게이트웨이 차감 정합', () => {
  it('단가는 워커 단가표 값(✦1)이고 요청에 견적 상한·멱등키를 싣는다', async () => {
    const q = await (await GET(new Request('http://x/api/studio/album-art?quote=1')))!.json()
    expect(q.creditsMilli).toBe(1000)
    const r = await post({ prompt: 'cover', requestId: '11111111-1111-4111-8111-111111111111', maxCreditsMilli: 1000 })
    expect((await r.json()).taskId).toBe('job:1')
    const sent = JSON.parse(submits()[0].init.body)
    expect(sent).toMatchObject({ serviceId: 'cookieplay', model: 'gpt-image-2-5', ratio: '1:1', resolution: '1K', numImages: 1, maxCreditsMilli: 1000 })
    expect(sent.idempotencyKey).toBe('albumart:u1:11111111-1111-4111-8111-111111111111')
    expect(submits()[0].init.headers.authorization).toBe('Bearer tok')
  })

  it('확인한 값보다 단가가 올랐으면 차감 전에 막는다(게이트웨이를 부르지 않는다)', async () => {
    priceMilli = 2000
    const r = await post({ prompt: 'cover', maxCreditsMilli: 1000 })
    expect(r.status).toBe(409)
    expect(submits()).toHaveLength(0)
  })

  it('단가를 못 읽으면 시작하지 않는다', async () => {
    ;(globalThis.fetch as any).mockImplementationOnce(async () => new Response('x', { status: 500 }))
    const r = await post({ prompt: 'cover' })
    expect(r.status).toBe(503)
    expect(submits()).toHaveLength(0)
  })

  it('잔액 부족(402)은 그대로 알린다', async () => {
    submit = { status: 402, body: { error: { code: 'insufficient' } } }
    const r = await post({ prompt: 'cover', maxCreditsMilli: 1000 })
    expect(r.status).toBe(402)
  })

  it('설명이 비면 요청하지 않는다', async () => {
    expect((await post({ prompt: '  ' })).status).toBe(400)
    expect(submits()).toHaveLength(0)
  })

  it('실패 작업은 환불 여부를 그대로 전한다', async () => {
    job = { status: 'failed', error: '안전 필터', refunded: true, refundPending: false }
    const d = await (await GET(new Request('http://x/api/studio/album-art?taskId=job:1')))!.json()
    expect(d).toMatchObject({ status: 'failed', refunded: true })
  })

  it('성공하면 우리 스토리지로 옮긴 공개 주소를 준다', async () => {
    job = { status: 'succeeded', images: [{ url: 'https://img/a.png' }] }
    const d = await (await GET(new Request('http://x/api/studio/album-art?taskId=job:1')))!.json()
    expect(d).toEqual({ status: 'done', imageUrl: 'https://pub/a.png' })
  })

  it('연타·하루 상한에 걸리면 게이트웨이를 부르지 않는다', async () => {
    quotaResult = new Response(JSON.stringify({ error: 'x' }), { status: 429 })
    const r = await post({ prompt: 'cover', maxCreditsMilli: 1000 })
    expect(r.status).toBe(429)
    expect(submits()).toHaveLength(0)
  })
})
