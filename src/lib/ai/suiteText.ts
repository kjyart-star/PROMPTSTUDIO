/**
 * 스튜디오의 텍스트 생성 — **쿠키플레이 게이트웨이 경유.**
 *
 * **서버 전용.** 사용자 access_token 을 서버에서 꺼내 쓴다.
 *
 * ## 왜 이 파일이 생겼나 (2026-09-07)
 * 프롬프트·가사 생성은 `api.openai.com` 을 **직접** 불렀다. 스위트에 남아 있던 마지막
 * 직접 연동이라 대표 원칙 「AI 는 게이트웨이 경유 최저가로」에 어긋났다(4K 미지원·1인
 * 기업 운영 부담). 이제 워커의 공용 텍스트 경로 한 곳으로 들어간다.
 *
 *   POST {base}/v1/ai/texts   (Bearer = 사용자 토큰)
 *
 * 게이트웨이를 거치면 이 저장소가 **더 안 해도 되는 일**이 이만큼이다:
 *   · 공급사 키 보관 — 키는 워커의 D1 에 암호화돼 있다(여기엔 없다)
 *   · 크레딧 선차감·자동 환불 — 워커가 `action` 단가표로 직접 한다
 *   · 원가·토큰 기록, 월 지출 상한, 공급사 장애 시 폴백
 *   · 실패 갈래별 한국어 문구 — 워커가 갈래(failureCode)와 문구를 같이 내려 준다
 * 그래서 이 파일에는 **차감 코드가 없다.** 예전처럼 여기서 한 번 더 빼면 두 번 빠진다.
 *
 * ## 모델
 * 화면은 아직 OpenAI 이름(gpt-4o-mini · gpt-4o · o3-mini)으로 고른다. 그 이름은
 * **차감 단가표의 action id 이기도 해서** 바꾸면 정본(`credit_prices`)이 흔들린다.
 * 그래서 화면 이름은 그대로 두고, 실제로 부를 모델만 여기서 옮긴다 —
 * 근거는 COOKIELAB `docs/text-gateway-2026-09.md` §6 의 재산정 표다.
 */
import { NextResponse } from 'next/server'
import {
  SERVICE_ID,
  SUITE_API_BASE,
  suiteAccessToken,
  type CreditAction,
} from '@/lib/credits/suite'

/** 화면이 고르는 이름. PROVIDERS.openai.models 와 같은 목록이다. */
export type StudioModelChoice = 'gpt-4o-mini' | 'gpt-4o' | 'o3-mini'

/**
 * 화면 이름 → { 실제로 부를 게이트웨이 모델, 차감 action }.
 *
 * o3-mini 는 예전 코드도 gpt-4o-mini 로 내려보냈다(허용 목록에 없었다) — 그 동작을
 * 그대로 지킨다. 단가표에 별칭 행이 따로 있지만 실제로 걸린 적이 없는 행이다.
 */
const TIERS: Record<StudioModelChoice, { model: string; action: CreditAction }> = {
  'gpt-4o-mini': { model: 'gpt-5-nano', action: 'studio.prompt.gpt-4o-mini' },
  'o3-mini': { model: 'gpt-5-nano', action: 'studio.prompt.gpt-4o-mini' },
  'gpt-4o': { model: 'gpt-5-mini', action: 'studio.prompt.gpt-4o' },
}

/** 화면이 보낸 값을 등급으로 옮긴다. 모르는 값이면 기본 등급이다(예전 허용 목록과 같은 규칙). */
export function tierOf(raw: unknown): { model: string; action: CreditAction } {
  const key = typeof raw === 'string' ? raw : ''
  return TIERS[key as StudioModelChoice] ?? TIERS['gpt-4o-mini']
}

export type SuiteTextResult =
  | {
      ok: true
      text: string
      /** 단가 0 인 action 은 원장이 없다 — 그때는 null 이다 */
      ledgerId: string | null
      /** 밀리크레딧. 차감이 없었으면 null */
      balance: number | null
    }
  | { ok: false; status: number; message: string; balance?: number; required?: number }

/** 워커에 닿지도 못했을 때. 공급사 이름을 쓰지 않는다(내부 구현은 화면에 안 쓴다). */
const UNREACHABLE = '생성 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export interface SuiteTextParams {
  /** 화면이 고른 모델 이름(gpt-4o-mini 등). 등급·단가는 여기서 정한다 */
  choice: unknown
  system: string
  user: string
  /**
   * 같은 클릭이 두 번 닿아도 한 번만 빠지게 하는 키. **앞에 action 을 붙여서 보낸다** —
   * 같은 키로 등급만 바꿔 다시 부르면 워커가 「이미 처리한 요청」으로 보고 예전 답을
   * 그대로 돌려주기 때문이다(등급이 다르면 값도 단가도 다른 별개의 요청이다).
   */
  idempotencyKey: string
}

/**
 * 텍스트 한 판. **예외를 던지지 않는다** — 라우트가 응답을 정한다.
 *
 * 실패 문구는 워커가 준 한국어를 그대로 쓴다. 갈래(안전 필터·시간 초과·공급사 장애·
 * 잘못된 입력·크레딧 부족)마다 문장이 다르고, 사용자 잘못이 아닌 갈래는 워커가
 * **이미 환불까지 끝낸 뒤** 그 문구를 내려 준다. 여기서 문구를 다시 지어내면
 * 갈래가 뭉개진다.
 */
export async function generateSuiteText(params: SuiteTextParams): Promise<SuiteTextResult> {
  const token = await suiteAccessToken()
  if (!token) return { ok: false, status: 401, message: '로그인이 필요합니다.' }

  const { model, action } = tierOf(params.choice)

  let res: Response
  try {
    res = await fetch(`${SUITE_API_BASE}/v1/ai/texts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        serviceId: SERVICE_ID,
        action,
        model,
        system: params.system,
        // 게이트웨이는 대화 배열을 받는다. 한 판짜리라 사용자 차례 하나뿐이다.
        messages: [{ role: 'user', content: params.user }],
        idempotencyKey: `${action}:${params.idempotencyKey}`,
      }),
    })
  } catch {
    return { ok: false, status: 503, message: UNREACHABLE }
  }

  let body: any = null
  try {
    const raw = await res.text()
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = null
  }

  if (!res.ok) {
    const err = body?.error ?? {}
    if (res.status === 402) {
      return {
        ok: false,
        status: 402,
        message: '크레딧이 모자랍니다. 충전한 뒤 다시 시도해 주세요.',
        balance: Number(err.balanceMilli ?? err.balance ?? 0),
        required: Number(err.requiredMilli ?? err.required ?? 0),
      }
    }
    if (res.status === 401) return { ok: false, status: 401, message: '로그인이 필요합니다.' }
    console.warn(`[ai] 텍스트 실패 status=${res.status} action=${action} code=${err.code ?? '-'}`)
    return {
      ok: false,
      status: res.status,
      message: typeof err.message === 'string' && err.message ? err.message : UNREACHABLE,
    }
  }

  const text = typeof body?.text === 'string' ? body.text : ''
  if (!text.trim()) {
    // 200 인데 답이 비었다 — 공급사 장애로 본다(워커가 이미 환불한 자리는 아니므로
    // 부르는 쪽이 ledgerId 로 되돌린다).
    return {
      ok: false,
      status: 502,
      message: '지금은 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  return {
    ok: true,
    text,
    ledgerId: typeof body?.ledgerId === 'string' ? body.ledgerId : null,
    balance: typeof body?.balanceMilli === 'number' ? body.balanceMilli : null,
  }
}

/** 실패를 그대로 HTTP 응답으로. 402 는 화면이 부족분을 계산하므로 숫자를 같이 싣는다. */
export function suiteTextErrorResponse(
  result: Extract<SuiteTextResult, { ok: false }>,
): NextResponse {
  if (result.status === 402) {
    return NextResponse.json(
      {
        error: 'insufficient_credits',
        message: result.message,
        balance: result.balance ?? 0,
        required: result.required ?? 0,
      },
      { status: 402 },
    )
  }
  return NextResponse.json({ error: result.message }, { status: result.status })
}
