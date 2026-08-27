/**
 * 쿠키뮤직은 쿠키플레이 안의 한 구역(`cookieplay.app/music`)으로 들어간다.
 *
 * Next 의 `basePath` 는 `next/link`·`next/image`·`router.push` 에는 자동으로 붙지만
 * **`fetch()` 와 `window.location` 에는 붙지 않는다.** 그 둘은 브라우저 API 라
 * Next 가 손댈 수 없기 때문이다. 그래서 손으로 붙여야 하는 자리가 남는다.
 *
 * 멀티존이라 이게 특히 중요하다: 페이지가 `cookieplay.app/music/...` 에서 돌 때
 * `/api/x` 로 요청하면 **허브**가 받는다(우리 앱이 아니라). `/music/api/x` 여야
 * 허브가 우리 배포로 넘겨 준다.
 */

/** `next.config.ts` 의 basePath 와 반드시 같아야 한다. */
export const BASE_PATH = '/music'

/**
 * 앱 안의 절대경로에 basePath 를 붙인다. 이미 붙어 있거나 외부 URL 이면 그대로 둔다.
 */
export function withBase(path: string): string {
  if (!path) return BASE_PATH
  // 외부 URL·프로토콜 상대 URL 은 우리 것이 아니다.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  if (!path.startsWith('/')) return path
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path
  return `${BASE_PATH}${path}`
}
