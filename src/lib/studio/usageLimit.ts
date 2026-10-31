import { NextResponse } from 'next/server'
import { adminDb } from './openSwitch'

/** 기능별 상한 — 짧은 시간 연타(burst)와 하루 총량(daily). 일반 사용자 공개를 위한 남용 방지. */
export const QUOTAS = {
  stem: { burst: 3, burstSecs: 60, daily: 30 },
  albumArt: { burst: 6, burstSecs: 60, daily: 40 },
} as const
export type QuotaFeature = keyof typeof QUOTAS

/** 한 번 쓸 자리를 받는다. 막히면 429 응답을 돌려준다(차감 전에 부른다). DB 가 안 되면 통과시키지 않는다. */
export async function takeQuota(userId: string, feature: QuotaFeature): Promise<NextResponse | null> {
  const q = QUOTAS[feature]
  try {
    const { data, error } = await adminDb().rpc('studio_take_quota', {
      p_user: userId, p_feature: feature, p_burst: q.burst, p_burst_secs: q.burstSecs, p_daily: q.daily,
    })
    if (error) throw error
    if (data === 'ok') return null
    const msg = data === 'daily'
      ? '오늘 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.'
      : '너무 빠르게 요청하고 있어요. 잠시 뒤 다시 눌러 주세요.'
    return NextResponse.json({ error: msg, code: data }, { status: 429 })
  } catch {
    return NextResponse.json({ error: '지금은 요청을 받을 수 없어요. 잠시 뒤 다시 시도해 주세요.' }, { status: 503 })
  }
}
