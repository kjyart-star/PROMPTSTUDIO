import { BASE_PATH } from '@/lib/basePath'

/**
 * 옛 주소를 새 자리로 보낸다.
 *
 * 쿠키뮤직은 이제 쿠키플레이 안의 한 구역(`cookieplay.app/music`)이다. 그전에 쓰던
 * `music.cookieplay.app` 링크가 이미 밖에 나가 있으니 죽게 두지 않고 넘겨 준다.
 *
 * 301(영구)로 보내는 이유: 이 이사는 되돌릴 계획이 없고, 브라우저와 검색엔진이
 * 새 주소를 기억하게 하려는 것이다.
 *
 * localhost·vercel.app 처럼 도메인이 하나뿐인 환경에서는 아무것도 하지 않는다 —
 * 그러지 않으면 dev 가 자기 자신을 떠나 버린다.
 */

export const LEGACY_MUSIC_HOST = 'music.cookieplay.app'
export const HUB_HOST = 'cookieplay.app'

export function normalizeHost(host?: string | null): string {
  if (!host) return ''
  return host.split(':')[0].trim().toLowerCase()
}

/**
 * 옮겨야 할 요청이면 목적지 절대 URL 을, 아니면 null 을 돌려준다.
 * 쿼리스트링은 반드시 그대로 옮긴다 — redirect·next·mode·switch 가 여기 실려 있다.
 */
export function legacyHostRedirect(
  host: string | null | undefined,
  pathname: string,
  search: string
): string | null {
  if (normalizeHost(host) !== LEGACY_MUSIC_HOST) return null

  // 미들웨어가 보는 경로에 basePath 가 붙어 있을 수도, 아닐 수도 있다.
  // 어느 쪽이든 `/music/music/...` 이 되지 않게 한 번만 붙인다.
  let path = pathname
  if (path === BASE_PATH) path = '/'
  else if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length)
  if (!path.startsWith('/')) path = `/${path}`

  const suffix = path === '/' ? '' : path
  return `https://${HUB_HOST}${BASE_PATH}${suffix}${search}`
}
