// 빌드 전에 쿠키플레이의 최신 상단 메뉴 정의를 번들 기본값으로 복사한다.
// 받지 못하거나 모양이 다르면 저장소에 있는 사본을 그대로 쓴다(빌드는 절대 실패시키지 않는다).
import { writeFileSync } from 'node:fs'

const URL_ = 'https://cookieplay.app/suite-menu.json'
const OUT = new URL('../src/lib/suite/suite-menu.default.json', import.meta.url)

try {
  const res = await fetch(URL_, { signal: AbortSignal.timeout(5000) })
  const json = await res.json()
  if (!res.ok || !Array.isArray(json.floors) || !Array.isArray(json.services)) throw new Error('unexpected shape')
  writeFileSync(OUT, JSON.stringify(json, null, 2) + '\n')
  console.log('[suite-menu] 기본값을 최신 정의로 갱신')
} catch (e) {
  console.log('[suite-menu] 갱신 건너뜀, 저장소 사본 사용:', e.message)
}
