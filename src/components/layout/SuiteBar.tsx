import { BASE_PATH, suiteHref, withBase } from '@/lib/basePath'
import { SUITE_SERVICES, SUITE_STATUS_LABEL, floorPrefix } from '@/lib/suite/services'
import { SuiteCreditPill } from './SuiteCreditPill'
import { SuiteNoticeBell } from './SuiteNoticeBell'
import { SuiteAccountBadge } from './SuiteAccountBadge'

/**
 * 쿠키플레이 스위트 공통 상단 바.
 *
 * 세 저장소(COOKIELAB · 쿠키뮤직 · IDFY)의 바가 한 곳에서 나온 것처럼 보여야 한다는
 * 대표 지시(2026-09-06: "상단메뉴 마지막 이미지처럼 공통으로 되어 있어야 함")에 맞춰
 * 층 표기 · 크레딧 알약 · 공지 종 · 원형 아바타까지 같은 자리에 둔다.
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
       세로 flex 셸(스트리밍·스튜디오)에서 바가 눌리지 않게 하려고 남긴다. */
    <header className="sticky top-0 z-[70] flex shrink-0 flex-wrap items-center gap-x-3 border-b border-[#292929] bg-[#0d0d0d] px-5 md:flex-nowrap md:gap-x-6 md:px-10">
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

      <nav
        aria-label="서비스"
        className="order-5 -mx-5 flex w-full min-w-0 items-center gap-1 overflow-x-auto scrollbar-none border-t border-[#292929] px-5 md:order-3 md:mx-0 md:w-auto md:flex-1 md:justify-end md:gap-2 md:border-t-0 md:px-0"
      >
        {SUITE_SERVICES.map((s, i) => {
          const isActive = s.id === active
          const floor = floorPrefix(i)
          return (
            <a
              key={s.id}
              href={HREF_BY_ID[s.id]}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-[8px] px-3 text-[14px] transition-colors ${
                isActive ? 'font-semibold text-[#dedede]' : 'text-[#a1a1a1] hover:text-[#dedede]'
              }`}
            >
              {floor && <span className="mr-1.5 text-[11px] text-[#a1a1a1]">{floor}</span>}
              {s.name}
            </a>
          )
        })}
      </nav>

      <div className="order-3 ml-auto flex shrink-0 items-center gap-1 md:order-4 md:gap-2">
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
    </header>
  )
}
