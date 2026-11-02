/**
 * Workers AI 무료 큐 작업 고르기(순수 TS).
 * 채우기(fill, 보조): 공개를 요청했는데(공개 대기) 시간표가 없는 곡만. 순서 = 브라우저 계산을 못 한 기기(폰 등)에서 만든 곡 → 오래 기다린 곡 → 재생 많은 곡.
 *   PC 에서 막 만든 곡은 만든 사람 브라우저가 1분 안에 끝내므로 10분 기다린 뒤에만 집는다(무료 한도 아끼기).
 * 검수(audit): 브라우저가 만든 결과 중 아직 검수하지 않은 공개 곡, 재생 많은 곡부터 — 받아쓰기로 ±20초 보정.
 */
import { alignLineTexts } from '@/lib/player/lrcValidate';
import { lrcAutoFailed, lyricsOfItem } from '@/lib/studio/lyricsOf';
import { hasSyncedLrc } from './publishGate';

export interface FreeJob { id: string; kind: 'fill' | 'audit'; audio: string; is_published: boolean; lines: string[]; duration: number | null }

export const DESKTOP_GRACE_MS = 10 * 60 * 1000;
/** 받아쓰기로 못 맞춘 곡은 이만큼 뒤에 다시 */
export const FILL_RETRY_MS = 7 * 24 * 3600 * 1000;

const playsOf = (r: any) => Number(r?.form?.play_count ?? r?.play_count) || 0;
const time = (s: unknown) => { const t = Date.parse(String(s ?? '')); return Number.isFinite(t) ? t : 0; };

export function freeJobsOf(rows: any[], now = Date.now()): { fill: FreeJob[]; audit: FreeJob[] } {
  const fill: (FreeJob & { _k: number[] })[] = [];
  const audit: (FreeJob & { _p: number })[] = [];
  for (const r of rows) {
    if (!r?.id || r.trashed_at || r.status === 'processing' || !r.audio_url) continue;
    const f = r.form ?? {};
    const lines = alignLineTexts(lyricsOfItem(r, rows));
    if (lines.length < 2) continue;
    const base = { id: String(r.id), audio: String(r.audio_url), is_published: !!r.is_published, lines, duration: Number(f.duration_sec ?? f.duration) || null };
    if (!hasSyncedLrc(f)) {
      if (lrcAutoFailed(f)) continue;
      if (now - time(f.lrc_free_fail?.at) < FILL_RETRY_MS) continue;
      const pending = !!f.publish_pending;
      // 보조 경로: 공개를 요청했는데 공개자 기기가 아직 못 끝낸 곡만 채운다(비공개 초안은 만든 사람 기기가 백그라운드로 만든다)
      if (!pending) continue;
      const mobile = f.client_platform === 'mobile';
      const waited = now - time(f.publish_pending?.at ?? r.created_at);
      if (!mobile && waited < DESKTOP_GRACE_MS) continue;
      fill.push({ ...base, kind: 'fill', _k: [pending ? 0 : 1, mobile ? 0 : 1, -waited, -playsOf(r)] });
      continue;
    }
    const model = String(f.lrc_auto_model ?? '');
    const byBrowser = model.startsWith('browser') || model.includes('/');
    if (r.is_published && byBrowser && f.lrc_by !== 'user' && !f.lrc_audit) audit.push({ ...base, kind: 'audit', _p: playsOf(r) });
  }
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  fill.sort((a, b) => cmp(a._k, b._k));
  audit.sort((a, b) => b._p - a._p);
  return { fill: fill.map(({ _k, ...j }) => j), audit: audit.map(({ _p, ...j }) => j) };
}
