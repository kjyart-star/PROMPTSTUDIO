import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountClient from '@/components/account/AccountClient'

export const revalidate = 0

/**
 * 쿠키플레이 「내 설정」 — 계정 관리의 정본.
 *
 * 로그인·프로필은 쿠키플레이가 전체 관리한다(대표 확정 원칙, 2026-08-28).
 * 사진·표시 이름·이메일·비밀번호·로그아웃은 전부 여기서 다루고,
 * 각 서비스(뮤직 포함)는 이 페이지로 링크만 건다. 저장되는 곳은
 * profiles 테이블 하나라 어디서 봐도 같은 값이 보인다.
 *
 * basePath 포함 최종 주소는 cookieplay.app/music/account — 허브가 나중에
 * /account 를 여기로 rewrite 해 붙인다.
 */
export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account')
  }

  return <AccountClient user={user} />
}
