import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersistentPlayer } from '@/components/player/PersistentPlayer'
import { LayoutDashboard, Users, Library, Music, Home, LogOut, FileText, Megaphone, CreditCard } from 'lucide-react'
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/music')
  }

  // 1. 관리자 권한 확인 (profiles 테이블에서 is_admin 검사)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profileData?.is_admin) {
    redirect('/')
  }

  const navItems = [
    { href: '/admin/music', label: '대시보드', icon: LayoutDashboard },
    { href: '/admin/music/notices', label: '공지사항 관리', icon: Megaphone },
    { href: '/admin/music/artists', label: '아티스트 관리', icon: Users },
    { href: '/admin/music/credits', label: '크레딧 관리', icon: CreditCard },
    { href: '/admin/music/albums', label: '앨범 관리', icon: Library },
    { href: '/admin/music/tracks', label: '트랙 관리', icon: Music },
    { href: '/admin/music/guides', label: '공용 지침서 관리', icon: FileText },
  ]

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-[#0d0d0d] text-[#e4e4e4] flex flex-col font-sans selection:bg-primary/35 selection:text-black">
        <div className="flex flex-1 pb-24">
          
          {/* Left Sidebar (브랜드 컬러 테마: #161616 배경, #232323 보더) */}
          <aside className="w-64 bg-[#161616] border-r border-[#232323] shrink-0 hidden md:flex flex-col">
            <div className="h-16 flex items-center justify-center border-b border-[#232323]">
              <Link href="/admin/music" className="select-none flex flex-col items-center">
                <span className="cm-wordmark text-[18px] font-black tracking-[-0.02em] leading-none">COOKIEMUSIC</span>
                <span className="text-[9px] font-bold tracking-[0.28em] leading-none text-white/45 mt-1">ADMIN</span>
              </Link>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-slate-350 hover:text-primary hover:bg-[#232323]/50 rounded-xl transition-all text-sm font-medium"
                >
                  <item.icon className="w-5 h-5 text-slate-500 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-[#232323] space-y-2">
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-slate-200 rounded-xl transition-all text-sm font-medium"
              >
                <Home className="w-4 h-4" />
                Public Home
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-950/20 hover:text-red-300 rounded-xl transition-all text-sm font-medium text-left"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </form>
            </div>
          </aside>

          {/* Main Content Workspace */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Bar (브랜드 컬러 테마) */}
            <header className="h-16 border-b border-[#232323] bg-[#0d0d0d]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
              <div className="md:hidden flex items-center gap-2">
                <Link href="/admin/music" className="select-none flex items-center">
                  <span className="cm-wordmark text-[14px] font-black tracking-[-0.02em] leading-none">COOKIEMUSIC</span>
                  <span className="text-[9px] font-bold tracking-[0.24em] leading-none text-white/45 ml-2">ADMIN</span>
                </Link>
              </div>
              
              <div className="flex-1 md:flex-none"></div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400 bg-[#161616] border border-[#232323] px-3 py-1.5 rounded-full font-mono">
                  {user?.email}
                </span>
                
                {/* Mobile Logout */}
                <form action="/api/auth/signout" method="POST" className="md:hidden">
                  <button type="submit" className="p-2 text-red-400 hover:bg-red-950/20 rounded-lg transition-all">
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </header>

            {/* Page Details */}
            <main className="p-6 md:p-8 flex-grow">
              {children}
            </main>
          </div>

        </div>

        {/* Persistent global music player */}
        <PersistentPlayer />
      </div>
    </AdminAuthGuard>
  )
}
