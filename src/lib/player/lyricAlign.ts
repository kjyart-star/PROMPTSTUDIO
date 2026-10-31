/**
 * 음성 인식(whisper) 결과를 원문 가사에 맞춰 줄 시작 시간을 만든다.
 * 인식 결과는 노래라서 틀린 글자가 많다 — 그래서 단어 일치가 아니라 글자 단위 전역 정렬(편집 거리)로 맞추고,
 * 글자가 충분히 맞은 줄만 기준점으로 삼아 나머지 줄은 기준점 사이를 글자 수 비례로 채운다.
 * 기준점이 너무 적으면 실패로 돌려보낸다(가짜 싱크 금지) — 부르는 쪽이 추정으로 되돌아간다.
 */

export interface AsrSegment { text: string; start: number; end: number }
export interface AlignedLine { t: number; anchored: boolean }
export interface AlignResult { lines: AlignedLine[]; anchoredRatio: number; ok: boolean }

const norm = (s: string) => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

/** 기준점으로 삼을 줄의 최소 일치 비율 / 성공으로 볼 기준점 줄 비율 */
const MIN_LINE_MATCH = 0.3;
const MIN_ANCHORED = 0.5;

export function alignLyricsToSegments(lyricLines: string[], segments: AsrSegment[], durationSec: number): AlignResult {
  const n = lyricLines.length;
  const fail: AlignResult = { lines: lyricLines.map(() => ({ t: NaN, anchored: false })), anchoredRatio: 0, ok: false };
  if (!n) return fail;

  // 인식된 글자열 — 글자마다 구간 안에서 고르게 시간을 나눈다
  const aChar: string[] = [];
  const aTime: number[] = [];
  for (const sg of segments) {
    const t = norm(sg.text);
    if (!t || !isFinite(sg.start)) continue;
    const end = isFinite(sg.end) && sg.end > sg.start ? sg.end : sg.start + t.length * 0.25;
    for (let k = 0; k < t.length; k++) { aChar.push(t[k]); aTime.push(sg.start + (k / t.length) * (end - sg.start)); }
  }
  // 원문 글자열
  const lChar: string[] = [];
  const lLine: number[] = [];
  lyricLines.forEach((ln, li) => { for (const ch of norm(ln)) { lChar.push(ch); lLine.push(li); } });
  if (aChar.length < 8 || lChar.length < 8) return fail;

  const N = lChar.length, M = aChar.length;
  // 전역 정렬 DP — 비용: 일치 0, 치환 1, 빠짐 1. 되짚기용 방향만 저장
  const dir = new Uint8Array((N + 1) * (M + 1)); // 0 대각, 1 위(원문 글자 건너뜀), 2 왼쪽(인식 글자 건너뜀)
  let prev = new Float32Array(M + 1);
  let cur = new Float32Array(M + 1);
  for (let j = 0; j <= M; j++) { prev[j] = j; dir[j] = 2; }
  for (let i = 1; i <= N; i++) {
    cur[0] = i; dir[i * (M + 1)] = 1;
    for (let j = 1; j <= M; j++) {
      const diag = prev[j - 1] + (lChar[i - 1] === aChar[j - 1] ? 0 : 1);
      const up = prev[j] + 1;
      const left = cur[j - 1] + 1;
      let best = diag, d = 0;
      if (up < best) { best = up; d = 1; }
      if (left < best) { best = left; d = 2; }
      cur[j] = best; dir[i * (M + 1) + j] = d;
    }
    [prev, cur] = [cur, prev];
  }
  // 되짚기: 원문 글자 i 가 인식 글자 j 에 대응하면 시간·일치 여부를 기록
  const charTime: number[] = new Array(N).fill(NaN);
  const charHit: boolean[] = new Array(N).fill(false);
  let i = N, j = M;
  while (i > 0 || j > 0) {
    const d = dir[i * (M + 1) + j];
    if (i > 0 && j > 0 && d === 0) { charTime[i - 1] = aTime[j - 1]; charHit[i - 1] = lChar[i - 1] === aChar[j - 1]; i--; j--; }
    else if (i > 0 && (j === 0 || d === 1)) i--;
    else j--;
  }

  // 줄별: 첫 대응 글자의 시간, 일치 비율
  const t0: number[] = new Array(n).fill(NaN);
  const hits: number[] = new Array(n).fill(0);
  const size: number[] = new Array(n).fill(0);
  for (let c = 0; c < N; c++) {
    const li = lLine[c];
    size[li]++;
    if (charHit[c]) hits[li]++;
    if (isNaN(t0[li]) && !isNaN(charTime[c])) t0[li] = charTime[c];
  }
  const anchored = lyricLines.map((_, li) => size[li] > 0 && hits[li] / size[li] >= MIN_LINE_MATCH && !isNaN(t0[li]));
  // 기준점이 시간 순서를 거꾸로 가면 버린다(가장 큰 값 기준 단조 유지)
  let top = -Infinity;
  for (let li = 0; li < n; li++) {
    if (!anchored[li]) continue;
    if (t0[li] < top) anchored[li] = false; else top = t0[li];
  }
  const count = anchored.filter(Boolean).length;
  const ratio = count / n;
  if (ratio < MIN_ANCHORED || count < 2) return { ...fail, anchoredRatio: ratio };

  // 기준점 사이는 글자 수 비례로 채운다
  const w = lyricLines.map((l) => Math.max(norm(l).length, 3));
  const out: AlignedLine[] = new Array(n);
  const idx = anchored.map((a, k) => (a ? k : -1)).filter((k) => k >= 0);
  const first = idx[0], last = idx[idx.length - 1];
  const rate = (t0[last] - t0[first]) / Math.max(1, w.slice(first, last).reduce((s, x) => s + x, 0)); // 초/글자
  for (let k = 0; k < n; k++) {
    if (anchored[k]) { out[k] = { t: t0[k], anchored: true }; continue; }
    if (k < first) {
      const gap = w.slice(k, first).reduce((s, x) => s + x, 0);
      out[k] = { t: Math.max(0, t0[first] - gap * rate), anchored: false };
    } else if (k > last) {
      const gap = w.slice(last, k).reduce((s, x) => s + x, 0);
      out[k] = { t: Math.min(Math.max(t0[last], durationSec - 1), t0[last] + gap * rate), anchored: false };
    } else {
      let a = k - 1; while (!anchored[a]) a--;
      let b = k + 1; while (!anchored[b]) b++;
      const span = w.slice(a, b).reduce((s, x) => s + x, 0);
      const before = w.slice(a, k).reduce((s, x) => s + x, 0);
      out[k] = { t: t0[a] + ((t0[b] - t0[a]) * before) / span, anchored: false };
    }
  }
  for (let k = 1; k < n; k++) if (out[k].t < out[k - 1].t) out[k].t = out[k - 1].t;
  return { lines: out, anchoredRatio: ratio, ok: true };
}
