import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { legacyHostRedirect } from '@/lib/auth/gateway'

/**
 * 세션 자동 갱신 — 이 파일이 없던 게 "가끔 조용히 로그아웃되는" 문제의 직접 원인이었다.
 *
 * `updateSession` 은 원래부터 있었지만 **아무 데서도 불리지 않는 죽은 코드**였다.
 * 미들웨어가 매 요청 앞에서 `getUser()` 를 한 번 부르면 supabase-ssr 이 만료가 가까운
 * 액세스 토큰을 굴리고, 갱신된 쿠키를 응답에 실어 준다. 그게 없으면 리프레시 토큰이
 * 만료될 때까지 아무도 토큰을 갱신하지 않는다.
 *
 * 반환값은 반드시 `updateSession` 이 만든 응답이어야 한다 — 거기에 갱신된 Set-Cookie 가
 * 들어 있고, 새 NextResponse 를 만들어 돌려주면 그 쿠키가 통째로 버려진다.
 */
export async function middleware(request: NextRequest) {
  // 주소 정리가 먼저다. 어차피 다른 호스트로 보낼 요청이라면 세션을 갱신할 이유가 없고,
  // 갱신해 봐야 그 쿠키는 리다이렉트와 함께 버려진다.
  const destination = legacyHostRedirect(
    request.headers.get('x-forwarded-host') || request.headers.get('host'),
    request.nextUrl.pathname,
    request.nextUrl.search
  )
  if (destination) {
    return NextResponse.redirect(destination, 301)
  }

  const { supabaseResponse } = await updateSession(request)
  return supabaseResponse
}

export const config = {
  /*
   * 정적 자원에는 걸지 않는다 — 세션을 갱신할 이유가 없고, 이미지마다 Supabase 를
   * 한 번씩 부르면 요청 수만 늘어난다.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|woff|woff2)$).*)',
  ],
}
