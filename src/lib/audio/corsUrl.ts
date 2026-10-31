/**
 * crossOrigin 으로 불러오는 미디어 주소에 붙이는 캐시 분리용 쿼리.
 *
 * CDN 워커가 immutable 1년 캐시를 붙이기 때문에, 예전에 CORS 없이 받은 응답이 브라우저 HTTP 캐시에 남으면
 * 같은 주소를 crossOrigin 으로 열 때 계속 실패한다(MEDIA_ERR_SRC_NOT_SUPPORTED). 주소를 달리해 그 캐시를 피한다.
 * Supabase 서명 주소(?token=...)는 모르는 쿼리를 무시하므로 `&` 로 이어 붙여도 서명이 유지된다.
 */
export const CORS_CACHE_PARAM = 'cors'

/** http(s) 주소에만 `cors=1` 을 붙인다. blob:·data:·상대 경로·이미 붙은 주소는 그대로. */
export function withCorsCacheKey(url: string): string {
  if (!/^https?:/i.test(url)) return url
  const hash = url.indexOf('#')
  const base = hash >= 0 ? url.slice(0, hash) : url
  const frag = hash >= 0 ? url.slice(hash) : ''
  if (new RegExp(`[?&]${CORS_CACHE_PARAM}=`).test(base)) return url
  return `${base}${base.includes('?') ? '&' : '?'}${CORS_CACHE_PARAM}=1${frag}`
}

/** cors 값을 시각값으로 바꿔 캐시를 한 번 더 피한다. 분석 노드가 붙어 crossOrigin 을 못 끄는 요소용. */
export function bustCorsCacheKey(url: string): string {
  const stripped = url
    .replace(new RegExp(`([?&])${CORS_CACHE_PARAM}=[^&#]*&?`), (_m, p1: string) => p1)
    .replace(/[?&](#|$)/, '$1')
  return withCorsCacheKey(stripped).replace(`${CORS_CACHE_PARAM}=1`, `${CORS_CACHE_PARAM}=${Date.now().toString(36)}`)
}
