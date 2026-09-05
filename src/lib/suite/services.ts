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
  /** 층 짧은 표기('4F' · '3F' · '2F' · '1F' · 'B1') */
  floor: string
  status: SuiteStatus
}

/*
 * 층이 2026-09-06 에 두 번 바뀌었다 — 정본은 COOKIELAB `floors.ts` 다.
 *  ① 기획부터 다시 하는 것을 올려 둘 자리로 「작업실2」가 새로 생겼고(쿠키드림),
 *  ② 이어 대표가 **"3층을 4층으로 올리고 4층을 3층으로 올리자"** 고 해서 주 작업실이
 *     꼭대기(4F)로 가고 준비 중인 작업실2 가 그 아래(3F)로 내려왔다.
 * 그래서 쿠키컷 · 쿠키픽스 · 쿠키일러스트 · 쿠키뮤직 스튜디오가 3F 가 아니라 **4F** 다.
 *
 * 쿠키드림은 `preview`(「준비 중」)로 넣는다. 만드는 화면 진입은 COOKIELAB 에서 막아
 * 두었지만(`appPath: null` — 그 화면은 진짜 생성 API 를 불러 크레딧을 쓴다), 이 메뉴의
 * href 는 쿠키챗과 같이 **소개 페이지**로 가므로 갈 데가 없지 않다. 목록에서 빼면 3층이
 * 통째로 사라져 세 저장소의 상단 메뉴가 서로 달라진다 — 이 파일이 있는 이유가 그것이다
 * (대표 2026-09-06: "상단메뉴 마지막 이미지처럼 공통으로 되어 있어야 함").
 */
export const SUITE_SERVICES: SuiteService[] = [
  { id: 'cookiecut', name: '쿠키컷', floor: '4F', status: 'stable' },
  { id: 'cookiepix', name: '쿠키픽스', floor: '4F', status: 'stable' },
  { id: 'cookieillust', name: '쿠키일러스트', floor: '4F', status: 'beta' },
  { id: 'cookiemusicstudio', name: '쿠키뮤직 스튜디오', floor: '4F', status: 'beta' },
  { id: 'cookiedream', name: '쿠키드림', floor: '3F', status: 'preview' },
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
