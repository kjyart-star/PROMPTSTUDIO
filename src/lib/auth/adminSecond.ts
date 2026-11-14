import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

/**
 * 관리자 2차 인증을 서버가 집행한다(감사 M-9).
 * /api/admin/verify 가 비밀번호를 확인하면 이 서명 쿠키를 내려 주고, 관리 API 는 쿠키가 유효한지 본다.
 * 서명 키는 ADMIN_SECONDARY_PASSWORD(서버 전용)에서 파생한다 — 별도 환경변수가 필요 없다.
 */
export const ADMIN2_COOKIE = 'cm_admin2'
export const ADMIN2_TTL_SEC = 8 * 60 * 60

const keyOf = (secret: string) => createHash('sha256').update('cm-admin2-v1:' + secret).digest()

export function signAdminToken(userId: string, secret: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + ADMIN2_TTL_SEC
  const body = `${userId}.${exp}`
  const sig = createHmac('sha256', keyOf(secret)).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyAdminToken(token: string | undefined | null, userId: string, secret: string | undefined, nowMs = Date.now()): boolean {
  if (!token || !secret) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const body = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = createHmac('sha256', keyOf(secret)).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const j = body.lastIndexOf('.')
  if (body.slice(0, j) !== userId) return false
  const exp = Number(body.slice(j + 1))
  return Number.isFinite(exp) && exp * 1000 > nowMs
}

/** 고정 길이 해시로 바꿔 길이 차이로 새지 않게 비교한다. */
export function safeEqualStr(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** 요청의 쿠키로 2차 인증을 마쳤는지. 서버 라우트에서 관리자 판정 뒤에 함께 요구한다. */
export async function hasAdminSecondFactor(userId: string): Promise<boolean> {
  const { cookies } = await import('next/headers')
  const jar = await cookies()
  return verifyAdminToken(jar.get(ADMIN2_COOKIE)?.value, userId, process.env.ADMIN_SECONDARY_PASSWORD)
}
