import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PersistentPlayer } from '@/components/player/PersistentPlayer'
import { LayoutDashboard, Users, Library, Music, Home, LogOut, Shield } from 'lucide-react'

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

  // 1. 관리자 권한 확인 (user_roles 테이블에서 역할 검사)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    redirect('/')
  }

  const navItems = [
    { href: '/admin/music', label: '대시보드', icon: LayoutDashboard },
    { href: '/admin/music/artists', label: '아티스트 관리', icon: Users },
    { href: '/admin/music/albums', label: '앨범 관리', icon: Library },
    { href: '/admin/music/tracks', label: '트랙 관리', icon: Music },
    { href: '/admin/music/ugc', label: '사용자 퍼블리싱 관리', icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <div className="flex flex-1 pb-24">
        
        {/* Left Sidebar */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 shrink-0 hidden md:flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-slate-800">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                MUSIC ADMIN
              </span>
            </Link>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all text-sm font-medium"
              >
                <item.icon className="w-5 h-5 text-slate-400 shrink-0" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 space-y-2">
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
          {/* Top Bar */}
          <header className="h-16 border-b border-slate-900 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="md:hidden flex items-center gap-2">
              <span className="font-bold text-sm bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                MUSIC ADMIN
              </span>
            </div>
            
            <div className="flex-1 md:flex-none"></div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full font-mono">
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
  )
}
