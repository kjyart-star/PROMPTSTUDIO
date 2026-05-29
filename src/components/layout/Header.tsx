'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, Shield, LogOut, Trash2, Globe, Settings, ChevronDown, Check } from 'lucide-react'

interface HeaderProps {
  user: any
  isAdmin: boolean
  initialAnnouncements: any[]
}

export default function Header({ user, isAdmin, initialAnnouncements }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // UI 상태
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false)
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [hasUnread, setHasUnread] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const authDropdownRef = useRef<HTMLDivElement>(null)

  // 활성화된 탭 판별
  const getActiveTab = () => {
    if (pathname === '/studio') return 'studio'
    if (pathname.startsWith('/admin')) return 'admin'
    return 'library' // /, /charts, /albums, /artists 등 모두 library 탭으로 분류
  }
  const activeTab = getActiveTab()

  // 언어 초기 로드 및 이벤트 리스너
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLang = localStorage.getItem('language')
    if (storedLang) {
      setUiLanguage(storedLang.toUpperCase())
    } else {
      const browserLang = navigator.language || ''
      const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : 'EN'
      setUiLanguage(defaultLang)
      localStorage.setItem('language', defaultLang)
    }

    // 안 읽은 공지사항 계산 (로컬 스토리지에 저장된 마지막 읽은 시간 기준)
    if (initialAnnouncements.length > 0) {
      const lastRead = localStorage.getItem('announcements_last_read')
      if (!lastRead) {
        setHasUnread(true)
      } else {
        const lastReadTime = new Date(lastRead).getTime()
        const newestTime = new Date(initialAnnouncements[0].created_at).getTime()
        setHasUnread(newestTime > lastReadTime)
      }
    }
  }, [initialAnnouncements])

  // 언어 변경 핸들러
  const handleLanguageChange = (lang: string) => {
    setUiLanguage(lang)
    localStorage.setItem('language', lang)
    // Custom Event 발행하여 타 컴포넌트(StudioClient 등)와 실시간 싱크 맞춤
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }))
  }

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setIsAuthMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 공지사항 열기 핸들러
  const handleOpenAnnouncements = () => {
    setIsAnnouncementsOpen(true)
    setHasUnread(false)
    localStorage.setItem('announcements_last_read', new Date().toISOString())
  }

  // 로그아웃
  const handleSignOut = async () => {
    setIsAuthMenuOpen(false)
    await supabase.auth.signOut()
    router.refresh()
    router.push('/')
  }

  // 회원 탈퇴
  const handleWithdraw = async () => {
    setIsAuthMenuOpen(false)
    setConfirmDeleteOpen(true)
  }

  const confirmWithdraw = async () => {
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      alert(`탈퇴 실패: ${error.message}`)
    } else {
      await supabase.auth.signOut()
      alert('회원 탈퇴가 완료되었습니다.')
      router.refresh()
      router.push('/')
    }
    setConfirmDeleteOpen(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-900 bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
          
          {/* Left: Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-white font-bold text-xl shadow-lg shadow-[#FF3366]/20">P</span>
              <span className="text-lg font-black tracking-widest text-[#EDEDED]">PROMPT<span className="text-[#FF3366]">STUDIO</span></span>
            </Link>
            
            <nav className="flex items-center gap-6">
              <Link 
                href="/studio" 
                className={`text-sm font-semibold transition-colors ${activeTab === 'studio' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}
              >
                Studio
              </Link>
              <Link 
                href="/" 
                className={`text-sm font-semibold transition-colors ${activeTab === 'library' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}
              >
                Library
              </Link>
              {isAdmin && (
                <Link 
                  href="/admin/music" 
                  className={`text-sm font-semibold transition-colors ${activeTab === 'admin' ? 'text-[#FF3366]' : 'text-[#A1A1AA] hover:text-[#EDEDED]'}`}
                >
                  관리자
                </Link>
              )}
            </nav>
          </div>

          {/* Right: Status, Language, Notifications, Profile */}
          <div className="flex items-center gap-5">
            
            {/* Status (Online Status Badge) */}
            {user && (
              <div className="hidden sm:flex items-center rounded-full border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300 gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]"></span>
                로그인 완료
              </div>
            )}

            {/* Language Toggle */}
            <div className="flex items-center rounded-full border border-slate-800 bg-slate-900/60 p-0.5">
              <button 
                onClick={() => handleLanguageChange('KO')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-200 ${uiLanguage === 'KO' ? 'bg-slate-800 text-white shadow-sm' : 'text-[#A1A1AA] hover:text-white'}`}
              >
                KO
              </button>
              <button 
                onClick={() => handleLanguageChange('EN')}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-200 ${uiLanguage === 'EN' ? 'bg-slate-800 text-white shadow-sm' : 'text-[#A1A1AA] hover:text-white'}`}
              >
                EN
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800"></div>

            {/* Notification Icon */}
            <div className="relative">
              <button 
                onClick={handleOpenAnnouncements}
                className="relative text-[#A1A1AA] hover:text-white transition-colors p-1 rounded-full hover:bg-slate-900/50"
              >
                <Bell className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#FF3366] shadow-[0_0_6px_#FF3366]"></span>
                )}
              </button>
            </div>

            {/* User Profile / Login Dropdown */}
            <div className="relative" ref={authDropdownRef}>
              {user ? (
                <button 
                  onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] text-sm font-bold text-white shadow-lg ring-2 ring-[#0A0A0A] ring-offset-1 ring-offset-[#2E2E2E] hover:ring-[#FF3366]/50 transition-all cursor-pointer"
                >
                  {(user.email || 'U')[0].toUpperCase()}
                </button>
              ) : (
                <Link 
                  href="/login"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 border border-slate-850 text-sm text-[#A1A1AA] hover:text-white hover:border-[#FF3366] transition-all"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </Link>
              )}

              {/* Auth Dropdown Menu */}
              {isAuthMenuOpen && user && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-slate-850 bg-[#0A0A0A]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl z-50 ring-1 ring-white/5">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4 mb-2 px-2 pt-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF3366] to-[#9213ec] shadow-inner ring-1 ring-white/10">
                        <span className="text-lg font-bold text-white shadow-sm">{(user.email || 'U')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[9px] text-emerald-500 font-bold tracking-wider">ONLINE</span>
                        </div>
                        <p className="text-sm font-medium text-[#EDEDED] truncate" title={user.email || 'User'}>{user.email || 'User'}</p>
                        {isAdmin && (
                          <span className="inline-flex w-fit mt-1 text-[9px] bg-[#FF3366]/20 border border-[#FF3366]/30 text-[#FF3366] px-1.5 py-0.5 rounded font-bold tracking-wider">
                            ADMINISTRATOR
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={handleSignOut} 
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-slate-900 rounded-xl transition-all group text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-[#71717A] group-hover:text-white transition-colors" />
                        로그아웃
                      </button>
                      
                      <button 
                        onClick={handleWithdraw} 
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-[#71717A] hover:text-[#FF3366] hover:bg-[#FF3366]/10 rounded-xl transition-all group text-left cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-[#71717A] group-hover:text-[#FF3366] transition-colors" />
                        계정 삭제
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Announcements Modal */}
      {isAnnouncementsOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsAnnouncementsOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#121212] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-[#0A0A0A]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3366] text-white text-xs font-bold">!</span>
                공지사항
              </h3>
              <button 
                onClick={() => setIsAnnouncementsOpen(false)} 
                className="text-[#A1A1AA] hover:text-white p-1 rounded-lg hover:bg-slate-900"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-4 p-5 overflow-y-auto custom-scrollbar flex-1 bg-[#121212]">
              {announcements.length === 0 ? (
                <div className="text-center text-[#71717A] py-10 font-medium">등록된 공지사항이 없습니다.</div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="border-b border-slate-850 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
                    <h4 className="text-sm font-bold text-[#EDEDED] mb-2">{ann.title}</h4>
                    <p className="text-sm text-[#A1A1AA] whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    <div className="mt-2 text-[10px] text-[#71717A] font-medium">
                      {new Date(ann.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog Modal (Withdrawal) */}
      {confirmDeleteOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#1A1A1A] to-[#121212] shadow-2xl overflow-hidden flex flex-col transform transition-all scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight">계정 삭제</h3>
              <p className="text-[#A1A1AA] text-sm leading-relaxed">
                정말 탈퇴하시겠습니까? 모든 정보가 삭제되며 복구할 수 없습니다.
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#0A0A0A]/50 border-t border-white/5">
              <button 
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-[#EDEDED] bg-white/5 hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={confirmWithdraw}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#FF3366] to-[#FF5588] hover:from-[#E62E5C] hover:to-[#FF3366] shadow-[0_0_15px_rgba(255,51,102,0.3)] transition-all focus:outline-none cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
