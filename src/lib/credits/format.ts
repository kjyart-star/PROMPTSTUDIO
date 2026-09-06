/**
 * 크레딧 표기 — 저장은 밀리크레딧, **화면은 정수 크레딧**.
 *
 * **1 크레딧 = 1,000 밀리크레딧.** 쿠키플레이 워커의 지갑·원장·차감표가 전부 이 단위라
 * 이 앱이 주고받는 balance·required·단가도 밀리크레딧이다.
 * 정본은 COOKIELAB `src/lib/credits/format.ts` — 같은 규칙을 이 저장소에 옮겨 적은 것이다.
 *
 * 대표 지시 2026-09-07 — "크레딧도 2.4 이렇게 소수점으로 가면 안 됨." 차감 단가가 전부
 * 정수로 재산정됐으므로(COOKIELAB `docs/credits-integer-nexus-2026-09.md`) 화면에서 깎일
 * 소수가 애초에 없고, 이 파일은 **옛 배포가 남긴 소수 잔액**이 새어 나오는 것만 막는다.
 */

export const MILLI_PER_CREDIT = 1000

/** 표시 소수 자릿수 — 0. 크레딧은 화면에 소수로 나오지 않는다. */
const DECIMALS = 0

/** 밀리크레딧 → 크레딧(소수). 표기하지 않고 계산에 쓸 때만. */
export function toCredits(milli: number): number {
  return milli / MILLI_PER_CREDIT
}

/**
 * `8000 → "8"` · `2400 → "2"` · `28356000 → "28,356"`.
 *
 * **남은 소수는 버린다(내림).** 잔액을 올려 보여 주면 「4 크레딧 있는데 4 크레딧짜리를
 * 못 산다」가 되어 402 를 사용자에게 설명할 수 없다.
 */
export function formatCredits(milli: number): string {
  return Math.floor(Math.abs(milli) / MILLI_PER_CREDIT).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: DECIMALS,
  })
}

/**
 * **차감 단가** 표기. 잔액(`formatCredits`)과 달리 남은 소수를 **올린다**.
 *
 * 지켜야 하는 것은 한 줄이다 — **화면에 적힌 수가 실제보다 작으면 안 된다.**
 * 잔액은 내려야 그 규칙을 지키고(있는 것보다 많다고 하면 안 된다), 단가는 올려야 지킨다
 * (빠지는 것보다 적다고 하면 안 된다). 방향이 반대라 함수를 나눠 둔다.
 *
 * 0031(정수 단가)이 배포되면 단가는 전부 1,000 의 배수라 올릴 소수가 없어 두 함수가 같아진다.
 * 그때까지의 과도기에 화면이 0.6 을 「0」으로, 4.4 를 「4」로 적는 것을 막는 것이 이 함수다.
 */
export function formatPriceCredits(milli: number): string {
  return Math.ceil(Math.abs(milli) / MILLI_PER_CREDIT).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: DECIMALS,
  })
}

/** 좁은 자리. 세 자리·네 자리는 줄이지 않는다 — 새 눈금에서는 대부분 그 안에 들어온다. */
export function compactCredits(milli: number): string {
  const value = toCredits(Math.abs(milli))
  if (value < 100_000) return formatCredits(milli)
  // 접어도 소수는 만들지 않는다 — 화면의 크레딧 숫자는 어디서도 소수가 아니다.
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`
  return `${Math.round(value / 1_000_000)}M`
}
