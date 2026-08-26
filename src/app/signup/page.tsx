import { redirect } from 'next/navigation'

/**
 * `/signup` 은 로그인 화면의 가입 모드로 보낸다.
 *
 * 로그인 페이지의 "무료 가입하기" 링크가 이 경로를 가리키는데 라우트가 없어서 404 였다.
 * 폼을 하나 더 만들어 두 벌을 관리하는 대신, 이미 있는 화면의 모드만 바꾼다.
 *
 * 돌아갈 곳(`redirect`/`next`)은 그대로 넘긴다 — 허브에서 가입하러 온 사람을
 * 가입이 끝난 뒤 허브로 돌려보내야 하는데, 여기서 흘리면 그 정보가 사라진다.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams({ mode: 'signup' })

  const target = params.redirect ?? params.next
  if (typeof target === 'string' && target) {
    // 검증은 로그인 화면에서 한 번만 한다 — 여기서 또 하면 규칙이 두 군데로 갈린다.
    query.set('redirect', target)
  }

  redirect(`/login?${query.toString()}`)
}
