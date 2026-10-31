/**
 * 가사 시간 계산 — 쿠키뮤직 「지금 재생」 화면용.
 * 가사에 [mm:ss.xx] 시간표가 있으면 그대로(정확), 없으면 곡 길이에 글자 수 비례로 추정한다.
 * 추정일 때는 화면에 반드시 「가사 시간 추정」을 표시한다(가짜 싱크 금지).
 */

export interface LyricLine {
  /** 'line' = 시간에 맞춰 강조되는 가사 줄, 'section' = [Verse] 같은 구간 표지(시간 없음) */
  kind: 'line' | 'section';
  text: string;
  /** 시작 초. section 은 NaN */
  start: number;
}

export interface TimedLyrics {
  lines: LyricLine[];
  mode: 'exact' | 'estimated' | 'none';
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

/** 곡 길이(초)에 글자 수 비례로 줄 시작 시간을 추정한다. */
function estimate(raw: string, durationSec: number): LyricLine[] {
  const rows = raw.split(/\r?\n/).map((r) => r.trim());
  const items: { kind: 'line' | 'section'; text: string; weight: number }[] = [];
  let pendingGap = 0;
  for (const row of rows) {
    if (!row) { pendingGap += 6; continue; }
    if (SECTION_TAG.test(row)) {
      items.push({ kind: 'section', text: row.replace(/^[[(]|[\])]$/g, '').trim(), weight: 0 });
      continue;
    }
    // 앞선 빈 줄(연 사이 쉬는 구간)은 직전 가사 줄 뒤에 얹는다
    const prev = [...items].reverse().find((i) => i.kind === 'line');
    if (prev && pendingGap) prev.weight += pendingGap;
    pendingGap = 0;
    items.push({ kind: 'line', text: row, weight: Math.max(row.length, 6) + 4 });
  }
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (!total) return items.map((i) => ({ kind: i.kind, text: i.text, start: NaN }));
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

export function buildTimedLyrics(raw: string | null | undefined, durationSec: number): TimedLyrics {
  const text = (raw ?? '').trim();
  if (!text) return { lines: [], mode: 'none' };
  const exact = parseExact(text);
  if (exact) return { lines: exact, mode: 'exact' };
  if (!durationSec || !isFinite(durationSec) || durationSec <= 0) {
    // 길이를 모르면 시간을 추정할 수 없다 — 줄만 보여 주고 강조는 하지 않는다.
    const lines = estimate(text, 1).map((l) => ({ ...l, start: NaN }));
    return { lines, mode: 'none' };
  }
  return { lines: estimate(text, durationSec), mode: 'estimated' };
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
