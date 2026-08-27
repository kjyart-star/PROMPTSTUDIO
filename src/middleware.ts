import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

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
/*
 * 옛 호스트(music.cookieplay.app) 301 은 여기서 하지 않는다 — vercel.json 의
 * host 조건부 redirects 가 맡는다. 미들웨어에서 호스트를 보고 돌려보내면
 * 허브(cookieplay.app)가 이 앱으로 rewrite 한 요청까지 걸린다: Vercel 프록시가
 * x-forwarded-host 를 대상 호스트로 바꿔 전달하기 때문에, 프록시 경유와 직접
 * 방문을 미들웨어에서는 구분할 수 없다(2026-08-28 운영에서 /music 자기 자신
 * 리다이렉트 루프로 실측). Vercel 단은 경로(/music/*)로 구분할 수 있다.
 */
export async function middleware(request: NextRequest) {
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
