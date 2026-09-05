/**
 * 스위트 공용 지갑 — 쿠키플레이 관리자단 워커(D1 원장)에 크레딧을 차감·환불한다.
 *
 * **서버 전용.** 클라이언트에서 부르지 말 것(사용자 access_token 을 서버에서 꺼내 쓴다).
 * 뮤직 앱은 더 이상 자기 지갑(profiles.credits)이나 localStorage 를 쓰지 않는다 —
 * 지갑은 스위트 전체에 하나뿐이고, 원장은 워커의 D1 에만 있다.
 *
 *   POST {base}/v1/credits/spend   선차감 (Bearer = 사용자 토큰)
 *   POST {base}/v1/credits/refund  환불   (X-Service-Token = 서비스 토큰)
 *   GET  {base}/v1/me              잔액 조회
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const SUITE_API_BASE = (
  process.env.NEXT_PUBLIC_COOKIEPLAY_API ?? 'https://cookieplay-admin-api.kjyart.workers.dev'
).replace(/\/+$/, '')

/** 크레딧·사용량이 이 id 로 갈린다(관리자단 D1 의 service_id). */
export const SERVICE_ID = 'cookiemusic'

/**
 * [임시] 단가표. 클라이언트가 보내는 amount 는 믿지 않고 서버가 이 표로 채운다.
 * 워커가 credit_prices 로 단가를 정하게 되면 amount 를 빼고 action 만 보낸다.
 */
export const CREDIT_PRICES = {
  'music.generate': 10,
  'music.cover': 10,
  'studio.prompt.gpt-4o-mini': 1,
  // o3-mini 는 generate-prompt 가 gpt-4o-mini 로 내려보내므로 화면 표시도 실제 차감과 같은 1 로 맞춘다
  'studio.prompt.o3-mini': 1,
  'studio.prompt.gpt-4o': 5,
} as const

export type CreditAction = keyof typeof CREDIT_PRICES

export type SpendResult =
  | { ok: true; ledgerId: string; balance: number }
  | { ok: false; kind: 'unauthorized' }
  | { ok: false; kind: 'insufficient'; balance: number; required: number }
  | { ok: false; kind: 'unavailable'; message: string }

export type BalanceResult =
  | { ok: true; balance: number }
  | { ok: false; kind: 'unauthorized' | 'unavailable' }

const UNAVAILABLE_MESSAGE = '크레딧 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 로그인한 사용자의 Supabase access_token. 없으면 빈 문자열. */
async function accessToken(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  } catch {
    return ''
  }
}

async function readJson(res: Response): Promise<any> {
  try {
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

/** 크레딧 선차감. 실패해도 예외를 던지지 않는다 — 라우트가 응답을 정한다. */
export async function spendCredits(params: {
  action: CreditAction
  idempotencyKey: string
  ref?: string
  reason?: string
}): Promise<SpendResult> {
  const token = await accessToken()
  if (!token) return { ok: false, kind: 'unauthorized' }

  const amount = CREDIT_PRICES[params.action]

  let res: Response
  try {
    res = await fetch(`${SUITE_API_BASE}/v1/credits/spend`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        serviceId: SERVICE_ID,
        action: params.action,
        amount,
        idempotencyKey: params.idempotencyKey,
        reason: params.reason ?? null,
        ref: params.ref ?? null,
      }),
    })
  } catch {
    return { ok: false, kind: 'unavailable', message: UNAVAILABLE_MESSAGE }
  }

  const body = await readJson(res)

  if (res.ok) {
    const ledgerId = body?.ledger?.id
    if (typeof ledgerId !== 'string') {
      return { ok: false, kind: 'unavailable', message: UNAVAILABLE_MESSAGE }
    }
    return { ok: true, ledgerId, balance: Number(body?.balance ?? 0) }
  }

  if (res.status === 401) return { ok: false, kind: 'unauthorized' }
  if (res.status === 402) {
    const err = body?.error ?? {}
    return {
      ok: false,
      kind: 'insufficient',
      balance: Number(err.balance ?? 0),
      required: Number(err.required ?? amount),
    }
  }

  console.warn(`[credits] spend 실패 status=${res.status} action=${params.action}`)
  return { ok: false, kind: 'unavailable', message: UNAVAILABLE_MESSAGE }
}

/**
 * 선차감한 크레딧을 되돌린다. 워커의 환불은 **서비스 토큰 전용**이라
 * Authorization 헤더를 붙이지 않는다(붙으면 워커가 Bearer 만 본다).
 */
export async function refundCredits(
  ledgerId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const serviceToken = process.env.COOKIEPLAY_SERVICE_TOKEN
  if (!serviceToken) {
    console.warn(`[credits] COOKIEPLAY_SERVICE_TOKEN 미설정 — 환불 불가 ledger=${ledgerId}`)
    return { ok: false }
  }

  try {
    const res = await fetch(`${SUITE_API_BASE}/v1/credits/refund`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-service-token': serviceToken,
      },
      body: JSON.stringify({ ledgerId, reason }),
    })
    if (!res.ok) {
      console.warn(`[credits] refund 실패 status=${res.status} ledger=${ledgerId}`)
      return { ok: false }
    }
    return { ok: true }
  } catch {
    console.warn(`[credits] refund 네트워크 실패 ledger=${ledgerId}`)
    return { ok: false }
  }
}

/** 지갑 잔액 조회. */
export async function getSuiteBalance(): Promise<BalanceResult> {
  const token = await accessToken()
  if (!token) return { ok: false, kind: 'unauthorized' }

  try {
    const res = await fetch(`${SUITE_API_BASE}/v1/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.status === 401) return { ok: false, kind: 'unauthorized' }
    if (!res.ok) return { ok: false, kind: 'unavailable' }
    const body = await readJson(res)
    return { ok: true, balance: Number(body?.wallet?.balance ?? 0) }
  } catch {
    return { ok: false, kind: 'unavailable' }
  }
}

/** 차감 실패를 그대로 HTTP 응답으로. */
export function creditErrorResponse(
  result: Extract<SpendResult, { ok: false }>,
): NextResponse {
  if (result.kind === 'unauthorized') {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  if (result.kind === 'insufficient') {
    return NextResponse.json(
      { error: 'insufficient_credits', balance: result.balance, required: result.required },
      { status: 402 },
    )
  }
  return NextResponse.json({ error: result.message }, { status: 503 })
}
