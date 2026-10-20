/**
 * 화면용 이름 — 쉬운 말 + 괄호 안에 전문 용어. 처리 엔진의 SLOT_LABEL(presets.ts)은 그대로 두고 화면에서만 쓴다.
 */
import type { SlotId } from '@/lib/mastering/dsp'
import type { MasteringEngine } from './engine'

export const MODULE_LABEL: Record<SlotId, string> = {
  gate: '잡음 정리(게이트)',
  eq: '다듬기(EQ)',
  mseq: '가운데·양옆 다듬기(M/S EQ)',
  dyneq: '자동 다듬기(다이내믹 EQ)',
  deesser: '치찰음 줄이기(디에서)',
  match: '톤 맞추기(매칭 EQ)',
  comp: '압축(컴프레서)',
  multiband: '대역별 압축(멀티밴드)',
  transient: '타격감(트랜지언트)',
  imager: '대역별 넓이(이미저)',
  stereo: '소리 넓이(스테레오)',
  saturation: '색감(새추레이션)',
  clipper: '부드러운 깎기(클리퍼)',
  limiter: '음량 상한(리미터)',
}

/** 예전 이름 — MODULE_LABEL 과 같다 */
export const SLOT_UI = MODULE_LABEL

/** 모듈이 하는 일 한 줄 */
export const SLOT_HELP: Record<SlotId, string> = {
  gate: '조용한 부분의 잡음을 줄여요',
  eq: '저음·중음·고음의 양을 다듬어요',
  mseq: '가운데 소리와 양옆 소리를 따로 다듬어요',
  dyneq: '특정 소리가 튈 때만 자동으로 다듬어요',
  deesser: '「스」「츠」 같은 날카로운 소리를 줄여요',
  match: '레퍼런스 곡의 톤을 따라가요',
  comp: '큰 소리를 눌러 소리를 고르게 해요',
  multiband: '저음·중음·고음을 따로 눌러요',
  transient: '때리는 소리와 울림의 길이를 바꿔요',
  imager: '대역마다 양옆으로 퍼지는 정도를 바꿔요',
  stereo: '소리가 양옆으로 퍼지는 정도를 바꿔요',
  saturation: '따뜻하고 진한 질감을 입혀요',
  clipper: '튀는 순간만 둥글게 깎아요',
  limiter: '전체 음량을 키우고 천장을 넘지 않게 막아요',
}

export type SlotKind = 'clean' | 'eq' | 'dyn' | 'stereo' | 'color' | 'limit'
export const SLOT_KIND: Record<SlotId, SlotKind> = {
  gate: 'clean', deesser: 'clean',
  eq: 'eq', mseq: 'eq', dyneq: 'eq', match: 'eq',
  comp: 'dyn', multiband: 'dyn', transient: 'dyn',
  imager: 'stereo', stereo: 'stereo',
  saturation: 'color',
  clipper: 'limit', limiter: 'limit',
}
export const KINDS: { id: SlotKind; label: string; color: string }[] = [
  { id: 'clean', label: '정리', color: '#9ea3aa' },
  { id: 'eq', label: '다듬기', color: '#4f8fe8' },
  { id: 'dyn', label: '다이내믹스', color: '#f0a43a' },
  { id: 'stereo', label: '넓이', color: '#b07be8' },
  { id: 'color', label: '색감', color: '#e2683c' },
  { id: 'limit', label: '상한', color: '#52d27e' },
]
export const kindColor = (s: SlotId) => KINDS.find(k => k.id === SLOT_KIND[s])!.color

type M = NonNullable<MasteringEngine['meters']>
/** 게인 리덕션을 재는 모듈 */
export const GR_PICK: Partial<Record<SlotId, (m: M) => number>> = {
  comp: m => m.compGr,
  limiter: m => m.limGr,
  gate: m => m.gateGr,
  deesser: m => m.deessGr,
  multiband: m => Math.min(...m.mbGr),
  dyneq: m => -Math.max(0, ...m.dyneqGr.map(v => Math.abs(v ?? 0))),
}

/** 미터 설명 */
export const METER_HELP = {
  lufs: '체감 음량 — 스트리밍은 -14 근처',
  tp: '가장 큰 순간의 높이 — 0 넘으면 찌그러짐',
  lra: '조용한 곳과 큰 곳의 차이',
  psr: '순간 피크와 체감 음량의 차이 — 작을수록 눌린 소리',
  plr: '최대 피크와 평균 음량의 차이 — 작을수록 납작한 소리',
  corr: '+1 가까우면 모노에서도 안전',
  gr: '압축·상한이 소리를 누르고 있는 양',
  level: '들어오는 소리와 나가는 소리의 높이',
  spectrum: '저음부터 고음까지 소리의 분포',
  gonio: '소리가 좌우로 퍼진 모양',
}

/** 상태 색: 목표 안(녹색) · 조금 벗어남(앰버) · 넘침(빨강) */
export function loudTone(v: number, target: number): string {
  if (!Number.isFinite(v)) return 'var(--m-dim)'
  const d = v - target
  if (Math.abs(d) <= 1) return 'var(--m-green)'
  if (d > 3) return 'var(--m-red)'
  return 'var(--m-amber)'
}
export function peakTone(v: number, ceiling: number): string {
  if (!Number.isFinite(v)) return 'var(--m-dim)'
  if (v <= ceiling + 0.05) return 'var(--m-green)'
  if (v <= 0) return 'var(--m-amber)'
  return 'var(--m-red)'
}
