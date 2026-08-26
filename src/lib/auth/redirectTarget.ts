/**
 * 로그인이 끝난 뒤 어디로 돌려보낼지 — 그리고 어디로는 절대 안 보낼지.
 *
 * 쿠키플레이 허브의 로그인 버튼이 `/login?redirect=https://cookieplay.app/...` 처럼
 * **절대 URL** 을 달고 온다. 그 값을 그대로 믿고 이동하면 열린 리다이렉트(open redirect)가
 * 된다 — 공격자가 `/login?redirect=https://피싱.example` 링크를 뿌리면 우리 도메인의
 * 로그인 화면을 거쳐 남의 사이트로 사용자를 떨어뜨릴 수 있다.
 *
 * 그래서 허용 목록에 있는 오리진만 통과시키고, 나머지는 조용히 기본 동선으로 되돌린다.
 * 클라이언트·서버 양쪽에서 쓰므로 next/* 는 import 하지 않는다.
 */

export const DEFAULT_REDIRECT = '/'

/** 쿠키플레이 식구들. 여기 없는 호스트로는 나가지 않는다. */
const ALLOWED_HOSTS = [
  'cookieplay.app',
  'www.cookieplay.app',
  'music.cookieplay.app',
  'suno-prompt-one.vercel.app',
]

/** dev 에서만 통하는 호스트. 운영 빌드에서는 이것도 막는다. */
const DEV_HOSTS = ['localhost', '127.0.0.1']

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (ALLOWED_HOSTS.includes(host)) return true
  if (process.env.NODE_ENV !== 'production' && DEV_HOSTS.includes(host)) return true
  return false
}

/**
 * 받은 값이 안전하면 그대로, 아니면 `fallback` 을 돌려준다.
 *
 * 통과하는 것은 두 가지뿐이다.
 *  1. 같은 사이트 안의 경로(`/studio` 같은 것)
 *  2. 허용 목록 오리진의 http(s) 절대 URL
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!raw) return fallback
  const value = raw.trim()
  if (!value) return fallback

  if (value.startsWith('/')) {
    // `//evil.example` 은 프로토콜 상대 URL 이라 외부로 나간다. `/\evil.example` 도
    // 브라우저가 같은 뜻으로 읽는다. 둘 다 경로가 아니다.
    if (value.startsWith('//') || value.startsWith('/\\')) return fallback
    return value
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return fallback
  }

  // javascript:, data: 같은 스킴을 막는다.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback
  if (!isAllowedHost(url.hostname)) return fallback

  return url.toString()
}

/** 쿼리스트링에서 목적지를 꺼낸다. 허브는 `redirect`, 기존 코드는 `next` 를 쓴다. */
export function readRedirectParam(
  params: { get(key: string): string | null },
  fallback: string = DEFAULT_REDIRECT
): string {
  return safeRedirect(params.get('redirect') ?? params.get('next'), fallback)
}
