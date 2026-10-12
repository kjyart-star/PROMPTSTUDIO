import { createBrowserClient } from '@supabase/ssr'
import { withBase } from '../basePath'
import { browserCookieDomain } from './cookieDomain'

const TRACKS_SIGNED_URL_PROXY_PATCH = '__cookieplayTracksSignedUrlProxyPatched__'

type PatchableStorage = ReturnType<typeof createBrowserClient>['storage'] & {
  [TRACKS_SIGNED_URL_PROXY_PATCH]?: true
}

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // 세션을 부모 도메인 쿠키에 얹어 쿠키플레이와 나눠 쓴다. cookieplay.app 밖에서는
    // undefined 라 지금까지처럼 호스트 전용 쿠키가 된다.
    { cookieOptions: { domain: browserCookieDomain() } }
  )

  // createBrowserClient reuses its browser client. createClient() is called by many
  // components, so wrapping storage.from on every call nests the previous wrapper and
  // eventually overflows the stack before a newly generated track can be signed.
  const storage = client.storage as PatchableStorage
  if (!storage[TRACKS_SIGNED_URL_PROXY_PATCH]) {
    const originalFrom = storage.from.bind(storage)

    // Mark the shared storage client before replacing the method. The string marker also
    // survives a development hot reload where this module's local state is recreated.
    Object.defineProperty(storage, TRACKS_SIGNED_URL_PROXY_PATCH, { value: true })

    storage.from = (bucket: string) => {
      const bucketInstance = originalFrom(bucket)
      if (bucket === 'tracks') {
        bucketInstance.createSignedUrl = async (
          path: string,
          expiresIn: number,
          options?: Parameters<typeof bucketInstance.createSignedUrl>[2]
        ) => {
          try {
            // 멀티존이라 basePath 를 손으로 붙여야 한다. `/api/...` 로 보내면 허브가 받아
            // SPA 문서를 돌려주고, res.json() 이 터져 아래 폴백으로 샌다 — 그 폴백은
            // 비로그인 사용자에게 막혀 있어(RLS) 게스트 재생이 통째로 죽는다.
            const res = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(path)}`))
            if (res.ok) {
              const data = await res.json()
              return { data: { signedUrl: data.signedUrl }, error: null }
            }
          } catch (e) {
            console.warn("Failed to fetch signed URL from proxy API:", e)
          }
          // Fallback uses the one captured native method, never another proxy wrapper.
          return originalFrom(bucket).createSignedUrl(path, expiresIn, options)
        }
      }
      return bucketInstance
    }
  }

  return client
}
