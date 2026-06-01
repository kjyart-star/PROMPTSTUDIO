'use client'

import { useState, useEffect } from 'react'
import { Album, Track } from '@/types/music'
import { Play, Pause, Heart, Clock, Library, FileText, MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TrackDropdown } from '@/components/common/TrackDropdown'
import { usePlayerStore } from '@/stores/playerStore'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription } from '@/lib/utils'

const formatCount = (count: number) => {
  if (!count) return '0'
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return count.toString()
}

interface AlbumClientProps {
  album: Album
  initialTracks: Track[]
  initialUserLikes: string[]
}

export function AlbumClient({
  album,
  initialTracks,
  initialUserLikes
}: AlbumClientProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [expandedLyricsTrackId, setExpandedLyricsTrackId] = useState<string | null>(null)
  
  const [isAlbumLiked, setIsAlbumLiked] = useState<boolean>(false)
  const [myPlaylists, setMyPlaylists] = useState<any[]>([])

  useEffect(() => {
    const fetchPlaylists = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      
      const { data } = await supabase
        .from('user_playlists')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        
      if (data) {
        setMyPlaylists(data.filter((p: any) => parsePlaylistDescription(p.description).type === 'playlist'))
      }
    }
    fetchPlaylists()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_liked_albums')
      if (stored) {
        try {
          const list = JSON.parse(stored)
          setIsAlbumLiked(list.includes(album.id))
        } catch (e) {
          console.error(e)
        }
      }

      const storedMockLikes = localStorage.getItem('mock_liked_tracks')
      if (storedMockLikes) {
        try {
          const parsed = JSON.parse(storedMockLikes)
          if (Array.isArray(parsed)) {
            setUserLikes((prev) => Array.from(new Set([...prev, ...parsed])))
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [album.id])

  const handleAlbumLikeToggle = () => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('user_liked_albums')
    let list: string[] = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (e) {
        console.error(e)
      }
    }

    let next: string[]
    if (list.includes(album.id)) {
      next = list.filter((id) => id !== album.id)
      setIsAlbumLiked(false)
    } else {
      next = [...list, album.id]
      setIsAlbumLiked(true)
    }
    localStorage.setItem('user_liked_albums', JSON.stringify(next))
  }
  
  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
  const supabase = createClient()

  const handleLikeToggle = async (trackId: string) => {
    if (trackId.startsWith('mock-')) {
      const isLiked = userLikes.includes(trackId)
      let nextLikes: string[]
      let nextLikeCountOffset = 0
      if (isLiked) {
        nextLikes = userLikes.filter((id) => id !== trackId)
        nextLikeCountOffset = -1
      } else {
        nextLikes = [...userLikes, trackId]
        nextLikeCountOffset = 1
      }
      setUserLikes(nextLikes)
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? { ...t, like_count: Math.max(0, (t.like_count || 0) + nextLikeCountOffset) }
            : t
        )
      )
      try {
        localStorage.setItem('mock_liked_tracks', JSON.stringify(nextLikes.filter(id => id.startsWith('mock-'))))
      } catch (e) {
        console.error(e)
      }
      return
    }

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId })
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          alert('로그인이 필요한 기능입니다.')
          return
        }
        throw new Error(data.error)
      }

      if (data.liked) {
        setUserLikes((prev) => [...prev, trackId])
      } else {
        setUserLikes((prev) => prev.filter((id) => id !== trackId))
      }

      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, like_count: data.like_count } : t))
      )
    } catch (err) {
      console.error(err)
      alert('좋아요 처리에 실패했습니다.')
    }
  }

  const handleSaveToPlaylist = async (trackId: string, playlistId: string) => {
    try {
      const res = await fetch('/api/playlists/save-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId, playlist_id: playlistId })
      })
      if (!res.ok) {
        if (res.status === 401) {
          alert('로그인이 필요한 기능입니다.')
          return
        }
        throw new Error('Failed to save track')
      }
      alert('플레이리스트에 담겼습니다.')
    } catch (err) {
      console.error(err)
      alert('플레이리스트 담기에 실패했습니다.')
    }
  }

  const handlePlayTrack = async (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.id.startsWith('mock-') || track.file_url.startsWith('http')) {
      const signedTrack: Track = {
        ...track,
        album: album
      }
      const queueTracks = tracks.map((t) => ({
        ...t,
        album: t.id === track.id ? signedTrack.album : { ...album }
      }))
      playTrack(signedTrack, queueTracks)
      setNowPlayingOpen(true)
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from('tracks')
        .createSignedUrl(track.file_url, 3600)

      if (error) throw error
      
      const signedTrack: Track = {
        ...track,
        file_url: data.signedUrl,
        album: album
      }

      const queueTracks = tracks.map((t) => ({
        ...t,
        album: t.id === track.id ? signedTrack.album : { ...album }
      }))

      playTrack(signedTrack, queueTracks)
      setNowPlayingOpen(true)
    } catch (err) {
      console.error(err)
      alert('음원 재생에 실패했습니다.')
    }
  }

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    handlePlayTrack(tracks[0], 0)
  }

  return (
    <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-10 font-sans">
      
      {/* 앨범 상세 헤더 */}
      <section className="relative w-full bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950/40 rounded-3xl p-6 md:p-8 border border-zinc-800/60 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none"></div>

        {/* 커버 아트 */}
        <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/5 bg-zinc-900 flex items-center justify-center z-10">
          {album.cover_url ? (
            <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Library className="w-16 h-16 text-zinc-700" />
          )}
        </div>

        {/* 정보 텍스트 */}
        <div className="space-y-4 text-center md:text-left flex-1 min-w-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-extrabold tracking-widest text-[#e3fe06] uppercase border border-[#e3fe06]/30 px-2 py-0.5 rounded-full bg-[#e3fe06]/10">
              {album.release_type === 'playlist' ? 'PLAYLIST' : 'ALBUM'}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mt-1 truncate">
            {album.title}
          </h1>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 text-xs text-zinc-400 font-semibold tracking-wide mt-1">
            {album.artist ? (
              <Link 
                href={`/artists/${album.artist.slug}`} 
                className="text-primary hover:underline transition-all font-bold cursor-pointer"
              >
                {album.artist.name}
              </Link>
            ) : (
              <span className="text-zinc-200">AI Artist</span>
            )}
            <span>&bull;</span>
            <span>{album.release_date ? new Date(album.release_date).getFullYear() : '발매일 미상'}</span>
            <span>&bull;</span>
            <span>수록곡 {tracks.length}곡</span>
            <span>&bull;</span>
            <span>재생 {formatCount(album.total_plays || 12000)}회</span>
            <span>&bull;</span>
            <span>좋아요 {formatCount((album.total_likes || 450) + (isAlbumLiked ? 1 : 0))}개</span>
          </div>

          {album.description && (
            <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl line-clamp-2">
              {parsePlaylistDescription(album.description).text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
              className="px-6 py-2.5 rounded-full bg-primary hover:bg-[#e3fe06] text-[#0b0c0b] text-xs font-extrabold flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-primary shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              전체 재생
            </button>
            <button
              onClick={handleAlbumLikeToggle}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                isAlbumLiked 
                  ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20' 
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
              }`}
              title={album.release_type === 'playlist' ? "플레이리스트 좋아요" : "앨범 좋아요"}
            >
              <Heart className={`w-4 h-4 ${isAlbumLiked ? 'fill-current' : ''}`} />
            </button>
            <button className="w-9 h-9 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

      </section>

      {/* 수록곡 트랙 테이블 */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">수록곡 목록</h2>

        <div className="w-full flex flex-col">
          {/* Header */}
          <div className="grid grid-cols-[50px_1fr_120px_80px] gap-4 px-6 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-zinc-800/40">
            <div>#</div>
            <div>제목</div>
            <div className="text-right">좋아요</div>
            <div className="text-right flex justify-end items-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1 mt-3">
            {tracks.length > 0 ? (
              tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="grid grid-cols-[50px_1fr_120px_80px] gap-4 px-6 py-3 items-center rounded-xl hover:bg-white/5 transition-all group"
                >
                  {/* Index */}
                  <div className="font-mono text-slate-500 text-sm">
                    <span className={currentTrack?.id === track.id && isPlaying ? "text-primary font-bold" : ""}>
                      {track.track_number}
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/5 flex items-center justify-center cursor-pointer group/cover"
                      onClick={() => handlePlayTrack(track, idx)}
                    >
                      <img 
                        src={(track as any).image_url || album.cover_url || "/default-album.png"} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-album.png";
                        }}
                      />
                      {/* Hover Play/Pause Overlay */}
                      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all ${
                        currentTrack?.id === track.id && isPlaying
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {currentTrack?.id === track.id && isPlaying ? (
                          <div className="flex items-end justify-center gap-[3px] h-4 w-4">
                            <div className="w-[3px] h-full bg-white rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
                            <div className="w-[3px] h-full bg-white rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
                            <div className="w-[3px] h-full bg-white rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
                          </div>
                        ) : (
                          <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold truncate block ${currentTrack?.id === track.id && isPlaying ? 'text-primary' : 'text-slate-100'}`}>
                          {track.title}
                        </span>
                        {track.lyrics && (
                          <button
                            onClick={() => setExpandedLyricsTrackId(expandedLyricsTrackId === track.id ? null : track.id)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0 cursor-pointer"
                            title="가사 보기"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {album.artist ? (
                        <Link
                          href={`/artists/${album.artist.slug}`}
                          className="text-xs text-slate-400 hover:text-primary transition-colors font-semibold truncate cursor-pointer"
                        >
                          {album.artist.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold truncate">
                          AI Artist
                        </span>
                      )}

                      {track.style_prompt && (
                        <p className="text-[10px] font-mono text-slate-500 truncate max-w-lg mt-0.5">
                          Prompt: {track.style_prompt}
                        </p>
                      )}

                      {expandedLyricsTrackId === track.id && track.lyrics && (
                        <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-xl mt-2 text-xs text-slate-300 whitespace-pre-line leading-relaxed max-w-xl animate-fade-in">
                          {track.lyrics}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Likes and Add to Playlist */}
                  <div className="text-right flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleLikeToggle(track.id)}
                      className={`inline-flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-900/50 transition-all text-xs font-semibold cursor-pointer ${
                        userLikes.includes(track.id) ? 'text-primary' : 'text-slate-400 hover:text-primary'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                      <span className="font-mono">{track.like_count || 0}</span>
                    </button>
                  </div>

                  {/* Duration */}
                  <div className="font-mono text-xs text-slate-400 text-right w-16">
                    {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                  </div>
                  
                  {/* More Options */}
                  <div className="flex items-center justify-center gap-1">
                    <TrackDropdown
                      track={track}
                      myPlaylists={myPlaylists}
                      userLikes={userLikes}
                      uiLanguage="KO"
                      onLikeToggle={handleLikeToggle}
                      onSaveToPlaylist={handleSaveToPlaylist}
                    />
                  </div>

                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-600">
                등록된 트랙이 없습니다.
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
