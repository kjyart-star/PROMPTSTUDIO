import { withBase } from '@/lib/basePath'

/**
 * 스튜디오 음원(비공개 `tracks` 버킷의 경로)을 재생 가능한 주소로 바꾼다.
 *
 * 브라우저에서 직접 서명하면 관리자만 된다(tracks 버킷 읽기 정책이 관리자 전용) — 스튜디오를 일반 사용자에게
 * 열었으므로 **서버 라우트**(소유자·공개곡 확인 후 서명)를 거친다. 한 번 받은 주소는 50분 동안 재사용한다
 * (서명 유효 1시간) — 곡 길이 표시와 재생이 같은 주소를 써서 요청이 두 번 나가지 않는다.
 * 이미 http(s) 주소면 그대로 돌려준다. 못 받으면 null — 부르는 쪽이 경로 그대로 플레이어에 넘겨 예전 방식으로 시도한다.
 */
const TTL_MS = 50 * 60_000
const cache = new Map<string, { url: string; at: number }>()
const inflight = new Map<string, Promise<string | null>>()

export function cachedAudioUrl(path: string): string | null {
  if (/^https?:\/\//i.test(path)) return path
  const hit = cache.get(path)
  return hit && Date.now() - hit.at < TTL_MS ? hit.url : null
}

export async function resolveStudioAudioUrl(path: string): Promise<string | null> {
  if (!path) return null
  const hit = cachedAudioUrl(path)
  if (hit) return hit
  const pending = inflight.get(path)
  if (pending) return pending
  const job = (async () => {
    try {
      const res = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(path)}`), { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.signedUrl) return null
      cache.set(path, { url: data.signedUrl, at: Date.now() })
      return data.signedUrl as string
    } catch {
      return null
    } finally {
      inflight.delete(path)
    }
  })()
  inflight.set(path, job)
  return job
}

export function clearAudioUrlCache() {
  cache.clear()
  inflight.clear()
}
