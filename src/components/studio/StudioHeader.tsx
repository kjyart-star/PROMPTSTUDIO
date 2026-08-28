'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { withBase } from '@/lib/basePath'
import { createClient } from '@/lib/supabase/client'
import { 
  Zap, ArrowLeft, 
  Sparkles, Music, Wand2, Image as ImageIcon, Volume2, 
  Layers, Check, User, LogIn, LogOut, Settings, CreditCard, HardDrive
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

  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false)
  const authDropdownRef = useRef<HTMLDivElement>(null)

  // 드롭다운 외부 클릭 시 닫기 — 스트리밍 헤더와 같은 동작
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setIsAuthMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 언어 변경 — 스트리밍 헤더와 같은 방식(localStorage + languageChange 이벤트)
  const handleLanguageChange = (lang: string) => {
    localStorage.setItem('language', lang)
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }))
  }

  const handleSignOut = async () => {
    setIsAuthMenuOpen(false)
    try {
      await fetch(withBase('/api/auth/signout'), { method: 'POST' })
      await createClient().auth.signOut()
    } catch (err) {
      console.error('SignOut error:', err)
    }
    window.location.href = withBase('/studio')
  }

  return (
    <header className="w-full h-14 bg-[#0b0b0b] border-b border-[#1b1b1b] flex items-center justify-between px-4 text-zinc-300 select-none z-50 shrink-0">
      {/* Left: Brand Name */}
      <div className="flex items-center gap-3">
        <Link
          href="/studio"
          className="text-base font-black text-white hover:text-primary tracking-wide transition-colors px-2 py-1 shrink-0 flex items-center gap-1.5"
        >
          {/* 스튜디오는 전용 캐릭터를 두지 않는다(대표 2026-08-29) — 글씨만 쓴다 */}
          <span><span className="cm-wordmark cm-wordmark-studio">COOKIEMUSIC</span> STUDIO</span>
        </Link>
      </div>

      {/* Right: Actions & User Info */}
      <div className="flex items-center gap-3">
        {/* Language Switcher — 스트리밍 헤더와 같은 EN/KO/JA */}
        <div className="flex items-center rounded-full border border-[#1f1f1f] bg-[#131313] p-0.5">
          <button
            onClick={() => handleLanguageChange('EN')}
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${uiLanguage === 'EN' ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            EN
          </button>
          <button
            onClick={() => handleLanguageChange('KO')}
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${uiLanguage === 'KO' ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            KO
          </button>
          <button
            onClick={() => handleLanguageChange('JA')}
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${uiLanguage === 'JA' ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            JA
          </button>
        </div>

        {/* Credits — 크레딧을 실제로 쓰는 곳은 스튜디오다. 클릭하면 충전으로 */}
        {user && (
          <Link
            href="/pricing"
            title={uiLanguage === 'KO' ? '크레딧 충전' : uiLanguage === 'JA' ? 'クレジットをチャージ' : 'Recharge Credits'}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#131313] hover:bg-[#1b1b1b] border border-[#1f1f1f] hover:border-primary/40 text-xs transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-zinc-400 font-medium">크레딧</span>
            <span className="font-mono font-black text-primary">{userCredits.toLocaleString()}P</span>
          </Link>
        )}

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
          <div className="relative" ref={authDropdownRef}>
            <button
              onClick={() => setIsAuthMenuOpen((open) => !open)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#2d2d2d] hover:border-primary/50 text-xs font-bold text-primary shadow-sm transition-all cursor-pointer"
              title={user.email}
            >
              {user.email?.[0]?.toUpperCase() || 'U'}
            </button>

            {isAuthMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[#232323] bg-[#111111] p-3 shadow-2xl shadow-black/60 z-[100]">
                <div className="border-b border-[#1e1e1e] pb-3 mb-2 px-2">
                  <p className="text-xs font-bold text-zinc-100 truncate" title={user.email}>{user.email}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/settings"
                    onClick={() => setIsAuthMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] rounded-xl transition-all cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    {uiLanguage === 'KO' ? '설정 및 관리' : uiLanguage === 'JA' ? '設定と管理' : 'Settings & Management'}
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setIsAuthMenuOpen(false)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] rounded-xl transition-all cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    {uiLanguage === 'KO' ? '크레딧 충전' : uiLanguage === 'JA' ? 'クレジットをチャージ' : 'Recharge Credits'}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] rounded-xl transition-all text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    {uiLanguage === 'KO' ? '로그아웃' : uiLanguage === 'JA' ? 'ログアウト' : 'Log Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
