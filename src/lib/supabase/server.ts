import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { cookieDomainForHost } from './cookieDomain'

export async function createClient() {
  const cookieStore = await cookies()
  // 쿠키 도메인은 요청이 온 호스트로 정한다 — 같은 코드가 localhost·vercel.app·
  // music.cookieplay.app 에서 각각 맞는 쿠키를 굽게 하려면 여기서 갈라야 한다.
  const headerStore = await headers()
  const domain = cookieDomainForHost(
    headerStore.get('x-forwarded-host') || headerStore.get('host')
  )

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
