'use client'

import { BASE_PATH, suiteHref, withBase } from '@/lib/basePath'
import { SUITE_SERVICES, SUITE_STATUS_LABEL, suiteNavFloors } from '@/lib/suite/services'
import { SuiteCreditPill } from './SuiteCreditPill'
import { SuiteFloorMenu } from './SuiteFloorMenu'
import { SuiteNoticeBell } from './SuiteNoticeBell'
import { SuiteAccountBadge } from './SuiteAccountBadge'

/**
 * 쿠키플레이 스위트 공통 상단 바.
 *
 * 세 저장소(COOKIELAB · 쿠키뮤직 · IDFY)의 바가 한 곳에서 나온 것처럼 보여야 한다는
 * 대표 지시(2026-09-06: "상단메뉴 마지막 이미지처럼 공통으로 되어 있어야 함")에 맞춰
 * 층 표기 · 크레딧 알약 · 공지 종 · 원형 아바타까지 같은 자리에 둔다.
 *
 * 메뉴는 **층 하나가 한 칸**이다. 서비스가 둘 이상인 층(3F · 4F)은 접힌 메뉴
 * (`SuiteFloorMenu`)로, 하나뿐인 층은 지금처럼 바로 링크로 그린다 — 대표 지시
 * (2026-09-06: "4층은 AI작업실로 하고, 마우스 올리면 아래로 쿠키뮤직 스튜디오·쿠키드림
 * 이런 식으로 나오게 해줘", "3층은 3가지"). 아홉 칸이 여섯 칸이 되면서 메뉴가 한 줄에
 * 들어가고, 가운데 정렬이 가능해졌다.
 *
 * 메뉴 목록은 `@/lib/suite/services` 한 곳에서만 나온다 — 그 파일은 세 저장소에서
 * 글자 하나까지 같아야 하므로 주소(href)는 여기서 `id` 로 붙인다(저장소마다 basePath ·
 * 오리진이 다르다).
 *
 * 링크는 전부 **일반 `<a>`** 다. `next/link` 는 basePath(`/music`)를 자동으로 붙이지만
 * 여기 목적지는 쿠키플레이(오리진 루트)와 형제 서비스라 basePath 가 붙으면 안 된다.
 *
 * 쿠키플레이·형제 서비스는 `suiteHref` 를 거친다. 배포에서는 오리진이 비어 있어
 * 지금까지와 똑같은 오리진 절대경로가 되고, 로컬에서는 쿠키플레이 dev 오리진이
 * 앞에 붙는다. 쿠키뮤직·스튜디오는 **이 앱 자신**이라 오리진을 붙이지 않는다.
 *
 * 색은 리터럴 hex 다 — 기준 저장소의 CSS 토큰이 여기엔 없어서 다크 테마 값을 그대로 적었다.
 */

/** 서비스 id → 이 저장소에서의 주소. 목록·순서는 `services.ts` 가 정한다. */
const HREF_BY_ID: Record<string, string> = {
  /* 자리만 세운 서비스라 볼 화면이 없다 — 쿠키드림과 같이 소개 페이지로 보낸다 */
  cookiemovie: suiteHref('/cookiemovie'),
  cookiecut: suiteHref('/editor'),
  cookiepix: suiteHref('/cookiepix/app'),
  cookieillust: suiteHref('/cookieillust/app'),
  cookiemusicstudio: `${BASE_PATH}/studio`,
  /* 준비 중이라 만드는 화면이 없다 — 쿠키챗과 같이 소개 페이지로 보낸다 */
  cookiedream: suiteHref('/cookiedream'),
  cookiemusic: BASE_PATH,
  cookiechat: suiteHref('/cookiechat'),
  cookiephotostudio: suiteHref('/photo'),
}

const hrefOf = (id: string) => HREF_BY_ID[id]

/** COOKIELAB 제품 id 를 그대로 쓴다 — 공지(announcement)의 scope 값이 이 id 라 종이 그대로 걸러낸다. */
export type SuiteServiceId =
  | 'cookiemovie'
  | 'cookiecut'
  | 'cookiepix'
  | 'cookieillust'
  | 'cookiemusicstudio'
  | 'cookiedream'
  | 'cookiemusic'
  | 'cookiechat'
  | 'cookiephotostudio'

export function SuiteBar({ active }: { active?: SuiteServiceId }) {
  const current = SUITE_SERVICES.find((s) => s.id === active)

  return (
    /* 높이는 자식이 만든다(기준과 같음): 데스크톱 64px, 375px 에서는 메뉴가 아랫줄로
       접혀 워드마크 56 + 메뉴 44 = 100px 두 줄이 된다. shrink-0 은 이 바를 감싸는
       세로 flex 셸(스트리밍·스튜디오)에서 바가 눌리지 않게 하려고 남긴다.

       메뉴는 **가운데 정렬**이다(대표 지시 2026-09-06: "상단 메뉴 공통 메뉴는 중앙
       정렬로 해줘. 오른쪽 정렬하니 메뉴 위치가 계속 바뀜"). 오른쪽에 붙이면 옆에 오는
       상태 배지·계정 묶음의 폭이 화면마다 달라 메뉴가 그만큼 밀린다.

       DOM 은 [left 묶음][nav][right 묶음] 세 덩이다. 768 미만(폰)은 지금 그대로 둔다 —
       두 묶음이 `display: contents` 라 자식들이 헤더의 직접 자식(order-1…order-5)으로
       놓여 예전 배치가 그대로 산다. `md` 부터 묶음이 진짜 flex 컨테이너가 된다.

       한 줄로 돌아오는 분기점은 `min-[1360px]` 이다. 층을 접어 메뉴가 9칸에서 6칸이
       되면서 고유 폭이 928 → 약 640px 로 줄었다: 워드마크 212 + 메뉴 640 + 계정 묶음과
       상태 배지 365 + 좌우 패딩 80 + 간격 48 ≈ 1345px. 768~1359px 에서는 메뉴가 제 줄
       (order-5, w-full)로 내려가 그 줄 가운데에 놓인다.

       1360 이상에서 가운데를 **정확히** 맞추려고 좌우 묶음을 `flex-1 basis-0` 으로
       대칭으로 만든다. 좌우 내용의 폭이 달라도 남는 자리를 반씩 가져가므로 메뉴가
       화면 한가운데에 선다.

       nav 정렬은 `justify-center-safe` 다 — safe 가 핵심이다. 그냥 center 면 넘칠 때
       양쪽으로 잘리는데, LTR 에서 시작(왼쪽) 쪽 넘침은 스크롤 영역에 안 잡혀 그대로
       사라진다(대표 지시 2026-09-06: "여기서 만들기하고 들어가면 다른 메뉴로 못 가는
       문제 있음"). safe 를 붙이면 넘칠 때 시작 쪽으로 돌아가 `overflow-x-auto` 가 실제로
       동작한다 — 실패 모드가 「사라짐」이 아니라 「스크롤 가능」이 된다.
       접힌 메뉴 판은 포털이라 이 `overflow-x-auto` 에 잘리지 않는다. */
    <header className="sticky top-0 z-[70] flex shrink-0 flex-wrap items-center gap-x-3 border-b border-[#292929] bg-[#0d0d0d] px-5 md:gap-x-6 md:px-10 min-[1360px]:flex-nowrap">
      <div className="contents md:flex min-[768px]:shrink-0 md:items-center md:gap-x-6 min-[1360px]:flex-1 min-[1360px]:basis-0">
        <a
          href={suiteHref('/')}
          title="쿠키플레이 홈"
          className="order-1 flex h-14 shrink-0 items-center gap-2.5 md:h-16"
        >
          <img
            src={withBase('/images/cookie-mark.png')}
            alt=""
            aria-hidden
            className="size-8 shrink-0 rounded-full object-cover"
          />
          {/* 서비스 고유색은 워드마크에만 남긴다 — 바 자체는 공통이다 */}
          <span className="text-[28px] font-black leading-none tracking-normal">
            <span className="cm-wordmark">COOKIE</span>
            <span className="text-[#dedede]">PLAY</span>
          </span>
        </a>
      </div>

      <nav
        aria-label="서비스"
        /* 제 줄로 내려간 메뉴는 헤더 좌우 패딩까지 덮어야 가운데가 맞는다. `-mx-10` 만
           주고 `w-full` 로 두면 폭은 그대로인 채 왼쪽으로 40px 밀려 메뉴가 그만큼
           왼쪽에 선다 — 폭도 같이 키운다(패딩 40+40 = 5rem). */
        className="order-5 -mx-5 flex w-full min-w-0 items-center gap-1 overflow-x-auto scrollbar-none border-t border-[#292929] px-5 min-[768px]:-mx-10 min-[768px]:w-[calc(100%+5rem)] md:justify-center-safe md:gap-2 min-[768px]:px-10 min-[1360px]:order-none min-[1360px]:mx-0 min-[1360px]:w-auto min-[1360px]:border-t-0 min-[1360px]:px-0"
      >
        {suiteNavFloors().map((f) => {
          if (f.items.length > 1) {
            return (
              <SuiteFloorMenu
                key={f.short + f.name}
                short={f.short}
                name={f.name}
                items={f.items}
                activeId={active}
                hrefOf={hrefOf}
              />
            )
          }
          const s = f.items[0]
          const isActive = s.id === active
          return (
            <a
              key={f.short + f.name}
              href={hrefOf(s.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-[8px] px-3 text-[14px] transition-colors ${
                isActive ? 'font-semibold text-[#dedede]' : 'text-[#a1a1a1] hover:text-[#dedede]'
              }`}
            >
              {f.short && <span className="mr-1.5 text-[11px] text-[#a1a1a1]">{f.short}</span>}
              {f.name}
            </a>
          )
        })}
      </nav>

      <div className="contents min-[768px]:ml-auto md:flex min-[768px]:shrink-0 md:items-center md:gap-2 min-[1360px]:ml-0 min-[1360px]:flex-1 min-[1360px]:basis-0 min-[1360px]:justify-end">
        <div className="order-3 ml-auto flex shrink-0 items-center gap-1 md:order-4 md:ml-0 md:gap-2">
          <SuiteCreditPill />
          <SuiteNoticeBell activeId={active} />
          <SuiteAccountBadge />
        </div>

        {current && current.status !== 'stable' && (
          /* 아직 문을 열지 않은 서비스는 그 사실이 같이 보여야 한다.
             375px 에서는 계정 묶음에 자리를 내주고 감춘다(기준과 같음). */
          <div className="order-4 ml-auto flex shrink-0 items-center gap-2 md:order-5 md:ml-0">
            <span className="hidden shrink-0 rounded-[6px] border border-[#231249] px-1.5 py-0.5 text-[10px] leading-none text-[#a581f8] sm:inline-block">
              {SUITE_STATUS_LABEL[current.status]}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
