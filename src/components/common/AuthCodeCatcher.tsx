'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * 구글 로그인 안전망 — 엉뚱한 페이지에 떨어진 `?code=` 를 주워서 세션으로 바꾼다.
 *
 * 왜 필요한가(2026-08-28 운영 실측): Supabase 는 `redirectTo` 가 대시보드의
 * Redirect URLs 허용 목록에 없으면 Site URL(옛 주소 music.cookieplay.app)로
 * 떨어뜨린다. 그 주소는 우리 301 을 타고 `cookieplay.app/music?code=…` 로
 * 돌아오는데, 거기는 콜백 라우트가 아니라서 코드가 그대로 버려졌다 —
 * "구글 로그인이 조용히 실패"한 원인. code-verifier 쿠키는 로그인을 시작한
 * cookieplay.app 오리진에 있으므로, 같은 오리진인 여기서 교환하면 성립한다.
 * 대시보드 허용 목록을 고쳐도 이 보험은 남긴다.
 */
export default function AuthCodeCatcher() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (!code) return
    // 정상 콜백 라우트가 처리 중인 경우는 건드리지 않는다.
    if (window.location.pathname.includes('/api/auth/')) return

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (!error) {
        // 로그인 성공 → 쿠키플레이 홈(대표 확정 동선).
        window.location.replace(window.location.origin + '/')
        return
      }
      // 만료된 코드 재방문 등 — 주소에서 code 만 지우고 그 자리에 머문다.
      url.searchParams.delete('code')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    })
  }, [])

  return null
}
