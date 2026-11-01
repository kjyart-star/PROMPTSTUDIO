/**
 * 받아쓰기(단어 시각) ↔ 원문 가사 맞추기(순수 TS) — Workers AI 무료 큐가 쓴다.
 * 2026-11-02 실측: whisper-large-v3-turbo + 가사 앞부분 initial_prompt 받아쓰기를 원문과 글자 단위로 맞추면 6곡 모두 성공(평균 0.48초),
 * 브라우저 강제 정렬 결과를 받아쓰기로 ±20초 안에서 보정하면 평균 0.44 → 0.37초(docs/research/lyrics-sync-service-architecture-2026-11-02.md).
 */
export interface Word { word: string; start: number; end: number }

export const norm = (s: string) => String(s).toLowerCase().replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, '');

/** 받아쓰기 단어를 글자 단위로 펴고 글자마다 시각을 붙인다 */
function charsOf(words: Word[]): { text: string; times: number[] } {
  let text = '';
  const times: number[] = [];
  for (const w of words) {
    const cs = norm(w.word);
    const st = Number(w.start) || 0, en = Number(w.end) || st;
    for (let k = 0; k < cs.length; k++) { text += cs[k]; times.push(st + ((en - st) * k) / Math.max(1, cs.length)); }
  }
  return { text, times };
}

/** 두 글자열의 최장 공통 부분열 짝(단조 증가) — 연속 2글자 이상 이어진 짝만 남긴다 */
export function lcsPairs(a: string, b: string): [number, number][] {
  const n = a.length, m = b.length;
  if (!n || !m) return [];
  const W = m + 1;
  const dp = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
  }
  const pairs: [number, number][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }
  return pairs.filter((p, k) => {
    const prev = pairs[k - 1], next = pairs[k + 1];
    return (prev && prev[0] === p[0] - 1 && prev[1] === p[1] - 1) || (next && next[0] === p[0] + 1 && next[1] === p[1] + 1);
  });
}

/** 줄마다 시작 초(받아쓰기 시각). 줄 글자의 minFrac 미만만 맞으면 null */
export function matchWords(words: Word[], lines: string[], minFrac = 0.3): (number | null)[] {
  const L: string[] = [], Li: number[] = [];
  lines.forEach((l, i) => { for (const c of norm(l)) { L.push(c); Li.push(i); } });
  const { text, times } = charsOf(words);
  const lens = lines.map((l) => norm(l).length || 1);
  const offs: number[] = []; let acc = 0; for (const n of lens) { offs.push(acc); acc += n; }
  const first: ({ a: number; t: number } | null)[] = lines.map(() => null);
  const cnt = lines.map(() => 0);
  for (const [a, b] of lcsPairs(L.join(''), text)) {
    const li = Li[a]; cnt[li]++;
    if (!first[li]) first[li] = { a, t: times[b] };
  }
  return lines.map((_, i) => {
    const f = first[i];
    if (!f || cnt[i] / lens[i] < minFrac) return null;
    const lead = Math.min(3, (f.a - offs[i]) * 0.25); // 줄 첫 글자보다 뒤에서 맞기 시작하면 그만큼 당긴다(글자당 0.25초)
    return Math.max(0, f.t - lead);
  });
}

/**
 * 이미 있는 줄 시각을 받아쓰기로 보정한다 — 줄마다 그 시각 ±win 초 안에서 원문 줄 앞 5글자가 그대로 들리는 곳을 찾아,
 * thr 초 넘게 다르면 그 시각(− lead)으로 옮긴다. 창을 넓히면 후렴 반복을 잘못 잡아 나빠진다(±40초 실측 악화).
 * 반환: 보정한 시각(단조 증가가 깨지는 줄은 원래 값 유지)과 옮긴 줄 수·근거를 찾은 줄 수
 */
export function localFix(starts: number[], words: Word[], lines: string[], opts: { win?: number; thr?: number; lead?: number } = {}) {
  const win = opts.win ?? 20, thr = opts.thr ?? 2, lead = opts.lead ?? 0.5;
  const { text, times } = charsOf(words);
  const out = starts.slice();
  let moved = 0, found = 0;
  const diffs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const s = out[i];
    const L = norm(lines[i]);
    if (L.length < 5 || !isFinite(s)) continue;
    let best: number | null = null;
    for (let k = 0; k <= Math.min(3, L.length - 5); k++) {
      const seed = L.slice(k, k + 5);
      for (let idx = text.indexOf(seed); idx >= 0; idx = text.indexOf(seed, idx + 1)) {
        const t = times[idx] - k * 0.25;
        if (Math.abs(t - s) > win) continue;
        if (best === null || Math.abs(t - s) < Math.abs(best - s)) best = t;
      }
      if (best !== null) break; // 줄 첫 글자에 가까운 씨앗을 먼저 쓴다
    }
    if (best === null) continue;
    found++;
    diffs.push(Math.abs(best - lead - s));
    const cand = Math.round(Math.max(0, best - lead) * 100) / 100;
    if (Math.abs(cand - s) > thr && (i === 0 || cand >= out[i - 1]) && (i === lines.length - 1 || cand <= out[i + 1])) { out[i] = cand; moved++; }
  }
  const sorted = diffs.sort((a, b) => a - b);
  return { starts: out, moved, found, medianDiff: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null };
}
