'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Coins } from 'lucide-react'
import { suiteHref } from '@/lib/basePath'
import { formatCredits } from '@/lib/credits/format'
import { useSuiteCredits } from '@/lib/credits/useSuiteCredits'

/**
 * 뮤직에는 자체 요금제가 없다 — 가격·충전 화면은 쿠키플레이 `/pricing` 한 곳뿐이다
 * (대표 지시 2026-09-06). 예전 주소(`/music/pricing`)를 북마크했거나 옛 링크로 들어온
 * 사람이 빈 화면을 보지 않도록 얇은 안내만 남긴다.
 *
 * 잔액은 스위트 공용 지갑(워커 원장) 값 하나뿐이라 그대로 보여 준다. 플랜 이름은
 * 쓰지 않는다 — 뮤직이 쥐고 있던 「무료 플랜」류는 우리 요금제 체계와 다르다.
 */

interface PricingClientProps {
  user: any
}

/** 요금 안내는 이 앱이 아니라 쿠키플레이가 그리는 화면이다 — basePath 를 붙이지 않는다. */
const PRICING_HREF = suiteHref('/pricing')

export function PricingClient({ user }: PricingClientProps) {
  const router = useRouter()
  const [uiLanguage, setUiLanguage] = useState<string>('KO')
  const { balance: creditBalance } = useSuiteCredits(user)

  useEffect(() => {
    const savedLang = localStorage.getItem('uiLanguage')
    if (savedLang) setUiLanguage(savedLang)
  }, [])

  const t = (ko: string, ja: string, en: string) =>
    uiLanguage === 'KO' ? ko : uiLanguage === 'JA' ? ja : en

  return (
    <div className="min-h-screen bg-background text-white px-6 py-12 sm:px-12">
      <button
        onClick={() => router.back()}
        className="mb-12 flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> {t('뒤로 가기', '戻る', 'Back')}
      </button>

      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-3 text-2xl font-black tracking-tight md:text-3xl">
          {t('요금 안내는 쿠키플레이에서', '料金案内はクッキープレイで', 'Pricing lives on CookiePlay')}
        </h1>
        <p className="text-sm font-medium leading-relaxed text-zinc-400">
          {t(
            '요금제와 크레딧 충전은 쿠키플레이 한 곳에서 관리합니다. 크레딧은 쿠키뮤직을 포함한 모든 서비스에서 함께 씁니다.',
            'プランとクレジットのチャージはクッキープレイでまとめて管理します。クレジットは全サービス共通です。',
            'Plans and credit top-ups are handled on CookiePlay. Your credits are shared across every service.'
          )}
        </p>

        {user && (
          <div className="mt-10 flex items-center justify-center gap-2.5 rounded-2xl border border-zinc-800 bg-[#121214] px-5 py-4 shadow-lg">
            <Coins className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {t('현재 보유 크레딧', '利用可能なクレジット', 'Available credits')}
            </span>
            <span className="text-sm font-black text-white">
              {creditBalance === null ? '···' : formatCredits(creditBalance)}
            </span>
          </div>
        )}

        <a
          href={PRICING_HREF}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-black transition-all hover:bg-primary/90"
        >
          {t('쿠키플레이 요금 안내 열기', 'クッキープレイの料金案内へ', 'Open CookiePlay pricing')}
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
