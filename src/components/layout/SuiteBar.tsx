import { BASE_PATH, suiteHref, withBase } from '@/lib/basePath'

/**
 * 쿠키플레이 스위트 공통 상단 바 (대표 2026-08-29: "쿠키뮤직에서도 쿠키플레이로 바로 갈 수 있어야 함").
 *
 * 링크는 전부 **일반 `<a>`** 다. `next/link` 는 basePath(`/music`)를 자동으로 붙이지만
 * 여기 목적지는 허브(오리진 루트)와 형제 서비스라 basePath 가 붙으면 안 된다.
 * 일반 `<a href="/editor">` 는 브라우저가 오리진 기준으로 풀어서 허브 rewrite 가 받는다.
 *
 * 스튜디오만 예외로 basePath 를 붙인다 — 스튜디오는 뮤직 앱 안의 화면이라
 * 실제 주소가 `/music/studio` 다(그래도 오리진 기준 절대경로인 건 같다).
 *
 * 허브·형제 서비스는 `suiteHref` 를 거친다. 배포에서는 오리진이 비어 있어 지금까지와
 * 똑같은 오리진 절대경로가 되고, 로컬에서는 허브 dev 오리진이 앞에 붙는다.
 * 쿠키뮤직·스튜디오는 **이 앱 자신**이라 오리진을 붙이지 않는다.
 */

const SERVICES = [
  { key: 'cut', label: '쿠키컷', href: suiteHref('/editor') },
  { key: 'pix', label: '쿠키픽스', href: suiteHref('/cookiepix/app') },
  { key: 'illust', label: '쿠키일러스트', href: suiteHref('/cookieillust/app') },
  { key: 'music', label: '쿠키뮤직', href: BASE_PATH },
  { key: 'studio', label: '스튜디오', href: `${BASE_PATH}/studio` },
] as const

export type SuiteService = (typeof SERVICES)[number]['key']

export function SuiteBar({ active }: { active?: SuiteService }) {
  return (
    <div className="sticky top-0 z-[70] h-10 w-full shrink-0 bg-[#0d0d0d] border-b border-[#292929]">
      <div className="flex h-full items-center gap-3 pl-3 pr-2">
        {/* 허브 복귀 — 모바일에서도 절대 접히지 않게 shrink-0 */}
        <a
          href={suiteHref('/')}
          className="flex shrink-0 items-center gap-1.5 select-none"
          title="쿠키플레이 홈"
        >
          <img
            src={withBase('/images/cookie-mark.png')}
            alt=""
            aria-hidden="true"
            className="h-5 w-5 shrink-0 rounded-full object-cover"
          />
          <span className="text-[13px] font-black tracking-tight leading-none">
            <span className="cm-wordmark">COOKIE</span>
            <span className="text-white">PLAY</span>
          </span>
        </a>

        {/* 서비스 이동 — 바 오른쪽 끝. 좁은 폭에서는 가로 스크롤 레일(오른쪽 끝이 먼저 보이게) */}
        <nav className="ml-auto flex min-w-0 items-center justify-end gap-0.5 overflow-x-auto scrollbar-none">
          {SERVICES.map((s) => {
            const isActive = s.key === active
            return (
              <a
                key={s.key}
                href={s.href}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-bold leading-none transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/[0.05]'
                }`}
              >
                {s.label}
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
