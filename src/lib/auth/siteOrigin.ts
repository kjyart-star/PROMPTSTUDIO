/**
 * 확인 메일·로그인 콜백이 돌아올 오리진. Host 헤더를 그대로 믿으면 메일 링크의 목적지를 공격자가 정할 수 있다(감사 M-10).
 * SITE_ORIGIN 환경변수가 있으면 그것을 쓰고, 없으면 허용 호스트 목록에 있는 요청 호스트만, 그 밖에는 운영 도메인으로 고정한다.
 */
const PROD_ORIGIN = 'https://cookieplay.app'
const ALLOWED_HOSTS = new Set(['cookieplay.app', 'www.cookieplay.app', 'music.cookieplay.app', 'suno-prompt-one.vercel.app'])
const DEV_HOSTS = new Set(['localhost', '127.0.0.1'])

export function siteOrigin(request: Request, env: { SITE_ORIGIN?: string; NODE_ENV?: string } = process.env as any): string {
  const fixed = env.SITE_ORIGIN
  if (fixed && /^https:\/\/[a-z0-9.-]+$/i.test(fixed)) return fixed.replace(/\/+$/, '')
  const raw = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const hostname = raw.split(':')[0].toLowerCase()
  if (ALLOWED_HOSTS.has(hostname)) return `https://${raw.toLowerCase()}`
  if (env.NODE_ENV !== 'production' && DEV_HOSTS.has(hostname)) return `http://${raw}`
  return PROD_ORIGIN
}

const COMMON = new Set(['password', 'password1', 'passw0rd', '1234567890', '12345678', '123456789', 'qwerty123', 'qwertyuiop', 'iloveyou1', 'abc1234567', '0123456789', '1q2w3e4r5t', 'asdfghjkl1'])

/** 비밀번호 최소 규칙: 10자 이상, 흔한 값·이메일 앞부분과 같은 값 금지. 통과하면 null, 아니면 사용자에게 보일 문구. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 10) return '비밀번호는 10자 이상이어야 합니다.'
  const lower = password.toLowerCase()
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return '너무 흔한 비밀번호예요. 다른 비밀번호를 써 주세요.'
  const local = email.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return '이메일 주소가 들어간 비밀번호는 쓸 수 없어요.'
  return null
}
