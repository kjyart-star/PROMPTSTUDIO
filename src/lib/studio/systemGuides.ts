/**
 * 기본(공용) 지침서 — 관리자단에서 내려오는 지침서를 받아 오고, 사용자 지침서와 합친다.
 *
 * 클라이언트에서 쓰는 모듈이라 서버 전용 import 를 두지 않는다.
 */
import { withBase } from '@/lib/basePath'

/** localStorage 사본 키. 워커가 죽어 있을 때 하루까지 이걸 쓴다. */
export const SYSTEM_GUIDES_CACHE_KEY = 'songprompt-system-guides-v1'

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type SystemGuide = {
  id: string
  title: string
  body: string
  lang?: string
  tags?: string[]
  sortOrder?: number
  updatedAt?: string
}

function sortGuides(guides: SystemGuide[]): SystemGuide[] {
  return [...guides].sort((a, b) => {
    const sa = typeof a.sortOrder === 'number' ? a.sortOrder : 0
    const sb = typeof b.sortOrder === 'number' ? b.sortOrder : 0
    if (sa !== sb) return sa - sb
    return String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? ''))
  })
}

function readLocalCache(): SystemGuide[] | null {
  try {
    const raw = localStorage.getItem(SYSTEM_GUIDES_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.guides)) return null
    if (typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null
    return sortGuides(parsed.guides as SystemGuide[])
  } catch {
    return null
  }
}

function writeLocalCache(guides: SystemGuide[]) {
  try {
    localStorage.setItem(SYSTEM_GUIDES_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), guides }))
  } catch {
    // 저장 실패해도 이번 세션 동안은 받아 온 값을 그대로 쓴다
  }
}

/**
 * 기본 지침서를 받는다. 실패하면 하루 안에 저장해 둔 사본을 `stale` 로 돌려준다.
 */
export async function fetchSystemGuides(): Promise<{ guides: SystemGuide[]; stale: boolean }> {
  try {
    const res = await fetch(withBase('/api/studio/guides'), { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      if (json && !json.error && Array.isArray(json.guides)) {
        const guides = sortGuides(json.guides as SystemGuide[])
        writeLocalCache(guides)
        return { guides, stale: !!json.stale }
      }
    }
  } catch {
    // 아래 사본 경로로 떨어진다
  }

  const cached = readLocalCache()
  if (cached) return { guides: cached, stale: true }
  return { guides: [], stale: false }
}

/**
 * 기본 지침서 + 사용자 지침서를 하나의 텍스트로 합친다.
 *
 * 예산을 넘으면 **사용자 지침서를 뒤에서부터** 뺀다 — 관리자가 건 규정이 먼저다.
 */
export function composeGuideText(
  systemGuides: SystemGuide[],
  userGuides: { title: string; body: string }[],
  budget: number,
): { text: string; truncated: boolean } {
  const total = systemGuides.length + userGuides.length
  if (budget <= 0) return { text: '', truncated: total > 0 }

  const systemParts = sortGuides(systemGuides).map((g) => `## ${g.title}\n${g.body}`)
  const userParts = userGuides.map((g) => `## ${g.title}\n${g.body}`)

  for (let kept = userParts.length; kept >= 0; kept--) {
    const text = [...systemParts, ...userParts.slice(0, kept)].join('\n\n')
    if (text.length <= budget) return { text, truncated: kept < userParts.length }
  }

  // 기본 지침서만으로도 예산을 넘으면 하드 컷.
  return { text: systemParts.join('\n\n').slice(0, budget), truncated: true }
}
