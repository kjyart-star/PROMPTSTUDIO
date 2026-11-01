/**
 * 공개 전 가사 싱크 보장(순수 TS) — 「듣는 사람이 어떤 공개 곡을 틀어도 처음부터 맞다」.
 *
 * 상태 전이(곡 form):
 *   공개 요청 ─(가사 있음·시간표 없음)→ publish_pending{at}  [is_published=false, DB 트리거가 강제]
 *     ├ 만든 사람 브라우저 정렬 저장 / 사람이 고친 시간표 / 서버 무료 큐 결과 → 공개(is_published=true, publish_pending 삭제)
 *     └ 24시간 지남(서버 정리) → 싱크 없이 공개(lrc_sync_skipped) — 화면은 일반 가사만(틀린 하이라이트 없음)
 *   공개 요청 ─(경음악·가사 없음·시간 표시 가사·시간표 있음)→ 바로 공개
 * DB 트리거(song_history_publish_gate)가 같은 규칙을 지켜서, API 를 거치지 않는 직접 쓰기도 막는다.
 */
import { alignLineTexts } from '@/lib/player/lrcValidate';
import { lrcAutoReadable, lyricsOfItem } from '@/lib/studio/lyricsOf';

export const PUBLISH_HOLD_MS = 24 * 3600 * 1000;

/** 곡에 맞춰 쓸 수 있는 시간표가 있는지(사람이 고친 것 또는 읽을 수 있는 판의 자동 결과) */
export function hasSyncedLrc(form: any): boolean {
  if (form?.lrc_by === 'user' && Array.isArray(form?.lrc) && form.lrc.length >= 2) return true;
  return lrcAutoReadable(form?.lrc_auto_v) && Array.isArray(form?.lrc_auto) && form.lrc_auto.length >= 2;
}

/** 공개 전에 시간표가 있어야 하는 곡인지 — 맞출 가사 줄이 2줄 이상(시간 표시가 든 가사·경음악은 아님) */
export function needsSync(row: any, all?: any[]): boolean {
  return alignLineTexts(lyricsOfItem(row, all)).length >= 2;
}

/** 공개를 기다리던 곡이 이제 시간표를 가졌으면 공개로 바꾼다. 바꿀 것이 없으면 빈 객체 */
export function releaseIfSynced(form: any): { is_published?: true; form?: any } {
  if (!form?.publish_pending || !hasSyncedLrc(form)) return {};
  const next = { ...form };
  delete next.publish_pending;
  return { is_published: true, form: next };
}

/** 공개 보류가 24시간을 넘었는지 */
export function holdExpired(form: any, now = Date.now()): boolean {
  const at = Date.parse(String(form?.publish_pending?.at ?? ''));
  return Number.isFinite(at) && now - at >= PUBLISH_HOLD_MS;
}
