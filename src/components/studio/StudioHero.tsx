'use client'

import type { ReactNode } from 'react'
import { withBase } from '@/lib/basePath'

interface StudioHeroProps {
  /** 제목 위 작은 알약 배지 — 아이콘 + 짧은 라벨 */
  badge: ReactNode
  /** 큰 제목. 강조 부분은 text-primary 를 입힌 <span> 으로 넘긴다 */
  title: ReactNode
  /** 회색 설명 한 줄 */
  desc?: ReactNode
  /**
   * 배경 사진 경로 — `public/` 기준의 절대 경로(예: `/studio/hero-console.webp`).
   * basePath(`/music`)는 이 컴포넌트가 withBase 로 붙인다. CSS background 라
   * next/image 처럼 자동으로 붙지 않기 때문이다.
   */
  bg?: string
  /** 우측 컨트롤 슬롯 — 그 화면의 주요 컨트롤을 그대로 넣는다 */
  children?: ReactNode
}

/**
 * 스튜디오 각 화면 상단의 히어로 띠.
 * 마스터링 화면에 있던 헤더 마크업을 그대로 뽑아 공용으로 만든 것이라
 * 마스터링의 보이는 결과는 배경 사진이 깔린 것 말고는 이전과 같다.
 *
 * 배경은 탭마다 다른 사진(`bg`)이고, 그 위에 왼쪽이 가장 어두운 가로 그라데이션을
 * 덮어 제목·설명이 사진에 묻히지 않게 한다. 사진이 없으면 globals.css 의
 * .cm-studio-hero-bg 무늬만으로 예전처럼 그린다.
 */
export function StudioHero({ badge, title, desc, bg, children }: StudioHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d0f12] via-[#14181f] to-[#0a0b0e] border border-white/10 p-6 lg:p-8 shadow-2xl">
      {bg && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${withBase(bg)}")` }}
            aria-hidden="true"
          />
          {/* 가독성 오버레이 — 제목이 앉는 왼쪽이 가장 어둡고 오른쪽으로 걷힌다 */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/35"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40"
            aria-hidden="true"
          />
        </>
      )}
      {/* CSS 무늬는 그대로 둔다 — 사진 위에서는 아주 약하게만 얹는다 */}
      <div className={bg ? 'cm-studio-hero-bg opacity-30' : 'cm-studio-hero-bg'} aria-hidden="true" />
      <div className="cm-studio-hero-glow" aria-hidden="true" />
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />

      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-black tracking-wider uppercase">
            {badge}
          </div>
          {/* 좁은 화면에서 제목이 줄바꿈되도록 flex-wrap — 640px 이상에서는 예전 크기 그대로 */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-x-3 gap-y-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
            {title}
          </h1>
          {desc && (
            <p className="text-xs lg:text-sm text-zinc-400 font-medium max-w-xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
              {desc}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}
