/**
 * 가사 시간 계산 — 쿠키뮤직 「지금 재생」 화면용.
 * 가사에 [mm:ss.xx] 시간표가 있으면 그대로(정확), 없으면 곡 길이에 글자 수 비례로 추정한다.
 * 추정일 때는 화면에 반드시 「가사 시간 추정」을 표시한다(가짜 싱크 금지).
 */

import type { Span } from './vocalSpans';

export interface LyricLine {
  /** 'line' = 시간에 맞춰 강조되는 가사 줄, 'section' = [Verse] 같은 구간 표지(시간 없음) */
  kind: 'line' | 'section';
  text: string;
  /** 시작 초. section 은 NaN */
  start: number;
  /** 줄 끝 초(회사 PC 결과에만) */
  end?: number;
  /** 줄 신뢰도 0~1(회사 PC 결과에만) */
  conf?: number;
}

export interface TimedLyrics {
  lines: LyricLine[];
  mode: 'exact' | 'estimated' | 'none';
  /** estimated 일 때 근거 — audio: 음원 분석, length: 곡 길이 비례 */
  basis?: 'audio' | 'length';
}

const LRC_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const SECTION_TAG = /^\[[^\]\d][^\]]*\]$|^\(?\s*(verse|chorus|bridge|intro|outro|hook|pre-chorus|refrain|instrumental)\b[^)]*\)?$/i;

function tagSeconds(m: RegExpExecArray): number {
  const frac = m[3] ? Number(`0.${m[3]}`) : 0;
  return Number(m[1]) * 60 + Number(m[2]) + frac;
}

function parseExact(raw: string): LyricLine[] | null {
  const out: LyricLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const tags: number[] = [];
    LRC_TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LRC_TAG.exec(row))) tags.push(tagSeconds(m));
    if (!tags.length) continue;
    const text = row.replace(LRC_TAG, '').trim();
    if (!text) continue;
    for (const t of tags) out.push({ kind: 'line', text, start: t });
  }
  if (out.length < 2) return null;
  return out.sort((a, b) => a.start - b.start);
}

const INSTRUMENTAL_TAG = /^(intro|interlude|instrumental|solo|break|outro)\b/i;

/** 노래가 있는 구간들을 이어 붙인 시간 u(초) → 곡 안의 실제 시각 */
function toRealTime(u: number, spans: Span[]): number {
  let left = u;
  for (const sp of spans) {
    const len = sp.end - sp.start;
    if (left <= len) return sp.start + Math.max(0, left);
    left -= len;
  }
  const last = spans[spans.length - 1];
  return last.end;
}

/**
 * 줄 시작 시간을 추정한다.
 * - spans(음원 분석으로 찾은 노래 구간)가 있으면 그 구간 안에만, 글자 수 비례로 줄을 놓는다(전주·간주·후주에는 놓지 않음).
 * - 없으면 곡 길이에 비례(앞 8%·뒤 6%는 비워 둠).
 */
function estimate(raw: string, durationSec: number, spans?: Span[]): LyricLine[] {
  const rows = raw.split(/\r?\n/).map((r) => r.trim());
  const items: { kind: 'line' | 'section'; text: string; weight: number; instrumental?: boolean }[] = [];
  let pendingGap = 0;
  for (const row of rows) {
    if (!row) { pendingGap += 6; continue; }
    if (SECTION_TAG.test(row)) {
      const text = row.replace(/^[[(]|[\])]$/g, '').trim();
      items.push({ kind: 'section', text, weight: 0, instrumental: INSTRUMENTAL_TAG.test(text) });
      continue;
    }
    // 앞선 빈 줄(연 사이 쉬는 구간)은 직전 가사 줄 뒤에 얹는다
    const prev = [...items].reverse().find((i) => i.kind === 'line');
    if (prev && pendingGap) prev.weight += pendingGap;
    pendingGap = 0;
    items.push({ kind: 'line', text: row, weight: Math.max(row.length, 6) + 10 });
  }
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (!total) return items.map((i) => ({ kind: i.kind, text: i.text, start: NaN }));

  if (spans && spans.length) {
    const vocalLen = spans.reduce((s, sp) => s + (sp.end - sp.start), 0);
    // 분석이 쉬는 구간을 못 찾은 곡(앞 무음도 없고 구간이 하나)이면 [Intro] 같은 표지로 전주 길이를 대신 잡는다
    const analysisSawBreak = spans.length > 1 || spans[0].start > 2;
    const secPerWeight = vocalLen / total;
    for (const it of items) {
      if (it.kind === 'section' && it.instrumental && !analysisSawBreak) it.weight = Math.min(10, vocalLen * 0.08) / secPerWeight;
    }
    // 맨 끝에 가사 줄 없이 남은 구간 표지([Outro]·[Final Chorus] 등)는 노래 뒤쪽을 비워 두라는 뜻으로 보고 꼬리를 남긴다
    const lastLine = items.map((i) => i.kind).lastIndexOf('line');
    const trailing = items.slice(lastLine + 1).filter((i) => i.kind === 'section');
    if (trailing.length) trailing[0].weight = Math.min(14, vocalLen * 0.12) / secPerWeight;
    const total2 = items.reduce((s, i) => s + i.weight, 0);
    let acc = 0;
    return items.map((i) => {
      const start = i.kind === 'line' ? toRealTime((acc / total2) * vocalLen, spans) : NaN;
      acc += i.weight;
      return { kind: i.kind, text: i.text, start };
    });
  }

  const intro = Math.min(12, durationSec * 0.08);
  const outro = Math.min(10, durationSec * 0.06);
  const span = Math.max(1, durationSec - intro - outro);
  let acc = 0;
  return items.map((i) => {
    const start = i.kind === 'line' ? intro + (acc / total) * span : NaN;
    acc += i.weight;
    return { kind: i.kind, text: i.text, start };
  });
}

export interface TimedLine { t: number; text: string; end?: number; conf?: number }
export interface BuildOptions {
  /** 저장된 가사 시간표(LRC/SRT·가사 시간 편집·자동 맞추기 결과) */
  lrc?: TimedLine[] | null;
  /** 음원 분석으로 찾은 노래 구간 */
  spans?: Span[] | null;
}

export function buildTimedLyrics(raw: string | null | undefined, durationSec: number, opts?: BuildOptions): TimedLyrics {
  const text = (raw ?? '').trim();
  const saved = (opts?.lrc ?? []).filter((l) => l && isFinite(l.t) && l.text);
  if (saved.length >= 2) {
    return {
      lines: [...saved].sort((a, b) => a.t - b.t).map((l) => {
        const out: LyricLine = { kind: 'line', text: l.text, start: l.t };
        if (typeof l.end === 'number' && isFinite(l.end)) out.end = l.end;
        if (typeof l.conf === 'number' && isFinite(l.conf)) out.conf = l.conf;
        return out;
      }),
      mode: 'exact',
    };
  }
  if (!text) return { lines: [], mode: 'none' };
  const exact = parseExact(text);
  if (exact) return { lines: exact, mode: 'exact' };
  if (!durationSec || !isFinite(durationSec) || durationSec <= 0) {
    // 길이를 모르면 시간을 추정할 수 없다 — 줄만 보여 주고 강조는 하지 않는다.
    const lines = estimate(text, 1).map((l) => ({ ...l, start: NaN }));
    return { lines, mode: 'none' };
  }
  const spans = opts?.spans && opts.spans.length ? opts.spans : undefined;
  return { lines: estimate(text, durationSec, spans), mode: 'estimated', basis: spans ? 'audio' : 'length' };
}

/** 지금 시각에 강조할 줄의 index (아직 첫 줄 전이면 -1). section 은 건너뛴다. */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind !== 'line' || isNaN(l.start)) continue;
    if (l.start <= t) idx = i;
    else break;
  }
  return idx;
}

/** 다음 줄 시각을 모르는 줄은 시작한 지 이 시간(초)이 지나면 강조를 멈춘다 */
export const PARTIAL_HOLD_SEC = 8;

/**
 * 부분 시간표(줄 일부만 시각을 아는 상태)에서 강조할 줄 번호. 없으면 -1(일반 가사로 보인다).
 * 시각을 아는 줄 중 starts[i] <= t 인 마지막 줄 i 를 고르되, 다음 줄 시각을 모르면 t - starts[i] < 8초일 때만 강조한다.
 */
export function activePartialIndex(starts: (number | null)[] | null | undefined, t: number): number {
  if (!starts) return -1;
  let idx = -1;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    if (s !== null && s !== undefined && isFinite(s) && s <= t) idx = i;
  }
  if (idx < 0) return -1;
  const next = starts[idx + 1];
  const nextKnown = next !== null && next !== undefined && isFinite(next);
  return nextKnown || t - (starts[idx] as number) < PARTIAL_HOLD_SEC ? idx : -1;
}

/** 줄을 시작 시각보다 이만큼 먼저 켠다 */
export const LINE_LEAD_SEC = 0.3;
/** 줄 끝을 지나 다음 줄까지 이보다 많이 남으면 간주로 본다 */
export const INTERLUDE_GAP_SEC = 2;
/** 이 신뢰도 아래 줄은 강조하지 않는다(lrcValidate.LOW_CONF 와 같은 값) */
export const LOW_CONF = 0.35;

export interface LyricState {
  /** 강조할 줄 번호(없으면 -1) */
  active: number;
  /** 간주 중이면 직전 줄 번호(그 아래에 ♪ 대기 표시), 아니면 -1 */
  interludeAfter: number;
  /** 시작 시각이 지난 마지막 줄(강조 여부와 무관) — 스크롤·흐림 기준 */
  current: number;
}

/**
 * 확정 시간표에서 지금 상태. 줄은 시작 0.3초 전에 켠다.
 * - 줄 끝(end)을 지났고 다음 줄 시작까지 2초 넘게 남았으면 간주: 강조 없음 + 대기 표시.
 * - 신뢰도(conf)가 낮은 줄 구간은 강조하지 않는다(틀린 강조보다 강조 없음).
 * end·conf 가 없는 시간표(사용자 LRC·옛 결과)는 예전처럼 다음 줄 전까지 강조한다.
 */
export function lyricState(lines: LyricLine[], t: number): LyricState {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind !== 'line' || isNaN(l.start)) continue;
    if (l.start - LINE_LEAD_SEC <= t) idx = i;
    else break;
  }
  if (idx < 0) return { active: -1, interludeAfter: -1, current: -1 };
  const cur = lines[idx];
  if (typeof cur.conf === 'number' && cur.conf < LOW_CONF) return { active: -1, interludeAfter: -1, current: idx };
  if (typeof cur.end === 'number' && t > cur.end) {
    let next: LyricLine | undefined;
    for (let j = idx + 1; j < lines.length; j++) if (lines[j].kind === 'line' && !isNaN(lines[j].start)) { next = lines[j]; break; }
    const left = next ? next.start - LINE_LEAD_SEC - t : Infinity;
    if (left > INTERLUDE_GAP_SEC) return { active: -1, interludeAfter: idx, current: idx };
  }
  return { active: idx, interludeAfter: -1, current: idx };
}
