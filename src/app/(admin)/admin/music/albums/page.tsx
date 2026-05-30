'use client'

import { useEffect, useState } from 'react'
import { Library, EyeOff, Eye, Loader2, User, Calendar, Tag, ShieldAlert, Search } from 'lucide-react'
import { parsePlaylistDescription } from '@/lib/utils'

interface AlbumPlaylist {
  id: string
  title: string
  cover_url: string | null
  description: string | null
  genre: string | null
  is_published: boolean
  user_id: string
  created_at: string
  profiles?: {
    display_name: string | null
    is_banned: boolean
  } | null
}

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<AlbumPlaylist[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 앨범(플레이리스트) 목록 가져오기
  const fetchAlbums = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/playlists?all=true')
      if (res.ok) {
        const data = await res.json()
        setAlbums(data || [])
      } else {
        throw new Error('앨범 목록을 불러오지 못했습니다.')
      }
    } catch (err: any) {
      console.error('Error fetching albums:', err)
      alert(err.message || '목록 로드 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlbums()
  }, [])

  // 앨범 퍼블리싱 상태 토글 (공개 <-> 비공개)
  const handleTogglePublish = async (album: AlbumPlaylist) => {
    const nextStatus = !album.is_published
    const actionLabel = nextStatus ? '공개 전환' : '비공개 처리';
    const confirmMessage = nextStatus
      ? `정말 '${album.title}' 앨범을 다시 공개하시겠습니까?`
      : `정말 '${album.title}' 앨범의 공개를 중단하고 비공개로 전환하시겠습니까?\n비공개 시 일반 사용자 화면에 더 이상 노출되지 않습니다.`;

    if (!confirm(confirmMessage)) return

    setActionLoading(album.id)
    try {
      const res = await fetch(`/api/playlists/${album.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: nextStatus })
      })

      if (res.ok) {
        alert(`앨범이 성공적으로 ${actionLabel}되었습니다.`)
        fetchAlbums()
      } else {
        const err = await res.json()
        alert(`${actionLabel} 실패: ` + (err.error || '오류가 발생했습니다.'))
      }
    } catch (err) {
      console.error('Error toggling publish status:', err)
      alert('서버와의 통신에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }
  const filteredAlbums = albums.filter(album => {
    const term = searchTerm.toLowerCase()
    const titleMatch = album.title.toLowerCase().includes(term)
    const genreMatch = (album.genre || '').toLowerCase().includes(term)
    const authorMatch = (album.profiles?.display_name || '').toLowerCase().includes(term) || album.user_id.toLowerCase().includes(term)
    const descMatch = (album.description || '').toLowerCase().includes(term)
    return titleMatch || genreMatch || authorMatch || descMatch
  })

  return (
    <div className="space-y-6 font-sans select-none pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Library className="w-6 h-6 text-[#e3fe06]" />
            사용자 앨범 관리
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            서비스 사용자들이 직접 생성하고 배포(퍼블리싱)한 플레이리스트 및 앨범 카탈로그 목록입니다.
          </p>
        </div>

        {/* 검색 바 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="앨범 제목, 장르, 작성자 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#091009] border border-[#242c24] rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-[#e3fe06]/50 transition-colors"
          />
        </div>
      </div>

      {/* 리스트 그리드 (브랜드 테마: bg-[#161d16], border-[#242c24]) */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#e3fe06] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredAlbums.length > 0 ? (
            filteredAlbums.map((album) => {
              const isUserBanned = album.profiles?.is_banned || false
              const parsedDesc = parsePlaylistDescription(album.description)

              return (
                <div 
                  key={album.id} 
                  className={`bg-[#161d16] border rounded-xl flex flex-row items-stretch group shadow-sm transition-all duration-200 ${
                    isUserBanned 
                      ? 'border-red-950/50 bg-red-950/5' 
                      : 'border-[#242c24] hover:border-[#3d4a3d]'
                  }`}
                >
                  {/* 앨범 커버 (작은 사이즈) */}
                  <div className="relative w-24 h-full min-h-[96px] shrink-0 bg-[#091009] border-r border-[#242c24] flex items-center justify-center overflow-hidden rounded-l-xl">
                    {album.cover_url ? (
                      <img 
                        src={album.cover_url} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-350" 
                      />
                    ) : (
                      <Library className="w-8 h-8 text-slate-700" />
                    )}
                  </div>

                  {/* 정보 및 관리 버튼 컨테이너 */}
                  <div className="p-3.5 flex-grow flex flex-col justify-between gap-3 overflow-hidden">
                    {/* 정보 */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-sm text-slate-100 truncate" title={album.title}>
                          {album.title}
                        </h3>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider border shrink-0 ${
                          album.is_published 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                          {album.is_published ? '공개됨' : '비공개'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <p className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-slate-300">{album.profiles?.display_name || album.user_id.slice(0, 8)}</span>
                        </p>
                        
                        {album.genre && (
                          <p className="flex items-center gap-1 truncate">
                            <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-slate-350 font-mono">{album.genre}</span>
                          </p>
                        )}

                        <p className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-slate-350">{new Date(album.created_at).toLocaleDateString()}</span>
                        </p>
                        
                        {isUserBanned && (
                          <span className="text-red-400 font-bold flex items-center gap-0.5 shrink-0">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            차단유저
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {parsedDesc.text || '설명이 없습니다.'}
                      </p>
                    </div>

                    {/* 관리 버튼 */}
                    <div className="flex-shrink-0 mt-auto">
                      <button
                        id={`btn-toggle-publish-${album.id}`}
                        disabled={actionLoading === album.id}
                        onClick={() => handleTogglePublish(album)}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                          album.is_published
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {actionLoading === album.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : album.is_published ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            비공개 처리
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            공개 처리
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-[#242c24] rounded-2xl bg-[#091009]/30">
              검색 결과와 일치하는 앨범이 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
