import { createClient } from '@/lib/supabase/server'
import { Users, Library, Music, Play, ArrowUpRight, Plus } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // 1. 아티스트 수 조회
  const { count: artistsCount } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true })

  // 2. 앨범 수 조회
  const { count: albumsCount } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })

  // 3. 트랙 수 조회
  const { count: tracksCount } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true })

  // 4. 총 재생 횟수 조회
  const { count: totalPlaysCount } = await supabase
    .from('play_events')
    .select('*', { count: 'exact', head: true })

  // 최근 등록된 앨범 목록 가져오기 (가장 최근 5개)
  const { data: recentAlbums } = await supabase
    .from('albums')
    .select('id, title, cover_url, release_type, status, created_at, artists(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const stats = [
    { label: '등록 아티스트', value: artistsCount ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '등록 앨범', value: albumsCount ?? 0, icon: Library, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: '등록 트랙', value: tracksCount ?? 0, icon: Music, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
    { label: '누적 재생 수', value: totalPlaysCount ?? 0, icon: Play, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">대시보드</h1>
          <p className="text-sm text-slate-400 mt-1">플랫폼 음악 데이터 및 활성 통계를 요약합니다.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            id="btn-shortcut-upload"
            href="/admin/music/tracks"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" />
            새 음원 업로드
          </Link>
        </div>
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{stat.label}</span>
              <p className="text-3xl font-bold tracking-tight">{stat.value.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* 최근 콘텐츠 & 바로가기 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 최근 등록된 앨범 */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">최근 등록된 앨범</h2>
            <Link href="/admin/music/albums" className="text-xs text-violet-400 hover:underline flex items-center gap-1">
              전체 보기
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-800">
            {recentAlbums && recentAlbums.length > 0 ? (
              recentAlbums.map((album: any) => (
                <div key={album.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-slate-700">
                      {album.cover_url ? (
                        <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Library className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{album.title}</p>
                      <p className="text-xs text-slate-400 truncate">{album.artists?.name || '알 수 없는 아티스트'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      album.release_type === 'single' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      album.release_type === 'ep' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                      'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20'
                    }`}>
                      {album.release_type}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      album.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      album.status === 'draft' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {album.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                등록된 앨범이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 빠른 관리 메뉴 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-bold">빠른 관리 메뉴</h2>
          
          <div className="space-y-3">
            <Link
              href="/admin/music/artists"
              className="block p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-slate-200">아티스트 정보 편집</p>
              <p className="text-xs text-slate-400 mt-1">가수를 추가하고 바이오와 대표 프로필을 변경합니다.</p>
            </Link>
            <Link
              href="/admin/music/albums"
              className="block p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-slate-200">앨범 패키지 설정</p>
              <p className="text-xs text-slate-400 mt-1">싱글, EP, LP 단위를 구분하고 아트워크를 등록합니다.</p>
            </Link>
            <Link
              href="/admin/music/tracks"
              className="block p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-slate-200">트랙 및 가사 메타 편집</p>
              <p className="text-xs text-slate-400 mt-1">프롬프트, BPM, 가사 데이터 및 음원 재생을 통합 제어합니다.</p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
