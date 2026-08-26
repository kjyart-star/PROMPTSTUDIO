/**
 * 세션 쿠키를 어느 도메인에 걸 것인가 — 쿠키플레이 서브도메인끼리 한 세션을 보게 하는 열쇠.
 *
 * 쿠키뮤직(music.cookieplay.app)과 쿠키플레이(cookieplay.app)는 **오리진이 다르다**.
 * localStorage 는 오리진별이라 절대 공유되지 않으므로, 두 화면이 같은 로그인을 보려면
 * 세션이 부모 도메인(.cookieplay.app) 쿠키에 얹히는 수밖에 없다.
 *
 * 그 밖의 호스트에서는 undefined 를 돌려준다 — 호스트 전용 쿠키가 된다.
 *  · localhost: 도메인 쿠키를 걸면 브라우저가 통째로 거부한다. dev 가 죽는다.
 *  · *.vercel.app: Public Suffix List 에 올라 있어 도메인 쿠키 자체가 금지다.
 *    미리보기 배포에서 로그인이 깨지지 않으려면 여기서 걸러야 한다.
 */

const ROOT_HOST = 'cookieplay.app'

/** 부모 도메인. 앞의 점이 "이 도메인과 모든 서브도메인"을 뜻한다. */
export const SHARED_COOKIE_DOMAIN = `.${ROOT_HOST}`

export function cookieDomainForHost(host?: string | null): string | undefined {
  if (!host) return undefined
  // 포트를 떼고 소문자로 — Host 헤더는 'music.cookieplay.app:443' 로 올 수 있다
  const hostname = host.split(':')[0].trim().toLowerCase()
  if (hostname === ROOT_HOST || hostname.endsWith(`.${ROOT_HOST}`)) {
    return SHARED_COOKIE_DOMAIN
  }
  return undefined
}

/** 브라우저에서 지금 오리진에 맞는 값을 고른다 */
export function browserCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return cookieDomainForHost(window.location.hostname)
}
