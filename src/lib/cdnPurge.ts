// 비공개 전환·정지된 곡의 CDN 캐시 퍼지(파일 삭제 아님). 자격(CF_API_TOKEN·CF_ZONE_ID·CDN_PURGE_BASE)이 없으면 조용히 건너뛴다.
// 지금 음원 CDN(workers.dev·pages.dev)은 zone 이 없고, 공개 게이트가 캐시보다 앞에서 막으므로 퍼지가 없어도 새지 않는다.
// 음원을 커스텀 도메인(zone)으로 앞단에 둘 때를 위한 훅이다.
export async function purgeTrackCache(keys: string[], env: Record<string, string | undefined> = process.env): Promise<'skipped' | 'ok' | 'failed'> {
  const token = env.CF_API_TOKEN, zone = env.CF_ZONE_ID, base = env.CDN_PURGE_BASE
  const files = keys.filter((k) => k && !k.includes('..') && !/^https?:\/\//i.test(k))
  if (!token || !zone || !base || files.length === 0) return 'skipped'
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files: files.slice(0, 30).map((k) => `${base.replace(/\/+$/, '')}/${k.split('/').map(encodeURIComponent).join('/')}`) }),
    })
    return res.ok ? 'ok' : 'failed'
  } catch {
    return 'failed'
  }
}
