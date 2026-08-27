import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withBase } from '@/lib/basePath'

/**
 * 회원가입 — 로그인(`/api/auth/login`)과 같은 모양으로 맞춘다.
 *
 * 이 프로젝트는 이메일 확인이 켜져 있다(`mailer_autoconfirm: false`). 그래서 가입 직후에는
 * 세션이 생기지 않고, 사용자는 메일함의 링크를 눌러야 한다. 그 사실을 `needsConfirmation`
 * 으로 그대로 돌려준다 — 화면이 "가입됐다"고만 말하면 사용자가 왜 못 들어가는지 모른다.
 */
export async function POST(request: Request) {
  try {
    const { email, password, next } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 확인 메일의 링크가 돌아올 곳. 구글 로그인 콜백과 같은 라우트를 쓴다.
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const isLocal = host?.includes('localhost') || host?.includes('127.0.0.1')
    const proto = request.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https')
    const origin = host ? `${proto}://${host}` : new URL(request.url).origin
    const redirectTo = `${origin}${withBase('/api/auth/callback')}?next=${encodeURIComponent(next || '/')}`

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // 세션이 없으면 확인 메일을 기다리는 상태다.
    return NextResponse.json({
      success: true,
      needsConfirmation: !data.session,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || '가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
