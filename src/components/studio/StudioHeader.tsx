'use client'

import Link from 'next/link'
import { withBase } from '@/lib/basePath'
import { 
  Zap, ArrowLeft, 
  Sparkles, Music, Wand2, Image as ImageIcon, Volume2, 
  Layers, Check, User, LogIn, HardDrive
} from 'lucide-react'

interface StudioHeaderProps {
  currentTab: string
  setCurrentTab: (tab: 'studio' | 'library' | 'cover' | 'suno' | 'mastering') => void
  uiLanguage: string
  userCredits?: number
  user?: any
  projectTitle?: string
  setProjectTitle?: (title: string) => void
}

export function StudioHeader({
  currentTab,
  setCurrentTab,
  uiLanguage,
  userCredits = 0,
  user = null,
  projectTitle = 'CookieMusic Studio Project',
  setProjectTitle
}: StudioHeaderProps) {
  // 참고 이미지와 100% 동일한 탭 순서: 음악 프롬프트 -> 음악 생성 -> 보관함 -> AI 커버 스튜디오 -> 마스터링
  const tabs = [
    { id: 'studio' as const, label: '음악 프롬프트', icon: Wand2 },
    { id: 'suno' as const, label: '음악 생성', icon: Music },
    { id: 'library' as const, label: '보관함', icon: HardDrive },
    { id: 'cover' as const, label: 'AI 커버 스튜디오', icon: ImageIcon },
    { id: 'mastering' as const, label: '마스터링', icon: Volume2 },
  ]

  return (
    <header className="w-full h-14 bg-[#0b0b0b] border-b border-[#1b1b1b] flex items-center justify-between px-4 text-zinc-300 select-none z-50 shrink-0">
      {/* Left: Brand Name */}
      <div className="flex items-center gap-3">
        <Link
          href="/studio"
          className="text-base font-black text-white hover:text-primary tracking-wide transition-colors px-2 py-1 shrink-0 flex items-center gap-1.5"
        >
          <img
            src={withBase('/images/cookiemusic-mark.png')}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
          <span><span className="cm-wordmark">COOKIEMUSIC</span> STUDIO</span>
        </Link>
      </div>

      {/* Right: Actions & User Info */}
      <div className="flex items-center gap-3">
        {/* Credits */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131313] border border-[#1f1f1f] text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-zinc-400 font-medium">크레딧</span>
          <span className="font-mono font-black text-primary">{userCredits.toLocaleString()}P</span>
        </div>

        {/* User profile / Login */}
        {!user ? (
          <Link
            href="/login?next=/studio"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1e1e1e] border border-[#262626] text-xs font-bold text-zinc-200 hover:text-primary transition-all"
          >
            <LogIn className="w-3.5 h-3.5 text-primary" />
            <span>로그인</span>
          </Link>
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#2d2d2d] text-xs font-bold text-primary shadow-sm" title={user.email}>
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
      </div>
    </header>
  )
}
