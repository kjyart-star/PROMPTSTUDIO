import { plausibleSpacing } from './lrcValidate';

/**
 * 강제 정렬(워커)이 돌려준 줄 시작 시각을 LRC 로 쓸 수 있게 다듬고, 믿을 수 없는 결과는 걸러 낸다.
 */

/**
 * 어텐션 DTW 가 잡는 시각은 소리가 시작된 뒤에 찍히는 경향이 있어 앞당긴다(가사가 소리보다 살짝 먼저 켜지는 쪽이 읽기에도 낫다).
 * 2026-11-01 운영 음원 5곡(103줄)을 whisper large-v3 단어 시각과 견주어 0.8 → 1.0 으로 맞췄다(평균 오차 0.49 → 0.43초).
 */
export const ONSET_LEAD_SEC = 1.0;

/**
 * @param starts 줄마다 시작 초(맞추지 못한 줄은 null)
 * @returns 줄마다 시작 초(단조 증가). 결과를 믿을 수 없으면 null
 */
export function finalizeAlignment(starts: (number | null)[], durationSec: number): number[] | null {
  const n = starts.length;
  if (n < 2) return null;
  const ok = starts.map((v) => (v === null || !isFinite(v) ? null : v));
  const known = ok.filter((v) => v !== null).length;
  if (known / n < 0.7) return null;
  // 빈 줄은 이웃 사이를 고르게 채운다
  const t = ok.slice() as (number | null)[];
  for (let i = 0; i < n; i++) {
    if (t[i] !== null) continue;
    let a = i - 1; while (a >= 0 && t[a] === null) a--;
    let b = i + 1; while (b < n && t[b] === null) b++;
    if (a >= 0 && b < n) t[i] = (t[a] as number) + (((t[b] as number) - (t[a] as number)) * (i - a)) / (b - a);
    else if (a >= 0) t[i] = (t[a] as number) + 3 * (i - a);
    else t[i] = (t[b] as number) - 3 * (b - i);
  }
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let v = Math.max(0, (t[i] as number) - ONSET_LEAD_SEC);
    if (durationSec > 0) v = Math.min(v, durationSec);
    v = Math.max(v, prev);
    out.push(Math.round(v * 100) / 100);
    prev = v;
  }
  // 가사 전체가 곡의 아주 짧은 구간에 뭉쳐 있으면 정렬이 무너진 것
  if (durationSec > 0 && out[n - 1] - out[0] < Math.min(20, durationSec * 0.2)) return null;
  if (!plausibleSpacing(out)) return null;
  return out;
}
