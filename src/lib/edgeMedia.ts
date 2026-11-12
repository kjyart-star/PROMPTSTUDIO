/**
 * 쿠키뮤직 음원 에지 — KT 회선에서 workers.dev 로 가는 요청이 LAX(미국)로 우회돼 곡 시작이 느리다.
 * 같은 R2 버킷을 서울(ICN) pages.dev(`cookiemusic-media`)가 직접 읽으므로, 음원 주소의 **호스트만**
 * 화면 요소(`<audio>`·`<video>`·`<source>`·`<img>` 커버)에 실리는 순간과 `fetch` GET 에서 바꾼다.
 * 쿠키플레이 본체 `src/lib/media/edgeMedia.ts` 와 같은 규칙(분리 배포라 카피 후 수정).
 *
 *  · 서버가 돌려주는 주소·DB 에 저장된 값은 그대로다(`NEXT_PUBLIC_R2_PUBLIC_BASE` = 폴백 원본).
 *  · 에지가 실패하면(404·5xx·네트워크 오류) 같은 요소/요청을 원래 주소로 한 번 되돌린다.
 *  · 2분 안에 3번 실패하면 10분간 에지를 끄고 전부 원래 주소로 간다.
 *  · 서버(Node)에서는 아무것도 하지 않는다.
 */

export const ORIGIN = 'https://cookiemusic-cdn.kjyart.workers.dev'
export const EDGE = 'https://cookiemusic-media.pages.dev'

const OFF_KEY = 'cookiemusic:mediaEdge:offUntil'
const OFF_MS = 10 * 60 * 1000
const TRIP_WINDOW_MS = 2 * 60 * 1000
const TRIP_COUNT = 3

let forcedEnabled: boolean | null = null
let offUntil = 0
const recentFailures: number[] = []
let nativeFetch: typeof fetch | null = null

/** 테스트용 — null 이면 기본(테스트 환경이면 꺼짐, 그 밖엔 켜짐) */
export function setEdgeMediaEnabled(value: boolean | null): void {
  forcedEnabled = value
  offUntil = 0
  recentFailures.length = 0
  try { sessionStorage.removeItem(OFF_KEY) } catch { /* 저장소 없음 */ }
}

function readOffUntil(): number {
  if (offUntil) return offUntil
  try {
    const raw = Number(sessionStorage.getItem(OFF_KEY) ?? '0')
    if (Number.isFinite(raw)) offUntil = raw
  } catch { /* 저장소 없음 */ }
  return offUntil
}

export function isEdgeMediaOn(now = Date.now()): boolean {
  if (!(forcedEnabled ?? process.env.NODE_ENV !== 'test')) return false
  return now >= readOffUntil()
}

export function reportEdgeFailure(now = Date.now()): void {
  recentFailures.push(now)
  while (recentFailures.length && now - recentFailures[0] > TRIP_WINDOW_MS) recentFailures.shift()
  if (recentFailures.length >= TRIP_COUNT) {
    offUntil = now + OFF_MS
    recentFailures.length = 0
    try { sessionStorage.setItem(OFF_KEY, String(offUntil)) } catch { /* 저장소 없음 */ }
  }
}

/** 원래(workers.dev) 음원 주소면 에지 주소로. 그 밖의 주소·에지가 꺼진 상태면 그대로 */
export function toEdgeMediaUrl(url: string): string {
  if (!url || !isEdgeMediaOn()) return url
  return url.startsWith(ORIGIN + '/') ? EDGE + url.slice(ORIGIN.length) : url
}

/** 에지 주소면 원래 주소로(폴백). 아니면 null */
export function toOriginMediaUrl(url: string): string | null {
  return url.startsWith(EDGE + '/') ? ORIGIN + url.slice(EDGE.length) : null
}

const baseFetch: typeof fetch = (input, init) => (nativeFetch ?? fetch)(input, init)

/** 에지 우선 fetch — 네트워크 오류·404·5xx 면 원래 주소로 한 번 더(403·416 은 그대로) */
export async function fetchWithEdgeFallback(url: string, init?: RequestInit): Promise<Response> {
  const edgeUrl = toEdgeMediaUrl(url)
  if (edgeUrl === url) return baseFetch(url, init)
  try {
    const res = await baseFetch(edgeUrl, init)
    if (res.ok || res.status === 403 || res.status === 416) return res
    reportEdgeFailure()
  } catch (err) {
    if (init?.signal?.aborted) throw err
    reportEdgeFailure()
  }
  return baseFetch(url, init)
}

function fetchCandidate(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (typeof input !== 'string' && !(input instanceof URL)) return null
  if ((init?.method ?? 'GET').toUpperCase() !== 'GET' || init?.body != null) return null
  if (init?.credentials === 'include') return null
  if (init?.headers && Array.from(new Headers(init.headers).keys()).some((k) => k !== 'range')) return null
  const url = typeof input === 'string' ? input : input.href
  return url.startsWith(ORIGIN + '/') ? url : null
}

type Patched = { __musicEdgePatched?: boolean }

/** 앱 시작 때 한 번(클라이언트). 여러 번 불러도 한 번만 걸린다. */
export function installEdgeMedia(win: Window & typeof globalThis = window): void {
  const w = win as Window & Patched
  if (w.__musicEdgePatched || typeof win.document === 'undefined') return
  w.__musicEdgePatched = true

  const protos: object[] = [win.HTMLImageElement.prototype, win.HTMLMediaElement.prototype, win.HTMLSourceElement.prototype]
  const baseSetAttribute = win.Element.prototype.setAttribute
  for (const proto of protos) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'src')
    if (desc?.set) {
      const nativeSet = desc.set
      Object.defineProperty(proto, 'src', {
        ...desc,
        set(this: Element, value: string) {
          nativeSet.call(this, typeof value === 'string' ? toEdgeMediaUrl(value) : value)
        },
      })
    }
    Object.defineProperty(proto, 'setAttribute', {
      configurable: true,
      writable: true,
      value(this: Element, name: string, value: string) {
        if (typeof name === 'string' && name.toLowerCase() === 'src' && typeof value === 'string') {
          return baseSetAttribute.call(this, name, toEdgeMediaUrl(value))
        }
        return baseSetAttribute.call(this, name, value)
      },
    })
  }

  win.document.addEventListener(
    'error',
    (event) => {
      const target = event.target as Element | null
      if (!target || !('getAttribute' in target)) return
      const tag = target.tagName
      if (tag !== 'IMG' && tag !== 'AUDIO' && tag !== 'VIDEO' && tag !== 'SOURCE') return
      const current = target.getAttribute('src') ?? ''
      const origin = current ? toOriginMediaUrl(current) : null
      if (!origin || (target as HTMLElement).dataset.edgeFallback === '1') return
      ;(target as HTMLElement).dataset.edgeFallback = '1'
      reportEdgeFailure()
      baseSetAttribute.call(target, 'src', origin) // 되돌릴 때는 가로채기를 거치지 않는다
      const media = (tag === 'SOURCE' ? target.parentElement : target) as HTMLMediaElement | null
      if (media && (media.tagName === 'VIDEO' || media.tagName === 'AUDIO')) {
        const resumeAt = media.currentTime
        if (resumeAt > 0) {
          media.addEventListener('loadedmetadata', () => {
            try { media.currentTime = resumeAt } catch { /* 탐색 불가 — 처음부터 */ }
          }, { once: true })
        }
        media.load()
        if (!media.paused || media.autoplay) void media.play?.().catch(() => {})
      }
    },
    true,
  )

  if (typeof win.fetch === 'function') {
    const original = win.fetch.bind(win)
    nativeFetch = original
    win.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchCandidate(input, init)
      return url ? fetchWithEdgeFallback(url, init) : original(input, init)
    }) as typeof fetch
  }
}
