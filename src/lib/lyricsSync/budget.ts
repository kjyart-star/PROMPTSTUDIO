/**
 * Workers AI 무료 한도 하드 상한(순수 TS) — 과금이 절대 생기지 않게 한다.
 * 무료 할당: 하루 10,000 뉴런(Free·Paid 공통, 00:00 UTC 초기화). whisper-large-v3-turbo 는 오디오 1분에 46.63 뉴런
 * (1차 출처 developers.cloudflare.com/workers-ai/platform/pricing/, 확인 2026-11-02). 우리 상한은 9,000(1,000 여유).
 * 호출 전에 예상치를 「예약」하고(예약 + 사용 + 예상 ≤ 상한일 때만), 끝나면 실제 사용량으로 바꾼다. 실패해도 예상치를 쓴 것으로 센다.
 * 상한에 닿으면 그날은 더 부르지 않고 다음 날(UTC)로 넘긴다.
 */
export const NEURONS_PER_AUDIO_MIN = 46.63;
export const DAILY_NEURON_CAP = 9000;
export const FREE_DAILY_NEURONS = 10000;
/** 한 번에 보낼 수 있는 최대 곡 길이(초) — 예상치 오차가 여유(1,000)를 넘지 않게 한다(10분 ≈ 470 뉴런) */
export const MAX_AUDIO_SEC = 600;

/** 예상 뉴런(10% 여유 + 2) */
export function estimateNeurons(durationSec: number): number {
  const sec = Math.max(1, Math.min(MAX_AUDIO_SEC, Number(durationSec) || MAX_AUDIO_SEC));
  return Math.ceil((sec / 60) * NEURONS_PER_AUDIO_MIN * 1.1) + 2;
}

/** UTC 날짜 키(Workers AI 무료 할당이 초기화되는 기준) */
export const dayKeyUTC = (d = new Date()) => d.toISOString().slice(0, 10);

/** 날짜별 카운터 저장소 — 운영은 D1, 테스트는 메모리 */
export interface BudgetStore {
  /** used + reserved + est ≤ cap 일 때만 예약하고 true. 한 문장(원자적)으로 해야 한다 */
  reserve(day: string, est: number, cap: number): Promise<boolean>;
  /** 예약을 실제 사용량으로 바꾼다 */
  commit(day: string, est: number, actual: number): Promise<void>;
  usage(day: string): Promise<{ used: number; reserved: number }>;
}

/** 예상치를 예약하고 fn 을 부른다. 예약 못 하면 null(오늘은 그만). fn 이 던지면 예상치를 쓴 것으로 센다 */
export async function withBudget<T>(store: BudgetStore, durationSec: number, fn: () => Promise<{ value: T; neurons?: number | null }>, now = new Date(), cap = DAILY_NEURON_CAP): Promise<{ value: T; neurons: number } | null> {
  if (cap > DAILY_NEURON_CAP) cap = DAILY_NEURON_CAP; // 상한은 올릴 수 없다
  if (Number(durationSec) > MAX_AUDIO_SEC) throw new Error('too-long');
  const day = dayKeyUTC(now);
  const est = estimateNeurons(durationSec);
  if (!(await store.reserve(day, est, cap))) return null;
  try {
    const r = await fn();
    const actual = Number(r.neurons);
    // 보고된 실제값이 없거나 이상하면 예상치로 센다(적게 세는 쪽으로 틀리지 않게 큰 값)
    const n = isFinite(actual) && actual > 0 ? Math.max(actual, 0) : est;
    await store.commit(day, est, n);
    return { value: r.value, neurons: n };
  } catch (e) {
    await store.commit(day, est, est);
    throw e;
  }
}

/** 메모리 저장소(테스트·로컬) */
export class MemoryBudgetStore implements BudgetStore {
  rows = new Map<string, { used: number; reserved: number }>();
  async reserve(day: string, est: number, cap: number) {
    const r = this.rows.get(day) ?? { used: 0, reserved: 0 };
    if (r.used + r.reserved + est > cap) { this.rows.set(day, r); return false; }
    r.reserved += est; this.rows.set(day, r); return true;
  }
  async commit(day: string, est: number, actual: number) {
    const r = this.rows.get(day) ?? { used: 0, reserved: 0 };
    r.reserved = Math.max(0, r.reserved - est); r.used += actual; this.rows.set(day, r);
  }
  async usage(day: string) { return this.rows.get(day) ?? { used: 0, reserved: 0 }; }
}
