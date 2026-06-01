'use client'

import { useEffect, useState } from 'react'
import { Music, Library, EyeOff, Search, Loader2, Play, Pause, AlertCircle, Shield, UserX, UserCheck } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { parsePlaylistDescription } from '@/lib/utils'

export function UgcManagementClient() {
  const [songs, setSongs] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'songs' | 'playlists'>('songs')
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [songsRes, playlistsRes] = await Promise.all([
        fetch('/api/song-history?all=true'),
        fetch('/api/playlists?all=true')
      ])
      
      if (songsRes.ok) setSongs(await songsRes.json() || [])
      if (playlistsRes.ok) setPlaylists(await playlistsRes.json() || [])
    } catch (err) {
      console.error('Error fetching UGC data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleUnpublishPlaylist = async (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: '앨범 퍼블리싱 해제',
      message: `정말 '${title}' 앨범의 공개를 중단하고 비공개로 전환하시겠습니까?\n이 작업은 즉시 적용되며 일반 사용자에게 노출되지 않게 됩니다.`,
      onConfirm: async () => {
        setActionLoading(id)
        try {
          const res = await fetch(`/api/playlists/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: false })
          })
          if (res.ok) {
            setPlaylists(prev => prev.filter(p => p.id !== id))
          } else {
            const err = await res.json()
            alert('비공개 처리 실패: ' + (err.error || '오류가 발생했습니다.'))
          }
        } catch (err) {
          console.error(err)
        } finally {
          setActionLoading(null)
        }
      }
    })
  }

  const handleUnpublishSong = async (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: '음원 퍼블리싱 해제',
      message: `정말 '${title}' 음원의 공개를 중단하고 비공개로 전환하시겠습니까?\n이 작업은 즉시 적용되며 일반 사용자에게 노출되지 않게 됩니다.`,
      onConfirm: async () => {
        setActionLoading(id)
        try {
          const res = await fetch(`/api/song-history/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_published: false })
          })
          if (res.ok) {
            setSongs(prev => prev.filter(s => s.id !== id))
            if (currentTrack?.id === `ugc-song-${id}` && isPlaying) {
              togglePlay()
            }
          } else {
            const err = await res.json()
            alert('비공개 처리 실패: ' + (err.error || '오류가 발생했습니다.'))
          }
        } catch (err) {
          console.error(err)
        } finally {
          setActionLoading(null)
        }
      }
    })
  }

  const handleToggleUserBan = async (targetUserId: string, currentBanStatus: boolean) => {
    const actionLabel = currentBanStatus ? '정지 해제' : '영구 정지';
    setConfirmModal({
      isOpen: true,
      title: `사용자 계정 ${actionLabel}`,
      message: `정말 사용자 '${targetUserId.slice(0, 8)}...' 계정을 ${actionLabel}하시겠습니까?\n\n${currentBanStatus ? '정지 해제 시 이 사용자의 서비스 이용 권한이 정상 복구됩니다.' : '영구 정지 시 이 사용자의 서비스 이용이 금지되며, 해당 사용자가 공개했던 모든 음원 및 앨범이 즉시 일괄 비공개로 강제 차단 전환됩니다.'}`,
      onConfirm: async () => {
        setActionLoading(targetUserId)
        try {
          const res = await fetch(`/api/admin/users/ban`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: targetUserId, is_banned: !currentBanStatus })
          })
          if (res.ok) {
            alert(`계정 ${actionLabel} 처리가 완료되었습니다.`)
            fetchData()
          } else {
            const err = await res.json()
            alert(`${actionLabel} 실패: ` + (err.error || '오류가 발생했습니다.'))
          }
        } catch (err) {
          console.error(err)
        } finally {
          setActionLoading(null)
        }
      }
    })
  }

  const handlePlayUgcSong = (song: any) => {
    if (!song.audio_url) return
    const trackId = `ugc-song-${song.id}`
    const trackToPlay = {
      id: trackId,
      title: song.title || 'UGC Preview Track',
      file_url: song.audio_url,
      duration_sec: 180,
      album_id: 'ugc-album',
      album: {
        id: 'ugc-album',
        title: 'UGC Manager Catalog',
        cover_url: song.image_url || '/default-album.png',
        artist: {
          name: song.user_id ? `User: ${song.user_id.slice(0, 8)}` : 'UGC User',
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

  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPlaylists = playlists.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
          <Shield className="w-6 h-6 text-primary shrink-0" />
          사용자 퍼블리싱 관리 (UGC)
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2">
          일반 사용자들이 내 채널에 퍼블리싱한 음원 및 앨범을 모니터링하고, 저작권 침해나 약관 위반 시 즉시 비공개(퍼블리싱 가리기) 처리합니다.
        </p>
      </div>

      {/* 필터 및 검색 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'songs' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <Music className="w-4 h-4" />
            공개된 음원 ({songs.length})
          </button>
          <button 
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'playlists' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            <Library className="w-4 h-4" />
            공개된 앨범 ({playlists.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="제목 또는 유저 ID 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      </div>

      {/* 본문 리스트 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <span className="text-sm text-slate-400 font-medium">데이터를 불러오는 중입니다...</span>
        </div>
      ) : activeTab === 'songs' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">재생/커버</th>
                  <th className="py-4 px-6">곡 제목</th>
                  <th className="py-4 px-6">사용자 (User ID)</th>
                  <th className="py-4 px-6">등록일</th>
                  <th className="py-4 px-6 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredSongs.map((song) => {
                  const isUserBanned = song.profiles?.is_banned || false
                  return (
                    <tr key={song.id} className={`hover:bg-slate-800/20 transition-colors ${isUserBanned ? 'bg-red-950/10 border-l-2 border-l-red-500/50' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="relative w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center group shrink-0">
                          {song.image_url ? (
                            <img src={song.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className="w-5 h-5 text-slate-500" />
                          )}
                          {song.audio_url && (
                            <button 
                              onClick={() => handlePlayUgcSong(song)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                            >
                              {isPlaying && currentTrack?.id === `ugc-song-${song.id}` ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold truncate max-w-[200px]">
                        {song.title}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 truncate max-w-[150px]" title={song.user_id}>
                        <div className="flex items-center gap-1.5">
                          <span>{song.user_id}</span>
                          {isUserBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold">정지됨</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {new Date(song.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button 
                            disabled={actionLoading === song.id}
                            onClick={() => handleUnpublishSong(song.id, song.title)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-750 disabled:opacity-50"
                          >
                            {actionLoading === song.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                            비공개 (가리기)
                          </button>
                          
                          <button 
                            disabled={actionLoading === song.user_id}
                            onClick={() => handleToggleUserBan(song.user_id, isUserBanned)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${isUserBanned ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10'}`}
                          >
                            {actionLoading === song.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isUserBanned ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                            {isUserBanned ? '정지 해제' : '계정 정지'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredSongs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                      공개된 사용자 음원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">커버</th>
                  <th className="py-4 px-6">앨범 제목</th>
                  <th className="py-4 px-6">사용자 (User ID)</th>
                  <th className="py-4 px-6">설명</th>
                  <th className="py-4 px-6">등록일</th>
                  <th className="py-4 px-6 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredPlaylists.map((playlist) => {
                  const isUserBanned = playlist.profiles?.is_banned || false
                  return (
                    <tr key={playlist.id} className={`hover:bg-slate-800/20 transition-colors ${isUserBanned ? 'bg-red-950/10 border-l-2 border-l-red-500/50' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                          {playlist.cover_url ? (
                            <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Library className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold truncate max-w-[200px]">
                        {playlist.title}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 truncate max-w-[150px]" title={playlist.user_id}>
                        <div className="flex items-center gap-1.5">
                          <span>{playlist.user_id}</span>
                          {isUserBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold">정지됨</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 truncate max-w-[200px]" title={parsePlaylistDescription(playlist.description).text}>
                        {parsePlaylistDescription(playlist.description).text || '-'}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400">
                        {new Date(playlist.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button 
                            disabled={actionLoading === playlist.id}
                            onClick={() => handleUnpublishPlaylist(playlist.id, playlist.title)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-750 disabled:opacity-50"
                          >
                            {actionLoading === playlist.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                            비공개 (가리기)
                          </button>
                          
                          <button 
                            disabled={actionLoading === playlist.user_id}
                            onClick={() => handleToggleUserBan(playlist.user_id, isUserBanned)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${isUserBanned ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10'}`}
                          >
                            {actionLoading === playlist.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isUserBanned ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                            {isUserBanned ? '정지 해제' : '계정 정지'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredPlaylists.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                      공개된 사용자 앨범이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Custom Confirm Modal --- */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 pb-3 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
            </div>
            
            {/* Message */}
            <div className="px-5 pb-5 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </div>
            
            {/* Action Buttons */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
              >
                비공개 전환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
