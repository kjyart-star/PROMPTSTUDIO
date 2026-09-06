#!/usr/bin/env node
/**
 * 차감 단가가 화면과 어긋나지 않는지 본다. `npm run check:credits`
 *
 * 이 앱은 단가 **값**을 들고 있지 않는다 — 워커의 공개 단가 API 를 그대로 그린다
 * (`src/lib/credits/suite.ts`). 그래서 값이 갈라질 일은 없고, 남는 위험은 두 가지다:
 *
 *   ① **action id 가 바뀌거나 꺼진다.** 그러면 화면이 단가를 못 찾아 괄호가 사라지고,
 *      차감은 그대로 일어난다. 조용히 틀리는 자리라 여기서 잡는다.
 *   ② **워커 단가가 정수가 아니다.** 대표 지시 2026-09-07 — 크레딧은 소수로 가지 않는다.
 *      밀리크레딧이 1,000 의 배수여야 정수 크레딧이다.
 *
 * 정본: COOKIELAB `docs/credits-integer-nexus-2026-09.md`(2026-09-07) ·
 *       `docs/pricing-seed-2026-09.json` · 마이그레이션 `0031_integer_credits_nexus.sql`.
 *
 * 네트워크가 안 되면 **통과시킨다** — 빌드를 인터넷에 묶지 않는다.
 */
import { readFileSync } from 'node:fs'

const BASE = (process.env.NEXT_PUBLIC_COOKIEPLAY_API ?? 'https://cookieplay-admin-api.kjyart.workers.dev').replace(/\/+$/, '')
const SERVICE_ID = 'cookiemusic'
const MILLI_PER_CREDIT = 1000

/** suite.ts 의 CREDIT_ACTIONS 를 읽는다 — 목록을 여기 또 적으면 그것도 사본이다. */
function appActions() {
  const src = readFileSync(new URL('../src/lib/credits/suite.ts', import.meta.url), 'utf8')
  const block = src.match(/export const CREDIT_ACTIONS = \[([\s\S]*?)\] as const/)
  if (!block) throw new Error('suite.ts 에서 CREDIT_ACTIONS 를 찾지 못했습니다.')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const actions = appActions()

let body
try {
  const res = await fetch(`${BASE}/v1/public/prices?serviceId=${SERVICE_ID}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  body = await res.json()
} catch (e) {
  console.warn(`[check:credits] 단가 API 를 읽지 못해 건너뜁니다 (${e.message}). 빌드는 계속합니다.`)
  process.exit(0)
}

const server = new Map((body?.prices ?? []).map((p) => [p.action, p.creditsMilli]))
const problems = []

for (const action of actions) {
  if (!server.has(action)) {
    problems.push(`화면이 쓰는 action 이 워커 단가표에 없습니다(꺼졌거나 이름이 바뀜): ${action}`)
    continue
  }
  const milli = server.get(action)
  if (!Number.isInteger(milli) || milli % MILLI_PER_CREDIT !== 0) {
    problems.push(`정수 크레딧이 아닙니다: ${action} = ${milli} 밀리 (${milli / MILLI_PER_CREDIT} CR)`)
  }
}

for (const action of server.keys()) {
  if (!actions.includes(action)) {
    console.warn(`[check:credits] 워커에만 있는 action (화면이 아직 안 씀): ${action}`)
  }
}

console.log(
  `[check:credits] ${SERVICE_ID} — ` +
    actions.map((a) => `${a}=${server.has(a) ? server.get(a) / MILLI_PER_CREDIT : '없음'}`).join(' · '),
)

if (problems.length) {
  console.error(`\n[check:credits] 실패 ${problems.length}건`)
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}
console.log('[check:credits] 통과')
