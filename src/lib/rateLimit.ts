/**
 * 인스턴스 메모리 속도 제한(최선 노력). 서버리스라 인스턴스가 여러 개면 한도가 인스턴스별로 따로 센다 —
 * 연타·단순 도배를 막는 용도이고, 강한 보장이 필요하면 DB/Edge 규칙으로 올려야 한다.
 */
const buckets = new Map<string, { count: number; reset: number }>()

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k)
    if (buckets.size > 5000) buckets.clear()
  }
  const b = buckets.get(key)
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  b.count += 1
  return b.count <= limit
}

/** 실패만 세는 용도: 지금 막혀 있는가(세지 않음). */
export function isBlocked(key: string, limit: number, now = Date.now()): boolean {
  const b = buckets.get(key)
  return !!b && b.reset > now && b.count >= limit
}

export function resetBuckets() { buckets.clear() }
