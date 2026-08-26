import { createBrowserClient } from '@supabase/ssr'
import { browserCookieDomain } from './cookieDomain'

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // 세션을 부모 도메인 쿠키에 얹어 쿠키플레이와 나눠 쓴다. cookieplay.app 밖에서는
    // undefined 라 지금까지처럼 호스트 전용 쿠키가 된다.
    { cookieOptions: { domain: browserCookieDomain() } }
  )

  // Intercept storage.from('tracks').createSignedUrl to route through server-side proxy
  // This allows guest users to play audio tracks by leveraging the server's service role key.
  const originalFrom = client.storage.from.bind(client.storage)
  client.storage.from = (bucket: string) => {
    const bucketInstance = originalFrom(bucket)
    if (bucket === 'tracks') {
      bucketInstance.createSignedUrl = async (path: string, expiresIn: number, options?: any) => {
        try {
          const res = await fetch(`/api/tracks/signed-url?file_path=${encodeURIComponent(path)}`)
          if (res.ok) {
            const data = await res.json()
            return { data: { signedUrl: data.signedUrl }, error: null }
          }
        } catch (e) {
          console.warn("Failed to fetch signed URL from proxy API:", e)
        }
        // Fallback to client-side createSignedUrl
        return originalFrom(bucket).createSignedUrl(path, expiresIn, options)
      }
    }
    return bucketInstance
  }

  return client
}
