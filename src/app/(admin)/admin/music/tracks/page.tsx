'use client'

import { useEffect, useState } from 'react'
import { Music, EyeOff, Eye, Loader2, Play, Pause, FileText, User, Calendar, ShieldAlert, X, Search } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'

interface SongTrack {
  id: string
  title: string
  audio_url: string | null
  image_url: string | null
  prompt: string | null
  lyrics: string | null
  notes: string | null
  form: any | null
  is_published: boolean
  user_id: string
  created_at: string
  profiles?: {
    display_name: string | null
    is_banned: boolean
  } | null
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<SongTrack[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // 상세 보기 모달 상태
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<SongTrack | null>(null)

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  // 음원 목록 가져오기
  const fetchTracks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/song-history?all=true')
      if (res.ok) {
        const data = await res.json()
        setTracks(data || [])
      } else {
        throw new Error('음원 목록을 불러오지 못했습니다.')
      }
    } catch (err: any) {
      console.error('Error fetching tracks:', err)
      alert(err.message || '목록 로드 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTracks()
  }, [])

  // 음원 재생 제어
  const handlePlaySong = (song: SongTrack) => {
    if (!song.audio_url) return
    const trackId = `ugc-song-${song.id}`
    const trackToPlay = {
      id: trackId,
      title: song.title || 'UGC Preview Track',
      file_url: song.audio_url,
      duration_sec: null,
      album_id: 'ugc-album',
      album: {
        id: 'ugc-album',
        title: 'UGC Manager Catalog',
        cover_url: song.image_url || '/default-album.png',
        artist: {
          name: song.profiles?.display_name || `User: ${song.user_id.slice(0, 8)}`,
          slug: song.user_id || 'ugc-user'
        }
      }
    }
    
    if (currentTrack?.id === trackId) {
      togglePlay()
    } else {
      playTrack(trackToPlay as any, [trackToPlay] as any[])
    }
  }

  // 음원 퍼블리싱 상태 토글
  const handleTogglePublish = async (song: SongTrack) => {
    const nextStatus = !song.is_published
    const actionLabel = nextStatus ? '공개 전환' : '비공개 처리';
    const confirmMessage = nextStatus
      ? `정말 '${song.title}' 음원을 다시 공개하시겠습니까?`
      : `정말 '${song.title}' 음원의 공개를 중단하고 비공개로 전환하시겠습니까?\n비공개 시 일반 사용자 화면에 더 이상 노출되지 않습니다.`;

    if (!confirm(confirmMessage)) return

    setActionLoading(song.id)
    try {
      const res = await fetch(`/api/song-history/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: nextStatus })
      })

      if (res.ok) {
        alert(`음원이 성공적으로 ${actionLabel}되었습니다.`)
        fetchTracks()
        
        // 재생 중인 경우 비공개 전환 시 일시정지 처리
        const trackId = `ugc-song-${song.id}`
        if (!nextStatus && currentTrack?.id === trackId && isPlaying) {
          togglePlay()
        }
      } else {
        const err = await res.json()
        alert(`${actionLabel} 실패: ` + (err.error || '오류가 발생했습니다.'))
      }
    } catch (err) {
      console.error('Error toggling song publish:', err)
      alert('서버와의 통신에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredTracks = tracks.filter(track => {
    const term = searchTerm.toLowerCase()
    return (
      track.title.toLowerCase().includes(term) ||
      (track.prompt?.toLowerCase() || '').includes(term) ||
      (track.lyrics?.toLowerCase() || '').includes(term) ||
      (track.profiles?.display_name?.toLowerCase() || '').includes(term)
    )
  })

  return (
    <div className="space-y-6 font-sans pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Music className="w-6 h-6 text-[#e3fe06]" />
            사용자 트랙 & 음원 관리
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            서비스 사용자들이 생성한 전체 AI 음원 트랙 목록을 모니터링하고 공개 여부를 제어합니다.
          </p>
        </div>

        {/* 검색 바 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="곡 제목, 프롬프트, 작성자 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#091009] border border-[#242c24] rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-[#e3fe06]/50 transition-colors"
          />
        </div>
      </div>

      {/* 트랙 목록 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#e3fe06] animate-spin" />
        </div>
      ) : (
        <div className="bg-[#161d16] border border-[#242c24] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242c24] bg-[#091009]/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-16">재생</th>
                  <th className="py-4 px-6 w-16">커버</th>
                  <th className="py-4 px-6">제목</th>
                  <th className="py-4 px-6">작성자 (사용자)</th>
                  <th className="py-4 px-6 w-28 text-center">공개 상태</th>
                  <th className="py-4 px-6 w-36">등록일</th>
                  <th className="py-4 px-6 w-48 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242c24] text-sm">
                {filteredTracks.length > 0 ? (
                  filteredTracks.map((track) => {
                    const isUserBanned = track.profiles?.is_banned || false
                    const trackId = `ugc-song-${track.id}`
                    const isCurrentlyPlaying = isPlaying && currentTrack?.id === trackId

                    return (
                      <tr 
                        key={track.id} 
                        className={`hover:bg-[#091009]/35 transition-all ${
                          isUserBanned ? 'bg-red-950/10 border-l-2 border-l-red-500/50' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <button
                            id={`btn-play-song-${track.id}`}
                            onClick={() => handlePlaySong(track)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isCurrentlyPlaying 
                                ? 'bg-[#e3fe06] text-black shadow-md' 
                                : 'bg-[#091009] border border-[#242c24] text-slate-400 hover:text-white hover:border-[#323d32]'
                            }`}
                          >
                            {isCurrentlyPlaying ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5 ml-0.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#242c24] border border-[#242c24] flex items-center justify-center shrink-0">
                            {track.image_url ? (
                              <img src={track.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-100">{track.title}</td>
                        <td className="py-4 px-6 text-slate-350">
                          <div className="flex items-center gap-1.5 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>{track.profiles?.display_name || track.user_id.slice(0, 8)}</span>
                            {isUserBanned && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">정지됨</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            track.is_published 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          }`}>
                            {track.is_published ? '공개됨' : '비공개'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-xs">
                          {new Date(track.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* 상세 가사/프롬프트 보기 */}
                            <button
                              id={`btn-detail-song-${track.id}`}
                              onClick={() => {
                                setSelectedTrack(track)
                                setDetailModalOpen(true)
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#242c24] hover:bg-[#323d32] text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-[#242c24]"
                              title="가사 및 프롬프트 보기"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              정보 보기
                            </button>

                            {/* 공개/비공개 토글 */}
                            <button
                              id={`btn-toggle-publish-${track.id}`}
                              disabled={actionLoading === track.id}
                              onClick={() => handleTogglePublish(track)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                track.is_published
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {actionLoading === track.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : track.is_published ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  비공개 처리
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  공개 처리
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      검색 결과와 일치하는 트랙이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 상세 정보 모달 */}
      {detailModalOpen && selectedTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#091009]/70 backdrop-blur-sm">
          <div className="bg-[#161d16] border border-[#242c24] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#242c24] bg-[#091009]/20">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <Music className="w-5 h-5 text-[#e3fe06]" />
                곡 상세 메타데이터 모니터링
              </h3>
              <button 
                onClick={() => {
                  setDetailModalOpen(false)
                  setSelectedTrack(null)
                }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#242c24] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
              
              {/* 기본 정보 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#091009]/40 border border-[#242c24]/60">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#242c24] border border-[#242c24] shrink-0">
                  {selectedTrack.image_url ? (
                    <img src={selectedTrack.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                
                <div className="space-y-1 min-w-0">
                  <h4 className="font-bold text-base text-slate-100 truncate">{selectedTrack.title}</h4>
                  <p className="text-xs text-slate-400">
                    작성자: <span className="text-slate-250 font-semibold">{selectedTrack.profiles?.display_name || selectedTrack.user_id}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    ID: {selectedTrack.id}
                  </p>
                </div>
              </div>

              {/* 스타일 프롬프트 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  스타일 프롬프트 (Style / Genre Prompt)
                </label>
                <div className="w-full p-3.5 rounded-xl bg-[#091009] border border-[#242c24] text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedTrack.prompt || '(지정된 스타일 프롬프트 없음)'}
                </div>
              </div>

              {/* 가사 */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  곡 가사 (Lyrics)
                </label>
                <div className="w-full p-4 rounded-xl bg-[#091009] border border-[#242c24] text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-mono">
                  {selectedTrack.lyrics || '(가사 없음 - 연주곡)'}
                </div>
              </div>

              {/* 추가 생성 정보 (notes 등) */}
              {selectedTrack.notes && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    제작 메모 및 설정 (Notes)
                  </label>
                  <div className="w-full p-3.5 rounded-xl bg-[#091009] border border-[#242c24] text-sm text-slate-350 whitespace-pre-wrap leading-relaxed">
                    {selectedTrack.notes}
                  </div>
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="p-4 bg-[#091009] border-t border-[#242c24] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false)
                  setSelectedTrack(null)
                }}
                className="px-5 py-2 rounded-xl bg-[#161d16] hover:bg-[#242c24] border border-[#242c24] text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
