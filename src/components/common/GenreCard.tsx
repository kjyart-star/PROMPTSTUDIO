'use client'

import Link from 'next/link'
import type { Genre } from '@/lib/constants'

interface GenreCardProps {
  genre: Genre
  uiLanguage: string
  /** 링크로 이동할 때 (메인 카테고리) */
  href?: string
  /** 직접 처리할 때 (둘러보기 검색) */
  onClick?: () => void
}

/** 「모두 둘러보기」와 메인 「인기 카테고리」가 함께 쓰는 장르 카드 한 벌. */
export function GenreCard({ genre, uiLanguage, href, onClick }: GenreCardProps) {
  // 좁은 칸(메인 캐러셀)에서도 같은 카드로 보이도록 컨테이너 폭에 맞춰 줄인다.
  // 140px 이상이면 「모두 둘러보기」와 완전히 같은 값이다.
  const cardClass = `@container relative block w-full aspect-[4/3] rounded-2xl ${genre.color} p-3 @[140px]:p-5 overflow-hidden group shadow-lg text-left hover:scale-[1.04] transition-all cursor-pointer`

  const body = (
    <>
      <div className="flex flex-col select-none">
        <span className="text-[11px] @[140px]:text-lg font-black tracking-tight text-white leading-tight">{genre.name}</span>
        <span className="text-[9px] @[140px]:text-xs font-bold text-white/80 mt-0.5">
          {uiLanguage === 'KO' ? genre.korean : uiLanguage === 'JA' ? genre.japanese : genre.name}
        </span>
      </div>
      <img
        src={genre.image}
        alt=""
        className="absolute -right-2 -bottom-2 w-[45%] aspect-square @[140px]:-right-4 @[140px]:-bottom-4 @[140px]:w-20 @[140px]:h-20 object-cover rounded-lg @[140px]:rounded-xl rotate-[25deg] shadow-2xl group-hover:scale-110 transition-transform duration-300"
      />
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {body}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={cardClass}>
      {body}
    </button>
  )
}
