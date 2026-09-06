/**
 * 스위트 공용 지갑 — 쿠키플레이 관리자단 워커(D1 원장)에 크레딧을 차감·환불한다.
 *
 * **서버 전용.** 클라이언트에서 부르지 말 것(사용자 access_token 을 서버에서 꺼내 쓴다).
 * 뮤직 앱은 더 이상 자기 지갑(profiles.credits)이나 localStorage 를 쓰지 않는다 —
 * 지갑은 스위트 전체에 하나뿐이고, 원장은 워커의 D1 에만 있다.
 *
 * 잔액·차감액은 전부 **밀리크레딧**이다(1 크레딧 = 1,000). 워커의 응답 필드는
 * 2026-09-07 부터 `balanceMilli`·`chargedMilli`·`requiredMilli` 로 이름에 단위를 달았고,
 * 옛 이름(`balance`·`charged`·`required`)도 한 릴리스 동안 같이 내려온다.
 * 여기서는 **새 이름을 먼저 보고 없으면 옛 이름**을 읽는다 — 두 저장소의 배포 순서가
 * 어긋나도 잔액이 0 으로 보이지 않게.
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
 * 이 앱이 차감을 거는 action 들. **값(단가)은 여기 적지 않는다.**
 *
 * 2026-09-07 까지는 이 자리에 밀리크레딧 사본표가 있었다. 그 사본이 정본과 갈라져서,
 * 워커는 4.4 를 빼는데 화면은 2 라고 적고 버튼에는 「10 크레딧」이 박혀 있었다 —
 * 사본이 셋이면 셋 다 틀린다. 그래서 사본을 지우고 **워커의 공개 단가 API 한 곳**만 본다.
 *
 *   GET {base}/v1/public/prices?serviceId=cookiemusic  →  [{ action, label, creditsMilli }]
 *
 * 그 API 가 읽는 D1 `credit_prices` 가 정본이고, 정본 문서는 COOKIELAB
 * `docs/credits-integer-nexus-2026-09.md`(2026-09-07) · `docs/pricing-seed-2026-09.json`,
 * 마이그레이션은 `0031_integer_credits_nexus.sql` 이다. 값이 바뀌어도 이 저장소는 손댈 것이 없다.
 *
 * 남는 위험은 값이 아니라 **action id 가 바뀌는 것**이라, 그것만
 * `npm run check:credits`(scripts/check-credit-actions.mjs)가 라이브 API 와 대조한다.
 */
export const CREDIT_ACTIONS = [
  'music.generate',
  'music.cover',
  'studio.prompt.gpt-4o-mini',
  // o3-mini 는 generate-prompt 가 gpt-4o-mini 로 내려보내지만 워커 단가표에는 별칭 행이 따로 있다
  'studio.prompt.o3-mini',
  'studio.prompt.gpt-4o',
] as const

export type CreditAction = (typeof CREDIT_ACTIONS)[number]

/** action → 밀리크레딧. 워커에 없는 action(꺼진 행)은 키 자체가 없다. */
export type CreditPriceMap = Partial<Record<CreditAction, number>>

/**
 * 이 서비스의 차감 단가를 워커에서 읽는다. 화면 문구는 **전부** 이 값으로 그린다.
 *
 * 실패하면 빈 표를 준다 — 화면은 「(N 크레딧)」 괄호를 통째로 빼고 그린다.
 * 틀린 숫자를 보여 주는 것보다 숫자를 안 보여 주는 것이 낫다(사용자가 속았다고 느끼는 자리다).
 * 워커가 60초 캐시를 달아 주므로 여기서도 같은 창으로 재검증한다.
 */
export async function fetchSuitePrices(): Promise<CreditPriceMap> {
  try {
    const res = await fetch(
      `${SUITE_API_BASE}/v1/public/prices?serviceId=${encodeURIComponent(SERVICE_ID)}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return {}
    const body = await res.json()
    const known = new Set<string>(CREDIT_ACTIONS)
    const prices: CreditPriceMap = {}
    for (const row of Array.isArray(body?.prices) ? body.prices : []) {
      if (!known.has(row?.action) || typeof row?.creditsMilli !== 'number') continue
      prices[row.action as CreditAction] = row.creditsMilli
    }
    return prices
  } catch {
    return {}
  }
}

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

  // amount 는 싣지 않는다 — 차감액은 워커의 단가표(credit_prices)가 정하고,
  // 사용자 토큰으로 amount 를 실어 보내면 워커가 400 으로 거부한다(2026-09-05 워커 변경).
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
    // 단가 0 인 action 은 원장 없이 통과한다(ledger: null, charged: 0) — 그것도 성공이다.
    const ledgerId = body?.ledger?.id
    if (typeof ledgerId !== 'string' && body?.ledger !== null) {
      return { ok: false, kind: 'unavailable', message: UNAVAILABLE_MESSAGE }
    }
    /* 워커가 2026-09-07 부터 `balanceMilli` 로 내려 준다. 옛 이름(`balance`)도
       한 릴리스 동안 같이 오므로 새 이름을 먼저 보고, 없으면 옛 이름으로 떨어진다. */
    return {
      ok: true,
      ledgerId: typeof ledgerId === 'string' ? ledgerId : '',
      balance: Number(body?.balanceMilli ?? body?.balance ?? 0),
    }
  }

  if (res.status === 401) return { ok: false, kind: 'unauthorized' }
  if (res.status === 402) {
    const err = body?.error ?? {}
    return {
      ok: false,
      kind: 'insufficient',
      balance: Number(err.balanceMilli ?? err.balance ?? 0),
      required: Number(err.requiredMilli ?? err.required ?? 0),
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
    return { ok: true, balance: Number(body?.wallet?.balanceMilli ?? body?.wallet?.balance ?? 0) }
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
