/** 스템 분리 보조 — 순수 함수만 둔다(테스트 쉬움). */

export interface StemState {
  status: 'processing' | 'done' | 'failed'
  taskRef?: string
  ledgerId?: string
  attempt?: number
  refunded?: boolean
  vocals?: string
  instrumental?: string
  startedAt?: string
}

/** 「제목 (v2)」 같은 변형 곡이면 결과 목록의 몇 번째인지(0부터). 원곡은 0 */
export function variantIndex(title: string | null | undefined): number {
  const m = String(title || '').match(/\(v(\d+)\)\s*$/)
  return m ? Math.max(0, Number(m[1]) - 1) : 0
}

/** 결과 목록에서 보컬/악기 트랙을 type 으로 찾는다(순서를 믿지 않는다) */
export function pickStems(results: { audio_url?: string; type?: string }[]): { vocals: string; instrumental: string } | null {
  const vocals = results.find((r) => r.type === 'vocals')?.audio_url
  const instrumental = results.find((r) => r.type === 'instrumental')?.audio_url
  return vocals && instrumental ? { vocals, instrumental } : null
}

/** 같은 클릭이 두 번 와도 한 번만 빠지고, 실패한 뒤 다시 누르면 새로 빠지게 하는 멱등키 */
export function stemIdempotencyKey(userId: string, historyId: string, previous: StemState | undefined): string {
  return `music.stem2:${userId}:${historyId}:${(previous?.attempt ?? 0) + 1}`
}
