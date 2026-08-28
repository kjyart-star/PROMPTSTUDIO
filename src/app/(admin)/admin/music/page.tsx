import { createClient } from '@/lib/supabase/server'
import { Users, Library, Music, Play, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // 1. 가입 회원(아티스트) 수 조회
  const { count: artistsCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // 2. 앨범(플레이리스트) 수 조회
  const { count: albumsCount } = await supabase
    .from('user_playlists')
    .select('*', { count: 'exact', head: true })

  // 3. 트랙(생성된 음원) 수 조회
  const { count: tracksCount } = await supabase
    .from('song_history')
    .select('*', { count: 'exact', head: true })

  // 4. 총 재생 횟수 조회 (각 song_history 레코드의 form.play_count 합산)
  const { data: songsForPlayCount } = await supabase
    .from('song_history')
    .select('form')
  
  const totalPlaysCount = (songsForPlayCount || []).reduce((acc: number, song: any) => {
    const playCount = Number(song.form?.play_count || 0)
    return acc + playCount
  }, 0)

  // 최근 등록된 앨범 목록 가져오기 (가장 최근 5개)
  const { data: recentAlbumsRaw } = await supabase
    .from('user_playlists')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  // 최근 앨범에 대해 profiles 유저 이름 수동 매핑 (외래키 관계 미스매치로 인한 PGRST200 에러 방지)
  let recentAlbums: any[] = []
  if (recentAlbumsRaw && recentAlbumsRaw.length > 0) {
    const userIds = Array.from(new Set(recentAlbumsRaw.map(item => item.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    
    recentAlbums = recentAlbumsRaw.map(album => ({
      ...album,
      profiles: profileMap.get(album.user_id) || null
    }))
  }

  const stats = [
    { label: '등록 아티스트', value: artistsCount ?? 0, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '등록 앨범', value: albumsCount ?? 0, icon: Library, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '등록 트랙', value: tracksCount ?? 0, icon: Music, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '누적 재생 수', value: totalPlaysCount ?? 0, icon: Play, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="space-y-8 font-sans selection:bg-primary/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">대시보드</h1>
          <p className="text-sm text-slate-400 mt-1">플랫폼 음악 데이터 및 활성 통계를 요약합니다.</p>
        </div>
      </div>

      {/* 통계 카드 그리드 (브랜드 컬러 테마: bg-[#161616], border-[#232323]) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-[#161616] border border-[#232323] p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{stat.label}</span>
              <p className="text-3xl font-bold tracking-tight text-white">{stat.value.toLocaleString()}</p>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* 최근 콘텐츠 & 바로가기 (브랜드 컬러 테마) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 최근 등록된 앨범 */}
        <div className="lg:col-span-2 bg-[#161616] border border-[#232323] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">최근 등록된 앨범</h2>
            <Link href="/admin/music/albums" className="text-xs text-primary hover:underline flex items-center gap-1">
              전체 보기
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-[#232323]">
            {recentAlbums && recentAlbums.length > 0 ? (
              recentAlbums.map((album: any) => (
                <div key={album.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-[#0a0a0a] rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-[#232323]">
                      {album.cover_url ? (
                        <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Library className="w-5 h-5 text-slate-650" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate text-slate-100">{album.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        작성자: <span className="font-medium text-slate-300">{album.profiles?.display_name || album.user_id.slice(0, 8)}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      album.is_published 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    }`}>
                      {album.is_published ? '공개됨' : '비공개'}
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
        <div className="bg-[#161616] border border-[#232323] rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-bold text-white">빠른 관리 메뉴</h2>
          
          <div className="space-y-3">
            <Link
              href="/admin/music/notices"
              className="block p-4 bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] hover:bg-[#161616] rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-primary">공지사항 관리</p>
              <p className="text-xs text-slate-400 mt-1">사용자에게 표시되는 시스템 공지사항을 등록하고 수정합니다.</p>
            </Link>
            <Link
              href="/admin/music/credits"
              className="block p-4 bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] hover:bg-[#161616] rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-primary">사용자 크레딧 관리</p>
              <p className="text-xs text-slate-400 mt-1">사용자의 보유 크레딧을 확인하고 지급/차감합니다.</p>
            </Link>
            <Link
              href="/admin/music/artists"
              className="block p-4 bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] hover:bg-[#161616] rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-primary">아티스트 & 회원 관리</p>
              <p className="text-xs text-slate-400 mt-1">회원을 모니터링하고 약관 위반 계정을 정지합니다.</p>
            </Link>
            <Link
              href="/admin/music/albums"
              className="block p-4 bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] hover:bg-[#161616] rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-primary">사용자 앨범 관리</p>
              <p className="text-xs text-slate-400 mt-1">사용자가 생성하고 배포한 플레이리스트를 가리거나 공개합니다.</p>
            </Link>
            <Link
              href="/admin/music/tracks"
              className="block p-4 bg-[#0a0a0a] border border-[#232323] hover:border-[#292929] hover:bg-[#161616] rounded-xl transition-all"
            >
              <p className="font-semibold text-sm text-primary">사용자 트랙 & 음원 관리</p>
              <p className="text-xs text-slate-400 mt-1">음원 재생수, 가사, 프롬프트를 확인하고 유해 음원을 비공개 처리합니다.</p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
