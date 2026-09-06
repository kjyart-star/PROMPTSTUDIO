/**
 * 공급사 키·지출을 쿠키플레이 관리자단과 맞춘다. **서버 전용.**
 *
 * 왜 있는가 — 스튜디오는 APIPASS 를 자기 서버에서 직접 부른다(게이트웨이를 거치지 않는다).
 * 그래도 대표가 보는 곳은 하나여야 한다: 키는 관리 화면에서 넣고, 이번 달 얼마 나갔는지도
 * 관리 화면에서 본다. 그 두 가지만 잇는 얇은 창구다.
 *
 *   GET  {base}/v1/internal/providers/apipass/secret   키를 받아 온다
 *   POST {base}/v1/internal/usage                      원가 한 건을 보낸다
 *
 * **키 순서: 환경변수가 먼저다.** Vercel 에 이미 들어 있는 APIPASS_API_KEY 가 있으면
 * 그 값을 쓰고 워커에 묻지 않는다 — 워커가 잠깐 안 될 때도 음악 생성은 계속 돌아야 한다.
 * 워커는 환경변수가 비었을 때의 길이다(키를 화면에서만 관리하고 싶을 때).
 */
import { SERVICE_ID, SUITE_API_BASE } from '@/lib/credits/suite'

/** 관리자단에 등록된 공급자 id(api_providers.id). */
const APIPASS_PROVIDER_ID = 'apipass'

/**
 * APIPASS 곡당 원가(USD). 2026-09 기준 13.2 APIPASS 크레딧 = $0.060.
 * 값이 바뀌면 여기 한 줄만 고친다 — 계산은 워커가 하지 않는다(그쪽엔 이 공급사 단가표가 없다).
 */
export const APIPASS_COST_USD_PER_SONG = 0.06

/** 워커에서 받아 온 키를 잠깐 들고 있는다 — 호출마다 물으면 감사 기록이 그만큼 쌓인다. */
const KEY_TTL_MS = 10 * 60 * 1000
let cachedKey: { value: string; at: number } | null = null

/**
 * APIPASS 키. 환경변수가 있으면 그 값, 없으면 워커에 저장된 값.
 * 둘 다 없으면 빈 문자열이다 — 부르는 쪽이 지금처럼 500 을 돌려주면 된다.
 */
export async function apipassKey(): Promise<string> {
  const fromEnv = (process.env.APIPASS_API_KEY ?? '').trim()
  if (fromEnv) return fromEnv

  if (cachedKey && Date.now() - cachedKey.at < KEY_TTL_MS) return cachedKey.value

  const serviceToken = process.env.COOKIEPLAY_SERVICE_TOKEN
  if (!serviceToken) return ''

  try {
    const res = await fetch(
      `${SUITE_API_BASE}/v1/internal/providers/${APIPASS_PROVIDER_ID}/secret`,
      { headers: { 'x-service-token': serviceToken }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn(`[provider] apipass 키를 받지 못했습니다 status=${res.status}`)
      return ''
    }
    const body = await res.json()
    const key = typeof body?.key === 'string' ? body.key : ''
    if (key) cachedKey = { value: key, at: Date.now() }
    return key
  } catch {
    console.warn('[provider] apipass 키 조회 네트워크 실패')
    return ''
  }
}

/**
 * 공급사에 나간 돈 한 건을 관리자단에 보낸다. **실패해도 조용히 지나간다** —
 * 지출 기록 때문에 사용자의 생성이 막히면 안 된다.
 *
 * ref 는 작업 id 를 쓴다. 같은 값으로 두 번 보내도 워커가 한 줄만 남긴다.
 */
export async function reportProviderUsage(params: {
  providerId: string
  action: string
  model: string
  ref: string
  userId: string
  costUsd: number
}): Promise<void> {
  const serviceToken = process.env.COOKIEPLAY_SERVICE_TOKEN
  if (!serviceToken) return

  try {
    await fetch(`${SUITE_API_BASE}/v1/internal/usage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service-token': serviceToken },
      body: JSON.stringify({ ...params, kind: 'music', status: 'succeeded', serviceId: SERVICE_ID }),
    })
  } catch {
    console.warn(`[provider] 사용 금액 기록 실패 ref=${params.ref}`)
  }
}
