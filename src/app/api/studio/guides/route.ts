/**
 * 스튜디오 기본 지침서 프록시.
 *
 * 공용(관리자) 지침서는 쿠키플레이 관리자단 워커의 D1 에 있다. 브라우저가 워커를
 * 직접 부르면 CORS·주소 노출·캐시 제어가 전부 각자 문제가 되므로 여기서 한 번 받는다.
 *
 * 워커가 아직 이 경로를 안 열어 404 를 주는 동안에도 스튜디오는 멀쩡히 떠야 한다.
 * 그래서 **어떤 실패도 200 + 빈 목록**으로 삼킨다.
 */
import { NextResponse } from 'next/server'
import { SUITE_API_BASE } from '@/lib/credits/suite'

export const dynamic = 'force-dynamic'

/** 지침서용 서비스 id — 크레딧의 `cookiemusic` 과 다르다. */
const GUIDES_SERVICE_ID = 'cookiemusicstudio'

const CACHE_TTL_MS = 60_000

type Guide = {
  id: string
  title: string
  body: string
  lang?: string
  tags?: string[]
  sortOrder?: number
  updatedAt?: string
}

type GuidesBody = { serviceId: string; guides: Guide[]; generatedAt: string }

// 모듈 스코프 캐시 — 60초. 워커가 죽어 있어도 마지막으로 받은 값을 계속 쓴다.
let cache: { body: GuidesBody; fetchedAt: number } | null = null

function sortGuides(guides: Guide[]): Guide[] {
  return [...guides].sort((a, b) => {
    const sa = typeof a.sortOrder === 'number' ? a.sortOrder : 0
    const sb = typeof b.sortOrder === 'number' ? b.sortOrder : 0
    if (sa !== sb) return sa - sb
    return String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? ''))
  })
}

function noStore(payload: unknown) {
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return noStore(cache.body)
  }

  try {
    const res = await fetch(
      `${SUITE_API_BASE}/v1/public/guides?serviceId=${GUIDES_SERVICE_ID}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error(`guides upstream ${res.status}`)

    const json = await res.json()
    if (!json || !Array.isArray(json.guides)) throw new Error('guides upstream shape')

    const body: GuidesBody = {
      serviceId: typeof json.serviceId === 'string' ? json.serviceId : GUIDES_SERVICE_ID,
      guides: sortGuides(json.guides as Guide[]),
      generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : new Date().toISOString(),
    }
    cache = { body, fetchedAt: now }
    return noStore(body)
  } catch {
    // 캐시가 있으면 낡았어도 준다 — 지침서가 사라지는 것보다 낫다.
    if (cache) return noStore({ ...cache.body, stale: true })
    return noStore({
      serviceId: GUIDES_SERVICE_ID,
      guides: [],
      generatedAt: new Date().toISOString(),
      error: true,
    })
  }
}
