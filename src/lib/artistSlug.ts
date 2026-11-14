import { createClient as createServiceClient } from '@supabase/supabase-js'

/** handle 로 쓸 수 있는 모양인가(주소에 그대로 들어가므로 보수적으로). */
export const HANDLE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/

/**
 * 옛 아티스트 주소(이메일 앞부분)로 들어온 요청을 새 handle 로 바꿔 주는 서버 전용 조회.
 * 이메일은 서비스 키로만 읽고, 호출한 쪽에는 handle 한 줄만 돌려준다 — 공개 응답에 이메일이 새지 않는다.
 * 앞부분이 같은 계정이 둘 이상이면(도메인만 다름) 모호하므로 바꾸지 않는다(null).
 */
export async function legacySlugToHandle(slug: string): Promise<string | null> {
  if (!HANDLE_RE.test(slug)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const db = createServiceClient(url, key, { auth: { persistSession: false } })
  const escaped = slug.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  const { data } = await db.from('profiles').select('handle').ilike('email', `${escaped}@%`).limit(2)
  if (!data || data.length !== 1) return null
  const handle = (data[0] as { handle: string | null }).handle
  return handle && handle.toLowerCase() !== slug.toLowerCase() ? handle : null
}

/** 다른 계정의 옛 주소(이메일 앞부분)와 같은 handle 은 쓸 수 없다 — 옛 링크를 가로채지 못하게. */
export async function handleClashesWithLegacySlug(handle: string, selfId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  const db = createServiceClient(url, key, { auth: { persistSession: false } })
  const escaped = handle.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  const { data } = await db.from('profiles').select('id').ilike('email', `${escaped}@%`).neq('id', selfId).limit(1)
  return !!data && data.length > 0
}
