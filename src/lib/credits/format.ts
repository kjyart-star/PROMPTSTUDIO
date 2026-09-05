/**
 * 크레딧 표기 — 저장은 정수, 화면은 소수.
 *
 * **1 크레딧 = 1,000 밀리크레딧.** 쿠키플레이 워커의 지갑·원장·차감표가 전부 이 단위라
 * 이 앱이 주고받는 balance·required·단가도 밀리크레딧이다. 소수는 여기서만 만들어진다.
 * 정본은 COOKIELAB `src/lib/credits/format.ts` — 같은 규칙을 이 저장소에 옮겨 적은 것이다.
 */

export const MILLI_PER_CREDIT = 1000

/** 밀리크레딧 → 크레딧(소수). 표기하지 않고 계산에 쓸 때만. */
export function toCredits(milli: number): number {
  return milli / MILLI_PER_CREDIT
}

/** `3200 → "3.2"` · `2000 → "2"` · `28356000 → "28,356"`. 소수 둘째 자리까지, 뒤의 0 은 뗀다. */
export function formatCredits(milli: number): string {
  return toCredits(Math.abs(milli)).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/** 좁은 자리. 세 자리·네 자리는 줄이지 않는다 — 새 눈금에서는 대부분 그 안에 들어온다. */
export function compactCredits(milli: number): string {
  const value = toCredits(Math.abs(milli))
  if (value < 100_000) return formatCredits(milli)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${k < 100 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const m = value / 1_000_000
  return `${m < 100 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`
}
