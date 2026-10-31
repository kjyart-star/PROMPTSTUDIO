/**
 * 음원에서 「노래가 있는 구간」을 찾는다 — 브라우저에서 디코드한 모노 샘플만 쓴다(서버·유료 호출 없음).
 * 보컬 대역(약 300Hz~3kHz)의 에너지가 곡의 큰 소리 수준에서 크게 떨어지는 곳(곡 앞 무음·긴 간주·끝 무음)을
 * 노래가 없는 구간으로 본다. 악기만 있어도 보컬 대역은 울리므로, 소리가 이어지는 악기 전주까지 가려내지는 못한다.
 */

export interface Span { start: number; end: number }

const FRAME_SEC = 0.1;
/** 큰 소리 수준(90퍼센타일)보다 이만큼(dB) 더 작으면 쉬는 구간 */
const DROP_DB = 14;
/** 이 길이(초)보다 짧은 쉼은 노래 사이의 숨으로 보고 메운다 */
const MIN_BREAK_SEC = 2.5;
/** 이 길이(초)보다 짧은 소리 토막은 소음으로 보고 버린다 */
const MIN_ON_SEC = 0.5;
/** 이 길이(초)보다 짧은 구간은 버린다 */
const MIN_SPAN_SEC = 1.5;

/** 2차 필터(RBJ cookbook). 반환: 입력 배열을 걸러 낸 새 배열 */
function biquad(x: Float32Array, kind: 'hp' | 'lp', freq: number, sr: number): Float32Array {
  const w0 = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w0);
  let b0: number, b1: number, b2: number;
  if (kind === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
  else { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
  const a0 = 1 + alpha, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = yi;
    y[i] = yi;
  }
  return y;
}

/** 0.1초 프레임마다 보컬 대역(300Hz~3kHz) 에너지(dB) */
export function vocalBandDb(x: Float32Array, sr: number): Float32Array {
  const band = biquad(biquad(x, 'hp', 300, sr), 'lp', 3000, sr);
  const hop = Math.max(1, Math.round(sr * FRAME_SEC));
  const n = Math.floor(band.length / hop);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * hop, e = i + hop; i < e; i++) s += band[i] * band[i];
    out[f] = 10 * Math.log10(s / hop + 1e-10);
  }
  return out;
}

export function findVocalSpans(x: Float32Array, sr: number): Span[] {
  const db = vocalBandDb(x, sr);
  const total = x.length / sr;
  const full: Span[] = [{ start: 0, end: total }];
  if (db.length < 20) return full;
  const sorted = Array.from(db).sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  // 거의 무음인 파일 — 분석할 근거가 없다
  if (p90 < -60) return full;
  const th = p90 - DROP_DB;
  const on = Array.from(db, (v) => v > th);
  // 0.5초보다 짧은 소리 토막(클릭·숨소리)은 노래로 치지 않는다
  const minOn = Math.round(MIN_ON_SEC / FRAME_SEC);
  for (let i = 0; i < on.length;) {
    if (!on[i]) { i++; continue; }
    let j = i;
    while (j < on.length && on[j]) j++;
    if (j - i < minOn) for (let k = i; k < j; k++) on[k] = false;
    i = j;
  }
  // 짧은 쉼 메우기
  const minBreak = Math.round(MIN_BREAK_SEC / FRAME_SEC);
  for (let i = 0; i < on.length;) {
    if (on[i]) { i++; continue; }
    let j = i;
    while (j < on.length && !on[j]) j++;
    const edge = i === 0 || j === on.length; // 곡 앞·끝 무음은 짧아도 그대로 둔다
    if (!edge && j - i < minBreak) for (let k = i; k < j; k++) on[k] = true;
    i = j;
  }
  const spans: Span[] = [];
  for (let i = 0; i < on.length;) {
    if (!on[i]) { i++; continue; }
    let j = i;
    while (j < on.length && on[j]) j++;
    if ((j - i) * FRAME_SEC >= MIN_SPAN_SEC) spans.push({ start: i * FRAME_SEC, end: Math.min(total, j * FRAME_SEC) });
    i = j;
  }
  return spans.length ? spans : full;
}
