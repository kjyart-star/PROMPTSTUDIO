/**
 * 쿠키플레이 스위트 상단 메뉴 목록 — 순서 · 이름 · 층 표기 · 상태.
 *
 * **이 파일은 사본이다. 정본은 COOKIELAB 저장소의
 * `src/lib/products.ts`(PRODUCTS 의 순서 · name · status) 와
 * `src/lib/floors.ts`(층 표기) 다.** 서비스가 늘거나 층이 바뀌면 정본을 먼저 고치고
 * 이 파일을 같은 값으로 맞춘다. 세 저장소(COOKIELAB · suno-prompt · IDFY)의 상단
 * 메뉴가 한 곳에서 나온 것처럼 보여야 한다는 대표 지시(2026-09-06: "상단메뉴
 * 마지막 이미지처럼 공통으로 되어 있어야 함")에 대한 답이다.
 *
 * 주소(href)는 여기 두지 않는다 — 저장소마다 basePath · 오리진이 달라서 각 앱의
 * SuiteBar 가 `id` 로 붙인다. 그래야 이 파일이 세 저장소에서 글자 하나까지 같다.
 */

export type SuiteStatus = 'stable' | 'beta' | 'preview'

/** COOKIELAB `products.ts` 의 STATUS_LABEL 과 같은 값 */
export const SUITE_STATUS_LABEL: Record<SuiteStatus, string> = {
  stable: '정식',
  beta: '베타',
  preview: '준비 중',
}

export interface SuiteService {
  /** COOKIELAB `products.ts` 의 Product.id. 공지(announcement) 의 scope 도 이 id 를 쓴다. */
  id: string
  name: string
  /** 층 짧은 표기('3F' · '2F' · '1F' · 'B1') */
  floor: string
  status: SuiteStatus
}

export const SUITE_SERVICES: SuiteService[] = [
  { id: 'cookiecut', name: '쿠키컷', floor: '3F', status: 'stable' },
  { id: 'cookiepix', name: '쿠키픽스', floor: '3F', status: 'stable' },
  { id: 'cookieillust', name: '쿠키일러스트', floor: '3F', status: 'beta' },
  { id: 'cookiemusicstudio', name: '쿠키뮤직 스튜디오', floor: '3F', status: 'beta' },
  { id: 'cookiemusic', name: '쿠키뮤직', floor: '2F', status: 'beta' },
  { id: 'cookiechat', name: '쿠키챗', floor: '1F', status: 'preview' },
  { id: 'cookiephotostudio', name: '쿠키포토스튜디오', floor: 'B1', status: 'beta' },
]

/**
 * 앞 항목과 층이 같으면 undefined — 같은 층이 이어질 때 "3F" 가 줄줄이 찍히면 오히려
 * 산만하다(COOKIELAB `SuiteShell` 과 같은 규칙).
 */
export function floorPrefix(index: number): string | undefined {
  const cur = SUITE_SERVICES[index]
  const prev = index > 0 ? SUITE_SERVICES[index - 1] : undefined
  return prev && prev.floor === cur.floor ? undefined : cur.floor
}
