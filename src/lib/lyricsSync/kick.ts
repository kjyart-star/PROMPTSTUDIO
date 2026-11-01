/**
 * Workers AI 무료 큐 깨우기(서버 전용) — 공개 대기에 들어간 곡·폰에서 만든 곡이 생기면 바로 부른다(응답 뒤 after() 로).
 * 워커가 겹침(50초)·하루 뉴런 상한을 스스로 지키므로 여러 번 불러도 안전하다. 주기 깨우기는 GitHub Actions(10분).
 */
export async function kickFreeQueue(): Promise<void> {
  const url = process.env.LRC_FREE_WORKER_URL
  const token = process.env.LRC_FREE_TOKEN
  if (!url || !token) return
  try {
    await fetch(url.replace(/\/+$/, '') + '/run', { method: 'POST', headers: { 'x-lrc-free-token': token }, signal: AbortSignal.timeout(55_000) })
  } catch { /* 다음 주기에 다시 깨운다 */ }
}
