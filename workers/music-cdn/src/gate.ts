/**
 * 공개 게이트(감사 M-7): 이 CDN 은 R2 키를 아는 누구에게나 음원을 내주던 구조였다.
 * 이제 GET 마다 앱(`/music/api/tracks/public-check`)에 「이 키가 공개 곡이고 주인이 정지되지 않았나」를 묻고,
 * 앱이 404 라고 하면 R2 도 Cache API 도 열지 않고 404 를 낸다. 파일은 지우거나 옮기지 않는다.
 *
 * 질문은 에지에서 잠깐 캐시한다(성공 60초 · 거절 5초 · 오류 0초) → 공개/비공개 전환이 최대 약 1분 안에 반영된다.
 * 앱이 죽었거나 시간 초과면(네트워크 오류·5xx) 재생을 끊지 않으려고 통과시킨다(fail-open). 명시적 404 만 거절한다.
 * 같은 파일이 workers/music-cdn/src/gate.ts 에도 있다(분리 배포라 카피).
 */
export const GATE_URL = 'https://cookieplay.app/music/api/tracks/public-check';
const GATE_TIMEOUT_MS = 1500;

export interface GateEnv {
  /** 테스트용 주입 */
  GATE_FETCH?: typeof fetch;
}

/** true = 내줘도 됨, false = 404 */
export async function isPublicKey(key: string, env: GateEnv): Promise<boolean> {
  const f = env.GATE_FETCH ?? fetch;
  try {
    const res = await f(`${GATE_URL}?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(GATE_TIMEOUT_MS),
      // Cloudflare 에지 캐시(테스트·로컬에서는 무시된다)
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 60, '404': 5, '500-599': 0 } },
    } as RequestInit);
    if (res.status === 404) return false;
    return true;
  } catch {
    return true;
  }
}
