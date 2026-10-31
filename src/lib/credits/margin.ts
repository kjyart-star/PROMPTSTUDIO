import data from './paidFeatures.json'

export interface PaidFeature {
  id: string
  serviceId: string
  action: string
  credits: number
  costUsd: number
  failureFactor: number
  storageKrw: number
  note?: string
}

export const PAID_FEATURES: PaidFeature[] = data.features
export const MARGIN = {
  fxKrwPerUsd: data.fxKrwPerUsd,
  gatewayFeeKrw: data.gatewayFeeKrw,
  pgFeeRate: data.pgFeeRate,
  deepestKrwPerCredit: data.deepestKrwPerCredit,
  minMultiple: data.minMultiple,
}

/** 건당 최악 원가(원): (공급 원가 × 환율 + 게이트웨이 수수료) × 실패·재시도 여유 + 저장·전송 */
export function worstCostKrw(f: PaidFeature): number {
  return (f.costUsd * MARGIN.fxKrwPerUsd + MARGIN.gatewayFeeKrw) * f.failureFactor + f.storageKrw
}

/** 최심 단가(₩80/CR)로 받는 금액 */
export function revenueKrw(f: PaidFeature): number {
  return f.credits * MARGIN.deepestKrwPerCredit
}

/** 결제 수수료까지 뺀 실수령 / 최악 원가 */
export function netMultiple(f: PaidFeature): number {
  return (revenueKrw(f) * (1 - MARGIN.pgFeeRate)) / worstCostKrw(f)
}

/** 대표 규칙: CR × 80 ≥ 최악 원가 × 2 */
export function meetsFloor(f: PaidFeature): boolean {
  return revenueKrw(f) >= worstCostKrw(f) * MARGIN.minMultiple
}

/** 이 원가에서 규칙을 지키는 최소 정수 크레딧 */
export function floorCredits(f: Omit<PaidFeature, 'credits'>): number {
  return Math.ceil((worstCostKrw({ ...f, credits: 0 }) * MARGIN.minMultiple) / MARGIN.deepestKrwPerCredit)
}
