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

export type StemAvailability = 'ready' | 'view' | 'busy' | 'none'

/**
 * 이 곡을 스템으로 나눌 수 있는가 — 메뉴에 보일지 정한다(눌러 보고 실패하는 일이 없게).
 * 나눌 수 있는 곡: Suno(APIPASS)로 만들었고 곡 id(form.suno_audio_id)가 남아 있는 완성곡.
 * 올린 파일·kie 로 만든 곡·id 가 사라진 예전 곡은 'none' (게이트웨이에 오디오 분리 모델이 없어 파일로는 못 나눈다).
 */
export function stemAvailability(item: any): StemAvailability {
  const st = item?.form?.stems?.status
  if (st === 'done') return 'view'
  if (st === 'processing') return 'busy'
  if (!item?.audio_url || item.status !== 'completed' || item.form?.source === 'upload') return 'none'
  const task = String(item.suno_task_id || '')
  if (!task || task.startsWith('kie:')) return 'none'
  return typeof item.form?.suno_audio_id === 'string' && item.form.suno_audio_id ? 'ready' : 'none'
}
