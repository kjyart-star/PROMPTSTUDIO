// 공개 음원 판정(감사 M-7): CDN 게이트가 묻는 질문 — 이 R2 키가 지금 공개 곡이고 그 주인이 정지되지 않았나.
export function validTrackKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= 500 && !key.includes('..') && !/[\u0000-\u001f\\]/.test(key)
}

type Db = { from: (t: string) => any }

export async function isPublicTrackKey(db: Db, key: string): Promise<boolean> {
  const { data: rows } = await db
    .from('song_history')
    .select('user_id')
    .eq('audio_url', key)
    .eq('is_published', true)
    .is('trashed_at', null)
    .limit(5)
  const owners: string[] = Array.from(new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id)))
  if (owners.length === 0) return false
  const { data: banned } = await db.from('profiles').select('id').in('id', owners).eq('is_banned', true)
  const bannedIds = new Set(((banned ?? []) as { id: string }[]).map((b) => b.id))
  return owners.some((o) => !bannedIds.has(o))
}
