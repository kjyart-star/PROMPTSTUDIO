'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { suiteHref, withBase } from '@/lib/basePath'

/**
 * 스위트 공통 크레딧 알약 — 상단 바의 크레딧 자리는 하나다(대표 지시 2026-09-06).
 *
 * 지갑은 스위트 하나뿐이라 어느 서비스에 있든 같은 값이다. 잔액이 있으면 동전 +
 * 축약한 숫자를, **없거나 못 읽으면**(비로그인 포함) 같은 알약이 「크레딧 충전」이
 * 된다. 충전 버튼을 따로 두지 않는 이유다.
 *
 * 색·모양은 쿠키플레이 기준 바(COOKIELAB `SuiteShell` 의 CREDIT_PILL)와 같다.
 * 이 저장소에는 그쪽 CSS 토큰이 없어서 다크 테마 값을 리터럴로 적는다.
 */

/** 바는 좁다 — 3.7k 처럼 줄여 쓰고, 정확한 값은 툴팁·계정 화면에서 본다. */
function compactCredits(n: number): string {
  if (n < 10_000) return n.toLocaleString('ko-KR')
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k < 100 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const m = n / 1_000_000
  return `${m < 100 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`
}

/** 알약은 상태가 바뀌어도 같은 모양이다 — 자리가 하나라 흔들릴 곳이 없다 */
const CREDIT_PILL =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#231249] bg-[#1b0e39] px-2.5 text-[13px] text-[#a581f8] transition-colors hover:text-[#dedede]'

/**
 * 누르면 언제나 요금 안내로 간다. `suiteHref` 를 거치는 이유: 배포에서는
 * `SUITE_ORIGIN` 이 비어 있어 오리진 절대경로 `/pricing`(= cookieplay.app/pricing)이
 * 되고, 로컬에서는 쿠키플레이 dev 오리진이 앞에 붙는다. 요금 안내는 이 앱이 아니라
 * 쿠키플레이가 그리는 화면이라 basePath(`/music`)를 붙이면 안 된다.
 */
const PRICING_HREF = suiteHref('/pricing')

const BALANCE_EVENT = 'suite-credits-changed'

export function SuiteCreditPill() {
  /** null = 잔액 없음·못 읽음(비로그인 포함) */
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    /* 실패·401 은 조용히 null 로 떨어뜨린다 — 잔액을 못 읽었다고 바가 깨질 이유는 없다 */
    const load = async () => {
      /* 세션이 없으면 답이 정해져 있다 — 물어보면 401 이 콘솔에 쌓일 뿐이다.
         토큰 해석은 하지 않는다: 여기서 필요한 것은 "물어볼 가치가 있나"뿐이다. */
      if (!/(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.\d+)?=/.test(document.cookie)) {
        if (alive) setBalance(null)
        return
      }
      try {
        const res = await fetch(withBase('/api/credits/me'), { cache: 'no-store' })
        if (!res.ok) {
          if (alive) setBalance(null)
          return
        }
        const data = await res.json()
        if (alive) setBalance(typeof data?.balance === 'number' ? data.balance : null)
      } catch {
        if (alive) setBalance(null)
      }
    }
    void load()

    /* 스튜디오에서 크레딧을 쓰면 `useSuiteCredits` 가 이 이벤트를 쏜다 —
       바의 숫자도 그 자리에서 바뀐다. 다른 탭에서 충전하고 돌아왔을 때는 focus 로 맞춘다. */
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail
      if (typeof detail === 'number') setBalance(detail)
    }
    window.addEventListener(BALANCE_EVENT, onChanged)
    window.addEventListener('focus', load)
    return () => {
      alive = false
      window.removeEventListener(BALANCE_EVENT, onChanged)
      window.removeEventListener('focus', load)
    }
  }, [])

  if (balance === null || balance <= 0) {
    return (
      <a href={PRICING_HREF} title="크레딧 충전" aria-label="크레딧 충전" className={CREDIT_PILL}>
        <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {/* 폰에서는 바가 좁다 — 그때는 「충전」만 남긴다 */}
        <span className="whitespace-nowrap">
          <span className="hidden sm:inline">크레딧 </span>충전
        </span>
      </a>
    )
  }

  const label = `내 크레딧 ${balance.toLocaleString('ko-KR')} — 충전하기`
  return (
    <a href={PRICING_HREF} title={label} aria-label={label} className={CREDIT_PILL}>
      <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">{compactCredits(balance)}</span>
    </a>
  )
}
