/**
 * 쿠키플레이 스위트 상단 메뉴 목록 — 층 · 순서 · 이름 · 상태.
 *
 * **이 파일은 사본이다. 정본은 COOKIELAB 저장소의
 * `src/lib/products.ts`(PRODUCTS 의 name · status) 와
 * `src/lib/floors.ts`(FLOOR_DEFS — 층 정의) 다.** 서비스가 늘거나 층이 바뀌면 정본을
 * 먼저 고치고 이 파일을 같은 값으로 맞춘다. 세 저장소(COOKIELAB · suno-prompt · IDFY)의
 * 상단 메뉴가 한 곳에서 나온 것처럼 보여야 한다는 대표 지시(2026-09-06: "상단메뉴
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
  /**
   * 라틴 워드마크. 메뉴 행 머리의 약자 칸이 여기서 파생된다('CookieMusic Studio' → 'CMS').
   * 제품마다 아이콘 세트를 따로 만들지 않으려고 이름에서 뽑아 쓴다 — 서비스가 늘어도
   * 여기 한 줄이면 행 머리가 채워진다.
   */
  latin: string
  /** 메뉴 행의 한 줄 설명. COOKIELAB `products.ts` 의 `Product.role` 과 같은 값. */
  role: string
  status: SuiteStatus
}

/*
 * **층·순서는 아래 `SUITE_FLOORS` 가 정한다.** 이 배열은 서비스의 이름 · 상태만 들고
 * 있고, 어느 층에 몇 번째로 놓일지는 `suiteNavFloors()` 가 층 정의에서 읽는다. 같은
 * 값을 두 곳에 두면 반드시 갈라지므로 층은 한 곳에만 적는다(대표 2026-09-06: "메뉴
 * 순서도 모두 교체 되어야함" — 3층과 4층을 맞바꾼 뒤에도 메뉴가 옛 순서인 채였다).
 *
 * `latin` · `role` 은 접힌 층 메뉴의 행을 그리는 데 쓴다 — 약자 칸(latin 에서 파생)과
 * 이름 아래 한 줄 설명(role). 쿠키포토 「서비스」 메가메뉴의 결을 따르라는 대표 지시
 * (2026-09-06: "포토 참고.")에 맞춘 것이고, 값은 정본 `products.ts` 와 같아야 한다.
 *
 * 쿠키드림은 4F 에 `preview`(「준비 중」)로 있다 — 아직 기획 단계라 자리만 두고 기획을
 * 다시 하는 중이다. 만드는 화면 진입은 COOKIELAB 에서 막아 두었지만(`appPath: null` —
 * 그 화면은 진짜 생성 API 를 불러 크레딧을 쓴다), 이 메뉴의 href 는 쿠키챗과 같이
 * **소개 페이지**로 가므로 갈 데가 없지 않다. 목록에서 빼면 세 저장소의 상단 메뉴가
 * 서로 달라진다 — 이 파일이 있는 이유가 그것이다(대표 2026-09-06: "상단메뉴 마지막
 * 이미지처럼 공통으로 되어 있어야 함").
 *
 * 쿠키영화관(5F)도 같은 이유로 목록에 둔다 — 아직 **자리뿐**이고(대표 2026-09-06
 * "아니 영화로 넣어", "큰 의미는 지금 없음"), 이름은 처음 「쿠키TV」였다가 대표
 * 지시로 「쿠키무비」가 됐다가("TV보다는 무비가 좋을 듯") 같은 날 한글 이름만 다시
 * 「쿠키영화관」으로 바뀌었다("쿠키무비를 쿠키영화관으로. 한글은 이렇게 수정" — 라틴
 * 워드마크 · id · 경로는 그대로). **숏드라마는 나중에 TV를
 * 따로 하므로 여기에 끼워 넣지 않는다.** 준비 중인 서비스를 저장소마다 넣었다
 * 뺐다 하면 메뉴가 갈라지니 소개 페이지로 보내고 「준비 중」 배지가 상태를 말한다.
 */
export const SUITE_SERVICES: SuiteService[] = [
  { id: 'cookiemovie', name: '쿠키영화관', latin: 'CookieMovie', role: 'AI 영화', status: 'preview' },
  {
    id: 'cookiemusicstudio',
    name: '쿠키뮤직 스튜디오',
    latin: 'CookieMusic Studio',
    role: 'AI 음악 제작',
    status: 'beta',
  },
  { id: 'cookiedream', name: '쿠키드림', latin: 'CookieDream', role: 'AI 이미지 생성', status: 'preview' },
  { id: 'cookiecut', name: '쿠키컷', latin: 'CookieCut', role: '영상 편집', status: 'stable' },
  { id: 'cookiepix', name: '쿠키픽스', latin: 'CookiePix', role: '이미지 편집', status: 'stable' },
  { id: 'cookieillust', name: '쿠키일러스트', latin: 'CookieIllust', role: '벡터 드로잉', status: 'beta' },
  { id: 'cookiemusic', name: '쿠키뮤직', latin: 'CookieMusic', role: 'AI 음악', status: 'beta' },
  { id: 'cookiechat', name: '쿠키챗', latin: 'CookieChat', role: 'AI 캐릭터 대화', status: 'preview' },
  {
    id: 'cookiephotostudio',
    name: '쿠키포토스튜디오',
    latin: 'CookiePhoto Studio',
    role: 'AI 헤드샷 · 프로필 세트',
    status: 'beta',
  },
]

/** 정본 COOKIELAB `floors.ts` 의 `FloorDef` 와 같은 모양. */
export interface SuiteFloor {
  /** 화면에 보일 묶음 표기, 예: 'B1 · 포토 스튜디오' */
  label: string
  /** SUITE_SERVICES 의 id 참조. 1개 또는 여러 개(3층은 3개). */
  productIds: string[]
}

/**
 * 쿠키플레이타운 — 서비스를 "건물" 컨셉으로 묶는 층 정의.
 * 낮은 층 → 높은 층 순서로 적는다(지하가 먼저) — 실제 건물 순서를 그대로
 * 따라야 나중에 층을 추가할 때 "몇 번째에 끼워 넣어야 하지" 고민 없이 맨 뒤에
 * 한 줄만 붙이면 된다. 화면에는 이 순서를 뒤집어(`suiteNavFloors()`) 고층이
 * 왼쪽에 오게 보여준다.
 *
 * **정본은 COOKIELAB `src/lib/floors.ts` 의 `FLOOR_DEFS` 다** — 여섯 줄과 주석을
 * 그대로 옮겨 적은 것이다. 정본을 고치면 이 파일도 같이 맞춘다.
 */
export const SUITE_FLOORS: SuiteFloor[] = [
  { label: 'B1 · 포토 스튜디오', productIds: ['cookiephotostudio'] },
  { label: '1F · 쿠키챗', productIds: ['cookiechat'] },
  { label: '2F · 쿠키뮤직', productIds: ['cookiemusic'] },
  /*
   * 3층은 **손으로 고치는 도구**, 4층은 **AI 로 만드는 도구**로 나눈다
   * (대표 2026-09-06: "3층을 작업실로 3개 넣고 지금 3층 뮤직스튜디오를 4층으로
   * AI작업실로 넣으면 좋을듯. 4층에 2개 들어가는 거임").
   * 쿠키드림은 아직 기획 단계라 4층에 자리만 두고 기획을 다시 한다.
   */
  { label: '3F · 작업실', productIds: ['cookiecut', 'cookiepix', 'cookieillust'] },
  { label: '4F · AI작업실', productIds: ['cookiemusicstudio', 'cookiedream'] },
  /*
   * 5층은 만든 영상이 가서 머무는 자리다. 처음엔 「쿠키TV」로 넣었다가 바로
   * 「쿠키무비」로 바꿨다(대표 지시 2026-09-06: "TV보다는 무비가 좋을 듯" /
   * "아니 영화로 넣어"). 숏드라마를 이 층에 끼워 넣지 마라 — 그건 나중에 TV 를
   * 따로 만드는 쪽이다("숏드라마는 나중에 TV를 따로 하는 게 좋을 듯").
   * 같은 날 한글 이름만 다시 「쿠키영화관」으로 바꿨다(대표 지시 2026-09-06: "쿠키무비를
   * 쿠키영화관으로. 한글은 이렇게 수정") — 라틴 워드마크 `CookieMovie` · id · 경로는 그대로다.
   * 지금은 **자리뿐**이라 쿠키영화관은 `preview` 이고 진입 경로가 없다. 방향은 문을
   * 열 때 정해지므로("나중에 활성화되면 구체적으로 방향이 나올 것임") 문구를
   * 부풀리지 않는다. 2층 · 1층처럼 층 이름이 곧 서비스 이름이다.
   */
  { label: '5F · 쿠키영화관', productIds: ['cookiemovie'] },
]

/** 상단 메뉴 한 칸 = 층 하나. items 가 둘 이상이면 접힌 메뉴, 하나면 바로 링크. */
export interface SuiteNavFloor {
  /** '4F' — label 앞부분 */
  short: string
  /** 'AI작업실' — label 뒷부분. 층에 없는 서비스는 제 이름 */
  name: string
  items: SuiteService[]
}

/**
 * 상단 메뉴가 그릴 층 목록 — 층 순서 그대로(고층이 왼쪽). `label` 을 ' · ' 로 나눠
 * short/name 을 얻는다. 층에 없는 서비스는 빠뜨리지 않고 제 이름을 층 이름 삼아 뒤에
 * 붙인다 — 아홉 서비스 중 하나라도 메뉴에서 사라지면 그 서비스로 갈 길이 없어진다.
 *
 * 메뉴가 아홉 칸에서 여섯 칸으로 줄고 층이 접힌 이유는 대표 지시다(2026-09-06:
 * "4층은 AI작업실로 하고, 마우스 올리면 아래로 쿠키뮤직 스튜디오·쿠키드림 이런 식으로
 * 나오게 해줘", "3층은 3가지"). 아홉 칸이면 1600px 아래에서 계속 넘쳐 메뉴 위치가
 * 흔들렸다("오른쪽 정렬하니 메뉴 위치가 계속 바뀜").
 */
export const suiteNavFloors = (): SuiteNavFloor[] => {
  const floors = [...SUITE_FLOORS]
    .reverse()
    .map((f) => {
      const [short, name] = f.label.split(' · ')
      return {
        short,
        name,
        items: f.productIds
          .map((id) => SUITE_SERVICES.find((s) => s.id === id))
          .filter((s): s is SuiteService => Boolean(s)),
      }
    })
    /* 한 서비스도 못 찾은 층은 그릴 것이 없다 — 빈 칸을 만들지 않는다. */
    .filter((f) => f.items.length > 0)
  const seen = new Set(floors.flatMap((f) => f.items.map((s) => s.id)))
  return [
    ...floors,
    ...SUITE_SERVICES.filter((s) => !seen.has(s.id)).map((s) => ({
      short: '',
      name: s.name,
      items: [s],
    })),
  ]
}

/**
 * 서비스 id → 층 짧은 표기('3F', '2F', 'B1'). `label` 이 'B1 · 포토 스튜디오'처럼
 * "짧은 표기 · 이름" 형식이라 따로 저장하지 않고 `label` 에서 뽑아 쓴다 — 값이
 * 둘로 갈라져 있으면 나중에 하나만 고치는 실수가 생기기 쉽다.
 */
export const suiteFloorShort = (id: string): string | undefined => {
  const floor = SUITE_FLOORS.find((f) => f.productIds.includes(id))
  return floor?.label.split(' · ')[0]
}
