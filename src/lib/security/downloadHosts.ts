/** /api/download 가 서버에서 대신 받아 와도 되는 호스트(감사 M-12). 우리 저장소·CDN 과 생성 공급자 CDN 만. */
const EXACT = new Set(['cookiemusic-cdn.kjyart.workers.dev', 'cdn.apipass.dev', 'tempfile.aiquickdraw.com'])
const SUFFIX = ['.supabase.co', '.suno.ai', '.cookieplay.app']

export const MAX_AUDIO_BYTES = 80 * 1024 * 1024
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function isAllowedDownloadHost(url: URL, r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE): boolean {
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (EXACT.has(host) || host === 'cookieplay.app') return true
  if (SUFFIX.some((s) => host.endsWith(s))) return true
  if (r2Base) {
    try { if (new URL(r2Base).hostname.toLowerCase() === host) return true } catch { /* 설정 오류는 무시 */ }
  }
  return false
}

/** 응답을 상한까지만 읽는다. 넘으면 null. */
export async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > maxBytes) return null
  if (!res.body) return Buffer.alloc(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel().catch(() => {}); return null }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
