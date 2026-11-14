// song_history.audio_url 은 서버가 정한 경로만 허용한다(H-6). 같은 규칙이 DB 트리거(20261114_c)에도 있다.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export async function validateAudioUrl(supabase: any, userId: string, v: unknown): Promise<{ ok: boolean }> {
  if (v === undefined || v === null || v === '') return { ok: true }
  if (typeof v !== 'string' || v.length > 500 || v.includes('..')) return { ok: false }
  if (/^https:\/\//i.test(v)) return { ok: true }
  if (v.startsWith(`audio/${userId}/`) || v.startsWith(`stems/${userId}/`)) return { ok: true }
  const m = new RegExp(`^audio/(${UUID})\\.[a-z0-9]{2,5}$`, 'i').exec(v)
  if (m) {
    // 본인 소유이거나 이미 공개된 곡의 경로(= 곡 id)만 허용. RLS 때문에 남의 비공개 곡은 조회되지 않는다.
    const { data } = await supabase.from('song_history').select('id, user_id, is_published').eq('id', m[1]).maybeSingle()
    if (data && (data.user_id === userId || data.is_published)) return { ok: true }
  }
  return { ok: false }
}

