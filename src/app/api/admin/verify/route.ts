import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ADMIN2_COOKIE, ADMIN2_TTL_SEC, hasAdminSecondFactor, safeEqualStr, signAdminToken } from '@/lib/auth/adminSecond'
import { hit, isBlocked } from '@/lib/rateLimit'

/**
 * 관리자 2차 인증. 로그인한 관리자가 서버 전용 2차 비밀번호를 맞히면 서명 쿠키(8시간)를 내려 준다.
 * 관리 API 는 이 쿠키를 서버에서 확인한다(감사 M-9). 비교는 상수 시간, 틀린 시도는 계정·IP 별로 제한한다.
 */
const FAIL_LIMIT = 5
const FAIL_WINDOW_MS = 15 * 60 * 1000

async function adminUser(): Promise<{ res: Response | null; userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), userId: '' }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), userId: '' }
  return { res: null, userId: user.id }
}

/** 이미 2차 인증을 마쳤는지(새로고침 뒤 화면 복원용). */
export async function GET(): Promise<Response> {
  const a = await adminUser()
  if (a.res) return a.res
  return NextResponse.json({ verified: await hasAdminSecondFactor(a.userId) })
}

export async function POST(request: Request): Promise<Response> {
  try {
    const a = await adminUser()
    if (a.res) return a.res

    const expected = process.env.ADMIN_SECONDARY_PASSWORD
    if (!expected) {
      console.error('ADMIN_SECONDARY_PASSWORD is not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const keys = [`admin2:u:${a.userId}`, `admin2:ip:${ip}`]
    if (keys.some((k) => isBlocked(k, FAIL_LIMIT))) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: { 'Retry-After': '900' } })
    }

    const body = await request.json().catch(() => ({}))
    const { id, password } = body ?? {}

    const ok = typeof id === 'string' && typeof password === 'string' && safeEqualStr(id, 'admin') && safeEqualStr(password, expected)
    if (!ok) {
      for (const k of keys) hit(k, FAIL_LIMIT, FAIL_WINDOW_MS)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(ADMIN2_COOKIE, signAdminToken(a.userId, expected), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN2_TTL_SEC,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
