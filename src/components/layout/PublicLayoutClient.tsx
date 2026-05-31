'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Home, Sparkles, Library, Trophy, Bell, Shield, LogOut, 
  Trash2, Globe, ChevronDown, Check, ChevronLeft, ChevronRight, User,
  Search, Settings, Heart, ListMusic, CreditCard, Music, Coins
} from 'lucide-react'
import { PersistentPlayer } from '@/components/player/PersistentPlayer'
import { NowPlayingPanel } from '@/components/player/NowPlayingPanel'
import { usePlayerStore } from '@/stores/playerStore'

interface PublicLayoutClientProps {
  children: React.ReactNode
  user: any
  isAdmin?: boolean
  serverAvatarUrl?: string | null
  initialAnnouncements?: any[]
}

export function PublicLayoutClient({
  children,
  user,
  isAdmin = false,
  serverAvatarUrl = null,
  initialAnnouncements = []
}: PublicLayoutClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { isNowPlayingOpen } = usePlayerStore()

  // UI 상태
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false)
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false)
  const [announcements, setAnnouncements] = useState(initialAnnouncements)
  const [hasUnread, setHasUnread] = useState(false)
  const [profile, setProfile] = useState<{ display_name?: string, avatar_url?: string } | null>(null)

  const authDropdownRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState('')
  const [userCredits, setUserCredits] = useState<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateCredits = () => {
      const saved = localStorage.getItem('user-credits')
      if (saved !== null) {
        setUserCredits(parseFloat(saved))
      }
    }
    updateCredits()
    const interval = setInterval(updateCredits, 2000)
    return () => clearInterval(interval)
  }, [])

  // 활성화된 탭 판별 (Client-safe to avoid SSR Suspense deopt)
  useEffect(() => {
    const getActiveTab = () => {
      if (pathname === '/studio') return 'studio'
      if (pathname === '/charts') return 'charts'
      if (pathname === '/search') return 'search'
      if (pathname === '/library') {
        const params = new URLSearchParams(window.location.search)
        if (params.get('playlistId') === 'recommended') return 'recommended'
        return params.get('tab') === 'liked' ? 'liked' : 'library'
      }
      if (pathname === '/profile') {
        const params = new URLSearchParams(window.location.search)
        return params.get('tab') === 'private' ? 'audio-management' : 'profile'
      }
      if (pathname === '/') return 'home'
      return ''
    }
    setActiveTab(getActiveTab())
  }, [pathname])

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
  }, [])

  // 공지사항 변경 감지 및 실시간 업데이트 처리
  useEffect(() => {
    if (announcements.length > 0) {
      const lastRead = localStorage.getItem('announcements_last_read')
      if (!lastRead) {
        setHasUnread(true)
      } else {
        const lastReadTime = new Date(lastRead).getTime()
        const newestTime = new Date(announcements[0].created_at).getTime()
        setHasUnread(newestTime > lastReadTime)
      }
    } else {
      setHasUnread(false)
    }
  }, [announcements])

  // 실시간 공지사항 구독
  useEffect(() => {
    const channel = supabase
      .channel('public:announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, async () => {
        // 공지사항 데이터 새로고침
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
        if (data) {
          setAnnouncements(data)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // 언어 변경 핸들러
  const handleLanguageChange = (lang: string) => {
    setUiLanguage(lang)
    localStorage.setItem('language', lang)
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

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        try {
          const res = await fetch('/api/profile', { cache: 'no-store' })
          if (res.ok) setProfile(await res.json())
        } catch (e) {
          console.error(e)
        }
      }
    }
    fetchProfile()

    const handleProfileUpdate = (e: any) => {
      setProfile(e.detail)
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
  }, [user])

  const displayAvatar = profile?.avatar_url || serverAvatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  // 공지사항 열기 핸들러
  const handleOpenAnnouncements = () => {
    setIsAnnouncementsOpen(true)
    setHasUnread(false)
    localStorage.setItem('announcements_last_read', new Date().toISOString())
  }

  // 로그아웃
  const handleSignOut = async () => {
    setIsAuthMenuOpen(false)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
      await supabase.auth.signOut()
    } catch (err) {
      console.error('SignOut error:', err)
    }
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md selection:bg-primary selection:text-on-primary">
      
      {/* Shell: Side Navigation (Desktop Only) */}
      <aside className={`hidden md:flex flex-col py-[24px] px-[16px] h-screen w-64 border-r border-outline-variant/10 fixed left-0 top-0 z-50 justify-between ${
        activeTab === 'home' ? 'bg-surface' : 'bg-surface-container-low'
      }`}>
        <div className="flex flex-col gap-[48px]">
          <div className="flex justify-center">
            <Link href="/" className="select-none flex flex-col items-center">
              <img src="/images/logo.png" alt="BEATZ AI MUSIC PLATFORM" className="h-9 object-contain" />
            </Link>
          </div>

          <nav className="flex flex-col gap-[8px]">
            <Link 
              href="/" 
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'home' 
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Home className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '홈' : 'Home'}</span>
            </Link>

            <Link 
              href="/search" 
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'search' 
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Search className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '카테고리' : 'Category'}</span>
            </Link>
            
            <Link 
              href="/charts" 
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'charts' 
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Trophy className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '실시간 차트' : 'Live Charts'}</span>
            </Link>

            <Link 
              href="/library" 
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'library'
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Library className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '플레이리스트' : 'Playlist'}</span>
            </Link>

            <Link 
              href="/profile?tab=public" 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'profile'
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <User className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '내 채널' : 'My Channel'}</span>
            </Link>

            <Link 
              href="/profile?tab=private" 
              onClick={() => setActiveTab('audio-management')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'audio-management'
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Music className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '채널 및 음원 관리' : 'Channel & Audio Management'}</span>
            </Link>


            <Link 
              href="/studio" 
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-[16px] py-[8px] px-[16px] rounded-lg transition-colors duration-200 font-medium ${
                activeTab === 'studio'
                  ? 'text-on-surface bg-white/[0.05]' 
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Sparkles className="w-5 h-5 text-current" />
              <span className="text-[14px] leading-[20px] font-semibold">{uiLanguage === 'KO' ? '스튜디오' : 'Studio'}</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer (Admin Shortcut if logged in as admin) */}
        <div>
          {isAdmin && (
            <Link
              href="/admin/music"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#e3fe06]/10 border border-[#e3fe06]/20 text-[#e3fe06] hover:bg-[#e3fe06]/15 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>{uiLanguage === 'KO' ? '어드민 관리자' : 'Administrator'}</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Canvas */}
      <div className={`flex-1 pl-0 md:pl-64 flex flex-col min-h-screen relative pb-32 transition-all duration-300 ${
        isNowPlayingOpen ? 'md:pr-[360px]' : ''
      }`}>
        
        {/* Shell: Top Navigation */}
        {/* Shell: Top Navigation */}
        <header className="w-full h-16 z-40 bg-surface/80 backdrop-blur-xl sticky top-0 border-b border-outline-variant/10">
          <div className="max-w-7xl mx-auto w-full h-full flex justify-between items-center px-[32px]">
            <div className="flex items-center gap-[16px] flex-1">
              <div className="hidden md:flex gap-[8px]">
                <button 
                  onClick={() => router.back()} 
                  className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface transition-all active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 text-on-surface" />
                </button>
                <button 
                  onClick={() => router.forward()} 
                  className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface transition-all active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5 text-on-surface" />
                </button>
              </div>
              
              <div className="relative w-full max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input 
                  type="text"
                  placeholder={uiLanguage === 'KO' ? '어떤 음악을 듣고 싶으신가요?' : 'What do you want to listen to?'}
                  className="w-full bg-surface-container-high border-none rounded-full pl-10 pr-[16px] py-[4px] text-[16px] leading-[24px] text-on-surface focus:ring-2 ring-primary/20 transition-all placeholder:text-on-surface-variant/50 focus:outline-none"
                  onChange={(e) => {
                    router.push(`/search?q=${encodeURIComponent(e.target.value)}`)
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-[24px] ml-auto shrink-0 justify-end">
              {/* Language Switcher */}
              <div className="flex items-center rounded-full border border-outline-variant/15 bg-surface-container-lowest/60 p-0.5">
                <button 
                  onClick={() => handleLanguageChange('KO')}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${uiLanguage === 'KO' ? 'bg-white/[0.06] text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  KO
                </button>
                <button 
                  onClick={() => handleLanguageChange('EN')}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-200 cursor-pointer ${uiLanguage === 'EN' ? 'bg-white/[0.06] text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  EN
                </button>
              </div>

              {/* Credits (User only) */}
              {user && (
                <Link 
                  href="/pricing"
                  className="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-variant border border-[#e3fe06]/30 px-3 py-1.5 rounded-full transition-all cursor-pointer group"
                  title={uiLanguage === 'KO' ? '크레딧 충전' : 'Buy Credits'}
                >
                  <Coins className="w-4 h-4 text-[#e3fe06] group-hover:scale-110 transition-transform" />
                  <span className="text-[12px] font-bold text-on-surface">{userCredits.toLocaleString()}</span>
                </Link>
              )}

              {/* Notification (Bell) */}
              <div className="relative">
                <button 
                  onClick={handleOpenAnnouncements}
                  className="text-on-surface-variant hover:bg-surface-variant/50 p-[8px] rounded-full transition-all relative cursor-pointer flex items-center justify-center"
                >
                  <Bell className="w-5 h-5" />
                  {hasUnread && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#e3fe06]"></span>
                  )}
                </button>
              </div>

              {/* Settings Button */}
              <Link 
                href="/settings"
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 p-[8px] rounded-full transition-all flex items-center justify-center cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* User Dropdown */}
              <div className="relative flex items-center" ref={authDropdownRef}>
                {user ? (
                  <button 
                    onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
                    className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30 flex items-center justify-center cursor-pointer transition-all hover:scale-105 bg-surface-container-high shrink-0"
                  >
                    {displayAvatar ? (
                      <img 
                        src={displayAvatar}
                        alt="User profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-on-surface-variant" />
                    )}
                  </button>
                ) : (
                  <Link 
                    href="/login"
                    className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30 flex items-center justify-center cursor-pointer transition-all hover:scale-105 bg-surface-container-high"
                  >
                    <User className="w-4 h-4 text-on-surface-variant" />
                  </Link>
                )}

                {/* User Dropdown Menu */}
                {isAuthMenuOpen && user && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-outline-variant/15 bg-surface-container-highest/95 p-3 shadow-2xl backdrop-blur-xl z-[100] ring-1 ring-white/5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-4 mb-2 px-2 pt-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high border-2 border-primary overflow-hidden">
                          {displayAvatar ? (
                            <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#070709] font-black">{user.email?.[0]?.toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e3fe06] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#e3fe06]"></span>
                            </span>
                            <span className="text-[8px] text-[#e3fe06] font-extrabold tracking-wider">ONLINE</span>
                          </div>
                          <p className="text-xs font-bold text-on-surface truncate" title={profile?.display_name || user.email}>
                            {profile?.display_name || user.email}
                          </p>
                          {isAdmin && (
                            <span className="inline-flex w-fit mt-1 text-[8px] bg-[#e3fe06]/10 border border-[#e3fe06]/25 text-[#e3fe06] px-1.5 py-0.5 rounded font-extrabold tracking-wider">
                              ADMINISTRATOR
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-0.5">
                        <Link 
                          href="/profile" 
                          onClick={() => setIsAuthMenuOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-white/[0.05] rounded-xl transition-all group text-left cursor-pointer"
                        >
                          <User className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                          {uiLanguage === 'KO' ? '내 채널' : 'My Channel'}
                        </Link>

                        <Link 
                          href="/settings" 
                          onClick={() => setIsAuthMenuOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-white/[0.05] rounded-xl transition-all group text-left cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                          {uiLanguage === 'KO' ? '설정 및 관리' : 'Settings & Management'}
                        </Link>

                        <Link 
                          href="/pricing" 
                          onClick={() => setIsAuthMenuOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-white/[0.05] rounded-xl transition-all group text-left cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                          {uiLanguage === 'KO' ? '크레딧 충전' : 'Recharge Credits'}
                        </Link>

                        <button 
                          onClick={handleSignOut} 
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-white/[0.05] rounded-xl transition-all group text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                          {uiLanguage === 'KO' ? '로그아웃' : 'Log Out'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Unread Announcements Marquee */}
        {hasUnread && announcements.length > 0 && (
          <div className="w-full bg-[#e3fe06]/[0.03] border-b border-[#e3fe06]/10 py-2 px-4 flex items-center relative overflow-hidden z-30">
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(100vw); }
                100% { transform: translateX(-100%); }
              }
              .animate-marquee {
                animation: marquee 20s linear infinite;
                display: inline-block;
                white-space: nowrap;
                will-change: transform;
              }
              .animate-marquee:hover {
                animation-play-state: paused;
              }
            `}</style>
            <div className="bg-[#e3fe06] text-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 z-10 font-black text-xs shadow-[0_0_10px_rgba(227,254,6,0.4)]">!</div>
            <div className="flex-1 overflow-hidden ml-3 relative whitespace-nowrap mask-image-linear-gradient h-5 flex items-center">
              <div className="animate-marquee cursor-default">
                <span className="text-[#e3fe06] font-extrabold mr-2 tracking-wide">[공지사항]</span>
                <span className="text-gray-200 text-sm font-medium">{announcements[0].title}: {announcements[0].content}</span>
              </div>
            </div>
            <button 
              onClick={handleOpenAnnouncements}
              className="text-xs text-[#e3fe06] shrink-0 z-10 ml-4 font-bold bg-[#080808] pl-2 hover:text-white transition-colors cursor-pointer"
            >
              {uiLanguage === 'KO' ? '자세히 보기' : 'View Details'}
            </button>
          </div>
        )}

        {/* Content Children */}
        <main className="flex-1 px-[32px] py-[24px]">
          <div key={pathname} className="animate-fade-in-up w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Shell: Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-[60] flex items-center justify-between px-[32px] h-24 glass-panel border-t border-outline-variant/10">
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-[4px] cursor-pointer ${
            activeTab === 'home' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Home className="w-5 h-5 text-current" />
          <span className="text-[12px] font-medium tracking-[0.02em]">{uiLanguage === 'KO' ? '홈' : 'Home'}</span>
        </Link>
        <Link 
          href="/search" 
          className={`flex flex-col items-center gap-[4px] cursor-pointer ${
            activeTab === 'search' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Search className="w-5 h-5 text-current" />
          <span className="text-[12px] font-medium tracking-[0.02em]">{uiLanguage === 'KO' ? '카테고리' : 'Category'}</span>
        </Link>
        <Link 
          href="/library" 
          className={`flex flex-col items-center gap-[4px] cursor-pointer ${
            activeTab === 'library' || activeTab === 'liked' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Library className="w-5 h-5 text-current" />
          <span className="text-[12px] font-medium tracking-[0.02em]">{uiLanguage === 'KO' ? '플레이리스트' : 'Playlist'}</span>
        </Link>
      </nav>

      {/* Announcements Modal */}
      {isAnnouncementsOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setIsAnnouncementsOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-2xl border border-outline-variant/15 bg-surface-container shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/10 p-5 bg-surface-container-lowest">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e3fe06] text-[#070709] text-[10px] font-black font-sans">!</span>
                {uiLanguage === 'KO' ? '공지사항' : 'Announcements'}
              </h3>
              <button 
                onClick={() => setIsAnnouncementsOpen(false)} 
                className="text-zinc-555 hover:text-white p-1 rounded-lg hover:bg-white/[0.03] cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-4 p-6 overflow-y-auto custom-scrollbar flex-1">
              {announcements.length === 0 ? (
                <div className="text-center text-on-surface-variant py-10 font-bold text-xs">{uiLanguage === 'KO' ? '등록된 공지사항이 없습니다.' : 'No announcements.'}</div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="border-b border-outline-variant/5 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
                    <h4 className="text-xs font-bold text-on-surface mb-2">{ann.title}</h4>
                    <p className="text-xs text-on-surface-variant whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    <div className="mt-2 text-[9px] text-zinc-655 font-bold">
                      {new Date(ann.created_at).toLocaleString(uiLanguage === 'KO' ? 'ko-KR' : 'en-US')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <PersistentPlayer />
      <NowPlayingPanel />
    </div>
  )
}
