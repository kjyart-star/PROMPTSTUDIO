import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// 탈퇴 연동 내부 라우트(감사 L-10) — 쿠키플레이 워커만 부른다. 서비스 토큰(COOKIEPLAY_SERVICE_TOKEN)이 맞아야 하고,
// 탈퇴 처리된 계정(profiles.handle 이 deleted- 로 시작)에만 동작한다. 사용자 세션으로는 열리지 않는다.
//   restore  철회 — 로그인 정지(ban) 해제
//   finalize 유예 만료 — auth.users 의 원래 이메일을 익명 값으로(계정을 삭제하지 않는다: 공개 곡이 딸려 지워지지 않게)

function tokenOk(presented: string | null): boolean {
  const expected = process.env.COOKIEPLAY_SERVICE_TOKEN
  if (!expected || !presented) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!process.env.COOKIEPLAY_SERVICE_TOKEN) return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 })
  if (!tokenOk(request.headers.get('x-service-token'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { action } = await ctx.params
  if (action !== 'restore' && action !== 'finalize') return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { userId?: unknown }
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!UUID.test(userId)) return NextResponse.json({ error: 'invalid_user' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  const admin = createServiceClient(url, key, { auth: { persistSession: false } })

  // 탈퇴 처리된 계정만 — 이 라우트로 멀쩡한 계정을 건드리지 못하게
  const { data: profile, error: pErr } = await admin.from('profiles').select('handle').eq('id', userId).maybeSingle()
  if (pErr) return NextResponse.json({ error: 'lookup_failed' }, { status: 502 })
  if (!profile || typeof profile.handle !== 'string' || !profile.handle.startsWith('deleted-')) {
    return NextResponse.json({ error: 'not_withdrawn' }, { status: 409 })
  }

  if (action === 'restore') {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (error) return NextResponse.json({ error: 'restore_failed' }, { status: 502 })
    return NextResponse.json({ ok: true })
  }

  const shortId = createHash('sha256').update(`deleted:${userId}`).digest('hex').slice(0, 12)
  const { error } = await admin.auth.admin.updateUserById(userId, { email: `deleted-${shortId}@deleted.invalid`, email_confirm: true })
  if (error) return NextResponse.json({ error: 'finalize_failed' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
