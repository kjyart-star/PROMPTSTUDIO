import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirect } from '@/lib/auth/redirectTarget'
import { withBase } from '@/lib/basePath'
import { siteOrigin } from '@/lib/auth/siteOrigin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // 구글 로그인·가입 확인 메일이 되돌아오는 곳. 목적지는 허용 목록을 통과한 것만 쓴다.
  const next = safeRedirect(searchParams.get('next'))

  // 오리진은 허용 목록으로 고정한다(Host 헤더를 그대로 믿지 않는다)
  const origin = siteOrigin(request)

  // 허브로 돌아가는 경우엔 이미 절대 URL 이라 origin 을 앞에 붙이면 안 된다.
  const destination = next.startsWith('/') ? `${origin}${withBase(next)}` : next

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(destination)
    }
  }

  return NextResponse.redirect(`${origin}${withBase('/login')}?error=auth-callback-failed`)
}
