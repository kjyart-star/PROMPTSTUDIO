/** 정지 계정인가. profiles.is_banned(20261114_d)로 판정한다. 읽기 오류면 정상으로 본다(서비스 중단 방지) — 다만 로그를 남긴다. */
export async function isBannedUser(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('is_banned').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('[ban] is_banned 조회 실패', error.code)
    return false
  }
  return data?.is_banned === true
}
