import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { SUITE_API_BASE } from '@/lib/credits/suite'
import { anonymizedChannel, anonymizedProfile, BAN_DURATION, CONFIRM_PHRASE, originAllowed, runWithdrawal } from '@/lib/account/withdraw'

// 계정 탈퇴(감사 L-10). POST 전용 — 로그인 세션(쿠키) 또는 Authorization: Bearer(쿠키드림 등 같은 계정) 필요.
// 순서와 이유는 lib/account/withdraw.ts.
export const maxDuration = 60

async function workerCall(token: string): Promise<{ ok: true; done: boolean } | { ok: false; status: number }> {
  try {
    const res = await fetch(`${SUITE_API_BASE}/v1/me/account/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { ok: false, status: res.status }
    const body = (await res.json().catch(() => ({}))) as { done?: unknown }
    return { ok: true, done: body.done === true }
  } catch {
    return { ok: false, status: 0 }
  }
}

export async function POST(request: Request) {
  if (!originAllowed(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false } })

  // 신원: Bearer 가 있으면 그 토큰, 없으면 세션 쿠키
  let userId = ''
  let token = ''
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer)
    userId = data.user?.id ?? ''
    token = bearer
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? ''
    if (userId) token = (await supabase.auth.getSession()).data.session?.access_token ?? ''
  }
  if (!userId || !token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown }
  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: `확인 문구 「${CONFIRM_PHRASE}」를 정확히 입력해 주세요.` }, { status: 400 })
  }

  const shortId = createHash('sha256').update(`deleted:${userId}`).digest('hex').slice(0, 12)
  const out = await runWithdrawal({
    callWorker: () => workerCall(token),
    anonymizeProfile: async () => {
      const { error } = await admin.from('profiles').update(anonymizedProfile(shortId)).eq('id', userId)
      if (error) console.error('[withdraw] profiles 익명화 실패', error.code)
      if (error) return false
      // 공개 채널도 같은 기준으로 — 이름만 「탈퇴한 사용자」, 소개·사진·링크 비움(채널·곡은 남긴다)
      const { error: chErr } = await admin.from('artists').update(anonymizedChannel()).eq('owner_user_id', userId)
      if (chErr) console.error('[withdraw] 채널 익명화 실패', chErr.code)
      return !chErr
    },
    disableAuth: async () => {
      // 삭제하지 않고 정지 + 소셜 이름·사진 등 메타데이터 비우기. 세션은 모두 끊는다.
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION, user_metadata: {} })
      if (error) console.error('[withdraw] 계정 정지 실패', error.status)
      else await admin.auth.admin.signOut(token, 'global').catch(() => undefined)
      return !error
    },
  })

  if (!out.ok) {
    return NextResponse.json({ error: out.message, retryable: out.retryable, step: out.step }, { status: out.status })
  }
  return NextResponse.json({ ok: true })
}
