import { buildTimedLyrics } from './lyricTiming';

/** 자동 맞추기 결과(가사 줄 시작 시각) 검증 — 서버(제출 받기·저장)와 브라우저(저장 전 점검)가 같은 규칙을 쓴다 */
export interface LrcLine { t: number; text: string }

export const MAX_LRC_LINES = 2000;
/** 곡 길이를 모를 때의 상한(초). 스튜디오 곡은 보통 8분 안쪽이고 마스터링·연장본도 30분을 넘지 않는다 */
export const MAX_SONG_SEC = 1800;
/** 첫 줄과 마지막 줄 사이가 이보다 짧으면 정렬이 무너진 것(finalizeAlignment 와 같은 기준의 하한) */
export const MIN_SPAN_SEC = 10;

export type LrcCheck = { ok: true; lines: LrcLine[] } | { ok: false; reason: string };

interface Opts {
  /** 곡 길이(초) — 알면 마지막 줄 시각이 길이 + 3초를 넘지 못한다 */
  durationSec?: number | null;
  /** 곡 가사에서 나온 줄 목록 — 주면 줄 수와 글이 그대로여야 한다 */
  expectedTexts?: string[] | null;
}

export function validateAutoLrc(input: unknown, opts: Opts = {}): LrcCheck {
  if (!Array.isArray(input)) return { ok: false, reason: 'not-array' };
  if (input.length < 2 || input.length > MAX_LRC_LINES) return { ok: false, reason: 'line-count' };
  const cap = opts.durationSec && opts.durationSec > 0 ? Math.min(MAX_SONG_SEC, opts.durationSec + 3) : MAX_SONG_SEC;
  const lines: LrcLine[] = [];
  let prev = 0;
  for (const raw of input) {
    const t = (raw as any)?.t;
    const text = (raw as any)?.text;
    if (typeof t !== 'number' || !isFinite(t) || t < 0) return { ok: false, reason: 'bad-time' };
    if (typeof text !== 'string' || !text.trim() || text.length > 500) return { ok: false, reason: 'bad-text' };
    if (t < prev) return { ok: false, reason: 'not-monotonic' };
    if (t > cap) return { ok: false, reason: 'beyond-duration' };
    prev = t;
    lines.push({ t: Math.round(t * 100) / 100, text });
  }
  if (lines[lines.length - 1].t - lines[0].t < MIN_SPAN_SEC) return { ok: false, reason: 'too-short-span' };
  const exp = opts.expectedTexts;
  if (exp) {
    if (exp.length !== lines.length) return { ok: false, reason: 'lyrics-mismatch' };
    for (let i = 0; i < exp.length; i++) if (exp[i].trim() !== lines[i].text.trim()) return { ok: false, reason: 'lyrics-mismatch' };
  }
  return { ok: true, lines };
}

/**
 * 가사 원문에서 자동 맞추기 대상 줄(구간 표지 제외)을 뽑는다 — 플레이어 화면이 쓰는 것과 같은 분해.
 * 이미 시각 표시([mm:ss])가 들어 있는 가사는 맞출 필요가 없으므로 빈 목록.
 */
export function alignLineTexts(lyrics: string | null | undefined): string[] {
  const timed = buildTimedLyrics(lyrics, 1);
  if (timed.mode === 'exact') return [];
  return timed.lines.filter((l) => l.kind === 'line').map((l) => l.text);
}
