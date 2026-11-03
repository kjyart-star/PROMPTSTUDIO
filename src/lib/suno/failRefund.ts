/**
 * 접수된 뒤 실패로 확정된 곡의 크레딧을 한 번만 돌려준다.
 *
 * - 차감 원장 id 는 접수 때 `song_history.form.ledger_id` 에 남겨 둔다.
 * - 환불이 끝나면 `form.refund = { ok: true }` 를 남겨 다시 부르지 않는다.
 * - 동시에 두 번 불려도 워커가 같은 차감 원장의 환불을 한 번만 받는다(멱등).
 * - 환불이 실패하면 표시를 남기지 않으므로 다음 확인 때 다시 시도한다.
 */
import { refundCredits } from '@/lib/credits/suite'

export type RefundOutcome = { refunded: boolean; refundable: boolean }

export async function refundFailedSong(
  supabase: any,
  item: { id: string; form?: any },
  userId: string,
  reason = 'suno 생성 실패 자동 환불',
): Promise<RefundOutcome> {
  const form = item.form && typeof item.form === 'object' ? item.form : {}
  if (form.refund?.ok) return { refunded: true, refundable: true }
  const ledgerId = typeof form.ledger_id === 'string' ? form.ledger_id : ''
  // 원장 id 가 없는 옛 기록은 자동으로 돌려줄 근거가 없다
  if (!ledgerId) return { refunded: false, refundable: false }
  const res = await refundCredits(ledgerId, reason)
  if (!res.ok) return { refunded: false, refundable: true }
  await supabase.from('song_history')
    .update({ form: { ...form, refund: { ok: true, at: new Date().toISOString() } } })
    .eq('id', item.id).eq('user_id', userId)
  return { refunded: true, refundable: true }
}

export const REFUNDED_MESSAGE = '만들지 못해 크레딧을 돌려드렸어요.'
export const REFUND_PENDING_MESSAGE = '만들지 못했어요. 크레딧 환불을 처리 중이에요.'
