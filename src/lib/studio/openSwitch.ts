import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * 쿠키뮤직 스튜디오 공개 스위치 — **하나뿐이다.** 비용이 나가는 기능(생성·커버·스템·앨범아트 등)이
 * 모두 `requireAiAccess` 한 곳을 지나고, 그 문이 이 값을 본다.
 *   꺼짐(기본) → 관리자만 / 켜짐 → 로그인한 사용자 누구나
 * 값은 Supabase `studio_settings`(key='studio_open', jsonb true/false). 켜고 끄는 곳:
 *   관리자 화면 /admin/music 맨 위 「스튜디오 공개」 스위치, 또는 SQL
 *   update studio_settings set value='false' where key='studio_open';
 * 읽지 못하면 **닫힌 것으로** 본다(실패해도 돈이 새지 않게).
 */
const KEY = 'studio_open'
const TTL_MS = 15_000
let cache: { value: boolean; at: number } | null = null

export const adminDb = () =>
  createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function isStudioOpen(): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value
  try {
    const { data, error } = await adminDb().from('studio_settings').select('value').eq('key', KEY).maybeSingle()
    const value = !error && data?.value === true
    cache = { value, at: Date.now() }
    return value
  } catch {
    return false
  }
}

export async function setStudioOpen(open: boolean): Promise<boolean> {
  const { error } = await adminDb().from('studio_settings').upsert({ key: KEY, value: open, updated_at: new Date().toISOString() })
  if (error) return false
  cache = { value: open, at: Date.now() }
  return true
}

export function resetStudioOpenCache() { cache = null }
