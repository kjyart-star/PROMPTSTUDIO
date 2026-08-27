'use client'

import { BASE_PATH } from '@/lib/basePath'

/**
 * 클라이언트의 `fetch('/api/...')` 를 `fetch('/music/api/...')` 로 바꿔 준다.
 *
 * 왜 한 곳에서 가로채나 — 앱 안에 `/api/...` 호출이 100곳이 넘는다. 그 전부를 손으로
 * 고치면 새로 쓰는 코드가 또 basePath 를 빠뜨리는 순간 조용히 깨진다. 진입점이 하나면
 * 규칙도 하나다.
 *
 * 멀티존이라 이 보정이 없으면 단순히 404 가 아니라 **허브가 응답한다.** 페이지가
 * `cookieplay.app/music/...` 에서 도는데 `/api/x` 로 부르면 그 요청은 허브 SPA 로 가고,
 * 우리 서버는 그런 요청이 온 줄도 모른다. 디버깅하기 고약한 종류의 실패다.
 *
 * 모듈 최상단에서 즉시 건다 — 컴포넌트가 그려지기를 기다리면 그 사이에 나간 요청을 놓친다.
 */
function patchFetch() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __basePathFetchPatched?: boolean }
  if (w.__basePathFetchPatched) return
  w.__basePathFetchPatched = true

  const original = window.fetch.bind(window)

  const rewrite = (url: string) =>
    url.startsWith('/api/') ? `${BASE_PATH}${url}` : url

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return original(rewrite(input), init)
    }
    // Request 객체로 오는 경우 — url 은 이미 절대 URL 로 정규화돼 있다.
    if (input instanceof Request) {
      const parsed = new URL(input.url)
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')) {
        parsed.pathname = `${BASE_PATH}${parsed.pathname}`
        return original(new Request(parsed.toString(), input), init)
      }
    }
    return original(input as RequestInfo, init)
  }) as typeof window.fetch
}

patchFetch()

/** 레이아웃에 얹기 위한 껍데기. 실제 일은 위에서 이미 끝났다. */
export default function BasePathFetch() {
  return null
}
