import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * [임시 게이트] 비용이 나가는 외부 API 실행을 관리자에게만 허용한다.
 *
 * ▶ 게이트를 푸는 방법: 바로 아래 AI_GATE_ENABLED 를 false 로 바꾸면 전부 풀린다. (이 한 줄이 전부)
 *
 * 판별 기준은 기존 관리자 판별(profiles.is_admin)을 그대로 재사용한다.
 * src/app/(admin)/admin/music/layout.tsx, src/app/api/admin/verify/route.ts 와 동일한 기준이며,
 * 새 환경변수를 쓰지 않으므로 배포 설정 누락으로 관리자가 잠기는 사고가 없다.
 */
export const AI_GATE_ENABLED = true

type AiGateResult = { ok: true } | { ok: false; response: NextResponse }

/**
 * 서버 라우트 최상단에서 호출한다. UI 숨김은 편의일 뿐이고, 실제 차단은 여기서 이뤄진다.
 * - 비로그인: 401
 * - 로그인했지만 관리자가 아님: 403
 */
export async function requireAiAccess(feature: string): Promise<AiGateResult> {
  if (!AI_GATE_ENABLED) return { ok: true }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.warn(`[ai-gate] 401 unauthenticated feature=${feature}`)
    return {
      ok: false,
      response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    console.warn(`[ai-gate] 403 forbidden feature=${feature} user=${user.id}`)
    return {
      ok: false,
      response: NextResponse.json({ error: '준비 중인 기능입니다.' }, { status: 403 }),
    }
  }

  return { ok: true }
}

/**
 * 서버 컴포넌트에서 UI 노출 여부를 정할 때 쓴다. (차단 근거로 쓰지 말 것 — 차단은 requireAiAccess)
 */
export async function hasAiAccess(): Promise<boolean> {
  if (!AI_GATE_ENABLED) return true

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return Boolean(profile?.is_admin)
}
