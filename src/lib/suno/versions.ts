/**
 * APIPASS 의 suno/generate · suno/cover 가 받는 값들.
 * 생성 탭과 커버 탭이 같은 목록을 쓰도록 여기 한 곳에만 둔다 —
 * 다음 버전이 나오면 이 파일만 고치면 된다.
 * 출처: https://apipass.dev/model/suno/suno_generate · /suno_cover (2026-09-06 확인)
 */

export const SUNO_MODEL_VERSIONS = [
  { value: 'V5_5', label: 'Suno V5.5' },
  { value: 'V5', label: 'Suno V5' },
  { value: 'V4_5PLUS', label: 'Suno V4.5 Plus' },
  { value: 'V4_5ALL', label: 'Suno V4.5 All' },
  { value: 'V4_5', label: 'Suno V4.5' },
  { value: 'V4', label: 'Suno V4' },
] as const

export type SunoModelVersion = (typeof SUNO_MODEL_VERSIONS)[number]['value']

/** 최신 버전이 기본값이다. */
export const SUNO_DEFAULT_MODEL_VERSION: SunoModelVersion = 'V5_5'

/**
 * 화면이나 지난 기록에서 온 값을 문서가 받는 표기로 맞춘다.
 * 예전 기록에는 소문자 'v5' 가 들어 있다. 모르는 값이면 최신 기본값으로.
 */
export function normalizeSunoModelVersion(raw: unknown): SunoModelVersion {
  const value = String(raw ?? '').toUpperCase().replace(/[.\-\s]/g, '_')
  const hit = SUNO_MODEL_VERSIONS.find((v) => v.value === value)
  return hit ? hit.value : SUNO_DEFAULT_MODEL_VERSION
}

/** 문서는 'm' / 'f' 만 받는다. 화면은 Male/Female 로 고르기도 한다. */
export function normalizeVocalGender(raw: unknown): 'm' | 'f' | undefined {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value.startsWith('m')) return 'm'
  if (value.startsWith('f')) return 'f'
  return undefined
}

/** styleWeight · weirdnessConstraint · audioWeight 는 0~1 이다. */
export function clampSunoWeight(raw: unknown, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}
