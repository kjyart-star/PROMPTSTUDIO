'use client';

/**
 * 공개(퍼블리싱) 단계의 가사 싱크 준비 — 「생성·작업 중엔 일반 가사, 공개할 때 싱크를 계산하고 확인한 뒤 공개」.
 * 공개 = 공개하는 사람 기기의 계산 완료 또는 수동 싱크 완료(2026-11-02 결정 — 서버 무료 큐는 보조).
 *   none   : 싱크가 필요 없음(경음악·가사 없음·시간 표시 가사) 또는 사람이 이미 확인한 시간표가 있음 → 바로 공개
 *   confirm: 자동 시간표가 준비됨(이미 있던 것 재사용 또는 지금 이 기기가 계산) → 「가사 싱크 확인」 화면을 거쳐 공개
 *   manual : 이 기기에서 끝내 계산하지 못함(WebGPU → WASM q8 재시도까지 실패) → 탭으로 줄을 찍는 수동 싱크 편집기로 공개
 * 태블릿도 계산한다(폰·태블릿 「계산 안 함」 규칙은 듣기 단계에만). 공개 단계는 1~2분 기다릴 수 있다.
 */
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl';
import { historyAudioPath } from '@/lib/studio/playQueue';
import { withCorsCacheKey } from '@/lib/audio/corsUrl';
import { LRC_AUTO_VERSION, lyricsOfItem } from '@/lib/studio/lyricsOf';
import { alignLineTexts } from '@/lib/player/lrcValidate';
import { autoAlign, canAlignForPublish, type AlignOutcome } from '@/lib/player/lyricSyncClient';
import { saveOwnLrc } from '@/lib/player/lrcShareClient';
import { runAlignJob, watchAlignJob } from '@/lib/player/alignJobs';
import { hasSyncedLrc, needsSync } from './publishGate';

export type PublishSyncPrep = { status: 'none' } | { status: 'manual'; song: any } | { status: 'confirm'; song: any };

export async function prepareSyncForPublish(item: any, all: any[], onPct?: (pct: number) => void, signal?: AbortSignal): Promise<PublishSyncPrep> {
  if (!needsSync(item, all)) return { status: 'none' };
  const f = item?.form ?? {};
  if (f.lrc_by === 'user' && Array.isArray(f.lrc) && f.lrc.length >= 2) return { status: 'none' };
  if (hasSyncedLrc(f)) return { status: 'confirm', song: item };
  const manual = { status: 'manual' as const, song: item };
  const confirm = (lrc: { t: number; text: string }[]) => ({ status: 'confirm' as const, song: { ...item, form: { ...f, lrc_auto: lrc, lrc_auto_v: LRC_AUTO_VERSION } } });
  // 생성 직후 백그라운드 계산이 아직 돌고 있으면 그것을 기다리며 남은 진행률만 보여 준다
  const running = watchAlignJob(item.id, (p) => onPct?.(p));
  if (running) {
    const lrc = await running.catch(() => null);
    if (lrc) return confirm(lrc);
  }
  if (!canAlignForPublish()) return manual;
  const lrc = await runAlignJob(item.id, async (onJob) => {
    const base = await resolveStudioAudioUrl(historyAudioPath(item)).catch(() => null);
    if (!base) return null;
    const url = withCorsCacheKey(base);
    const lines = alignLineTexts(lyricsOfItem(item, all));
    const run = async (forceWasm: boolean): Promise<AlignOutcome | null> => {
      try {
        return await autoAlign(url, lines, 0, null, (phase, pct) => {
          const v = phase === 'listen' ? Math.min(99, Math.round(20 + pct * 0.8)) : phase === 'download' ? Math.round(2 + pct * 0.18) : 1;
          onPct?.(v); onJob(v);
        }, signal, { forceWasm });
      } catch {
        if (signal?.aborted) throw new Error('aborted');
        return null; // 메모리 부족(모델·WebGPU 버퍼) 등 — 아래에서 WASM q8 로 다시
      }
    };
    onPct?.(1);
    let out = await run(false);
    if (!out?.ok) out = await run(true); // 재시도: WebGPU 를 끄고 가장 가벼운 WASM q8(77MB)로 30초 창씩
    if (!out?.ok || !out.lrc) return null;
    // 초안 저장 — 확인 화면에서 닫아도 남겨 둔다(다음 공개 때 다시 계산하지 않는다)
    await saveOwnLrc(item.id, out.lrc, !!out.lowConfidence).catch(() => undefined);
    return out.lrc;
  });
  return lrc ? confirm(lrc) : manual;
}
