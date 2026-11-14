/**
 * 계정 탈퇴 순서(감사 L-10, 대표 확정 2026-11-14).
 *   ① 워커 /v1/me/account/delete 를 done:true 가 될 때까지(개인정보 익명화·원장 보존·개인 콘텐츠 삭제, 30일 유예 기록)
 *   ② Supabase profiles 익명화(공개 곡 작성자 표시는 「탈퇴한 사용자」)
 *   ③ 로그인 계정 정지(ban) — 삭제하지 않는다. 30일 안에 철회하면 풀 수 있게.
 * 앞 단계는 멱등이라 중간에 실패하면 같은 요청을 다시 보내면 이어진다. 실패한 단계 뒤로는 건드리지 않는다.
 */
export const CONFIRM_PHRASE = '계정 삭제'
export const MAX_WORKER_ROUNDS = 12
export const GRACE_DAYS = 30
/** 100년 — 사실상 영구 정지지만 해제(철회)할 수 있다 */
export const BAN_DURATION = '876000h'
export const DELETED_NAME = '탈퇴한 사용자'

export type WorkerResult = { ok: true; done: boolean } | { ok: false; status: number }

export interface WithdrawDeps {
  callWorker: () => Promise<WorkerResult>
  anonymizeProfile: () => Promise<boolean>
  disableAuth: () => Promise<boolean>
}

export type WithdrawOutcome =
  | { ok: true }
  | { ok: false; step: 'worker' | 'profile' | 'auth'; status: number; retryable: boolean; message: string }

export async function runWithdrawal(deps: WithdrawDeps, maxRounds = MAX_WORKER_ROUNDS): Promise<WithdrawOutcome> {
  let done = false
  for (let i = 0; i < maxRounds && !done; i++) {
    const r = await deps.callWorker()
    if (!r.ok) {
      if (r.status === 409) {
        return { ok: false, step: 'worker', status: 409, retryable: false, message: '관리자 계정은 먼저 관리자 권한을 해제한 뒤에 삭제할 수 있어요.' }
      }
      return { ok: false, step: 'worker', status: 502, retryable: true, message: '탈퇴를 마무리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
    }
    done = r.done
  }
  if (!done) return { ok: false, step: 'worker', status: 502, retryable: true, message: '정리할 내용이 많아 아직 끝나지 않았어요. 다시 한 번 눌러 주세요.' }
  if (!(await deps.anonymizeProfile())) {
    return { ok: false, step: 'profile', status: 502, retryable: true, message: '프로필을 정리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
  if (!(await deps.disableAuth())) {
    return { ok: false, step: 'auth', status: 502, retryable: true, message: '계정을 닫지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
  return { ok: true }
}

/** Origin 이 있으면 우리 사이트(운영 도메인·서브도메인, 개발 중 localhost)여야 한다. 없으면(서버끼리) 통과 — 로그인 세션이 따로 필요하다. */
export function originAllowed(origin: string | null, nodeEnv = process.env.NODE_ENV): boolean {
  if (!origin) return true
  let o: URL
  try { o = new URL(origin) } catch { return false }
  const h = o.hostname.toLowerCase()
  if (o.protocol === 'https:' && (h === 'cookieplay.app' || h.endsWith('.cookieplay.app'))) return true
  return nodeEnv !== 'production' && (h === 'localhost' || h === '127.0.0.1')
}

/** profiles 익명화 값. 같은 사용자는 늘 같은 값이라 재호출해도 같고 handle 고유성도 유지된다. */
export function anonymizedProfile(shortId: string) {
  return {
    email: `deleted-${shortId}@deleted.invalid`,
    display_name: DELETED_NAME,
    avatar_url: null,
    banner_url: null,
    bio: null,
    tags: [] as string[],
    handle: `deleted-${shortId}`,
  }
}
