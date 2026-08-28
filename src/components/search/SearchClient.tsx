'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Track, Album, Artist } from '@/types/music'
import { Play, Pause, Heart, Users, Library, Music, Search, TrendingUp, Sparkles, Compass } from 'lucide-react'
import { TrackDropdown } from '@/components/common/TrackDropdown'
import { AlbumCard } from '@/components/common/AlbumCard'
import { GenreCard } from '@/components/common/GenreCard'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription } from '@/lib/utils'

interface SearchClientProps {
  initialQuery: string
  initialTracks: Track[]
  initialArtists: Artist[]
  initialAlbums: Album[]
  initialUserLikes: string[]
}

import { GENRES } from '@/lib/constants'


export function SearchClient({
  initialTracks,
  initialArtists,
  initialAlbums,
  initialUserLikes
}: SearchClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [localSearchQuery, setLocalSearchQuery] = useState('')
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
    if (typeof window === 'undefined') return
    const storedLang = localStorage.getItem('language')
    if (storedLang) {
      setUiLanguage(storedLang.toUpperCase())
    }
    const handleLangChange = (e: any) => {
      setUiLanguage(e.detail.toUpperCase())
    }
    window.addEventListener('languageChange', handleLangChange)
    return () => window.removeEventListener('languageChange', handleLangChange)
  }, [])

  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
  const supabase = createClient()
  
  // Filter logic
  const isSpecialQuery = ['popular-albums', 'latest-albums', 'recommended-tracks', 'latest-tracks'].includes(query.toLowerCase())

  const filteredTracks = useMemo(() => {
    const q = query.toLowerCase()
    if (['recommended-tracks', 'latest-tracks'].includes(q)) {
      let result = [...tracks]
      if (q === 'recommended-tracks') {
        result.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      } else {
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      }
      return result
    }
    const result = tracks.filter((track) => {
      const titleMatch = track.title.toLowerCase().includes(q)
      const artistMatch = track.album?.artist?.name?.toLowerCase().includes(q)
      const albumMatch = track.album?.title?.toLowerCase().includes(q)
      const genreMatch = track.album?.genres?.some(g => g.toLowerCase().includes(q))
      return titleMatch || artistMatch || albumMatch || genreMatch
    })
    
    // Sort by latest by default
    result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    
    return result
  }, [tracks, query])

  const filteredArtists = useMemo(() => {
    if (isSpecialQuery) return []
    const q = query.toLowerCase()
    return initialArtists.filter((artist) =>
      artist.name.toLowerCase().includes(q) ||
      artist.slug.toLowerCase().includes(q)
    )
  }, [initialArtists, query, isSpecialQuery])

  const filteredAlbums = useMemo(() => {
    const q = query.toLowerCase()
    if (['popular-albums', 'latest-albums'].includes(q)) {
      let result = [...initialAlbums]
      if (q === 'popular-albums') {
        result.sort((a, b) => (b.total_likes || 0) - (a.total_likes || 0))
      } else {
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      }
      return result
    }
    return initialAlbums.filter((album) =>
      album.title.toLowerCase().includes(q) ||
      album.artist?.name?.toLowerCase().includes(q)
    )
  }, [initialAlbums, query])

  const showSongs = !isSpecialQuery || query.toLowerCase() === 'recommended-tracks' || query.toLowerCase() === 'latest-tracks'
  const showArtists = !isSpecialQuery
  const showAlbums = !isSpecialQuery || query.toLowerCase() === 'popular-albums' || query.toLowerCase() === 'latest-albums'

  const displayedTracks = useMemo(() => {
    if (!localSearchQuery.trim()) return filteredTracks
    const q = localSearchQuery.toLowerCase()
    return filteredTracks.filter((track) => {
      const titleMatch = track.title.toLowerCase().includes(q)
      const artistMatch = track.album?.artist?.name?.toLowerCase().includes(q)
      const albumMatch = track.album?.title?.toLowerCase().includes(q)
      return titleMatch || artistMatch || albumMatch
    })
  }, [filteredTracks, localSearchQuery])

  // Like Toggle
  const handleLikeToggle = async (trackId: string) => {
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

  // Save to Playlist handler
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
      alert(uiLanguage === 'KO' ? '플레이리스트에 담겼습니다.' : uiLanguage === 'JA' ? 'プレイリストに追加されました。' : 'Saved to playlist.')
    } catch (err) {
      console.error(err)
      alert(uiLanguage === 'KO' ? '플레이리스트 담기에 실패했습니다.' : uiLanguage === 'JA' ? '追加に失敗しました。' : 'Failed to save track.')
    }
  }

  // Play handler
  const handlePlayTrack = async (track: Track) => {
    setNowPlayingOpen(true)
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }
    if (track.file_url.startsWith('http')) {
      playTrack(track, filteredTracks)
      return
    }
    try {
      const { data, error } = await supabase.storage
        .from('tracks')
        .createSignedUrl(track.file_url, 3600)
      if (error) throw error
      const signedTrack: Track = {
        ...track,
        file_url: data.signedUrl
      }
      playTrack(signedTrack, filteredTracks)
    } catch (err) {
      console.error(err)
      alert('음원 재생에 실패했습니다.')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-[32px] py-6 space-y-10 text-on-surface font-sans">
      {!query ? (
        // Initial state: Recent Searches + Browse All
        <div className="space-y-10">
          

          {/* Browse All */}
          <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
              <Compass className="w-6 h-6 text-primary shrink-0" />
              {uiLanguage === 'KO' ? '모두 둘러보기' : uiLanguage === 'JA' ? 'すべて表示' : 'Browse all'}
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {GENRES.map((g) => (
                <GenreCard
                  key={g.name}
                  genre={g}
                  uiLanguage={uiLanguage}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(g.q)}`)}
                />
              ))}
            </div>
          </div>

        </div>
      ) : (
        // Search Results state
        <div className="space-y-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-outline-variant/10 pb-4 gap-4">
            <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
              {query.toLowerCase() === 'popular-albums' ? <TrendingUp className="w-6 h-6 text-primary shrink-0" /> :
               query.toLowerCase() === 'latest-albums' ? <Library className="w-6 h-6 text-primary shrink-0" /> :
               query.toLowerCase() === 'recommended-tracks' ? <Music className="w-6 h-6 text-primary shrink-0" /> :
               query.toLowerCase() === 'latest-tracks' ? <Sparkles className="w-6 h-6 text-primary shrink-0" /> :
               <Search className="w-6 h-6 text-primary shrink-0" />}
              {query.toLowerCase() === 'popular-albums' ? (uiLanguage === 'KO' ? '인기 앨범' : uiLanguage === 'JA' ? '人気のアルバム' : 'Popular Albums') :
               query.toLowerCase() === 'latest-albums' ? (uiLanguage === 'KO' ? '최신 앨범' : uiLanguage === 'JA' ? '最新のアルバム' : 'Latest Albums') :
               query.toLowerCase() === 'recommended-tracks' ? (uiLanguage === 'KO' ? '추천 음원' : uiLanguage === 'JA' ? 'おすすめのトラック' : 'Recommended Tracks') :
               query.toLowerCase() === 'latest-tracks' ? (uiLanguage === 'KO' ? '최신 음원' : uiLanguage === 'JA' ? '最新のトラック' : 'Latest Tracks') :
               <>{uiLanguage === 'KO' ? '검색 결과:' : uiLanguage === 'JA' ? '検索結果: ' : 'Search Results for'} <span className="text-primary">"{query}"</span></>}
            </h1>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input
                  type="text"
                  placeholder="결과 내 검색..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="w-full sm:w-[250px] bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-on-surface focus:outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
                />
              </div>
              <button
                onClick={() => router.push('/search')}
                className="text-[11px] text-on-surface-variant hover:text-white transition-colors uppercase tracking-widest font-black cursor-pointer shrink-0"
              >
                Clear Search
              </button>
            </div>
          </div>

          {/* 1. Matching Songs */}
          {showSongs && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">
              {uiLanguage === 'KO' ? '음원 (Songs)' : uiLanguage === 'JA' ? '曲' : 'Songs'}
            </h3>
            {displayedTracks.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium">No matching songs found.</p>
            ) : (
              <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                      <th className="p-0 font-black tracking-widest text-center w-20 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 rounded-tl-[15px] w-full h-full">{uiLanguage === 'KO' ? '순위' : uiLanguage === 'JA' ? '順位' : 'Rank'}</div></th>
                      <th className="p-0 font-black tracking-widest border-b border-white/[0.04]"><div className="py-4.5 px-4 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '곡 정보' : uiLanguage === 'JA' ? 'トラック' : 'Track'}</div></th>
                      <th className="p-0 font-black tracking-widest text-right w-24 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '재생수' : uiLanguage === 'JA' ? '再生数' : 'Plays'}</div></th>
                      <th className="p-0 font-black tracking-widest text-right w-24 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね数' : 'Likes'}</div></th>
                      <th className="p-0 font-black tracking-widest text-right w-20 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '시간' : uiLanguage === 'JA' ? '時間' : 'Time'}</div></th>
                      <th className="p-0 font-black tracking-widest text-right w-16 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 rounded-tr-[15px] w-full h-full select-none text-transparent">&nbsp;</div></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {displayedTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id
                      const playCount = track.play_count || 0;
                      return (
                        <tr
                          key={track.id}
                          className={`hover:bg-white/[0.02] transition-all group ${
                            isCurrent ? 'bg-primary/10' : ''
                          }`}
                        >
                          <td className="py-4 px-6 text-center w-20">
                            <span className={`font-mono font-black text-sm ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{idx + 1}</span>
                          </td>
                          
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <button 
                                className="w-14 h-14 bg-surface-container-lowest border border-outline-variant/20 rounded overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer group/cover"
                                onClick={() => handlePlayTrack(track)}
                              >
                                {track.album?.cover_url ? (
                                  <img 
                                    src={track.album.cover_url} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Music className="w-5 h-5 text-zinc-650" />
                                )}
                                
                                <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-200 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  {isCurrent && isPlaying ? (
                                    <div className="flex items-end justify-center gap-[3px] h-4 w-4">
                                      <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                      <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                      <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                    </div>
                                  ) : (
                                    <Play className="w-5 h-5 fill-current text-white" />
                                  )}
                                </div>
                              </button>
                              <div className="min-w-0">
                                <span 
                                  onClick={() => handlePlayTrack(track)}
                                  className={`font-bold block truncate max-w-sm sm:max-w-md cursor-pointer hover:underline ${isCurrent ? 'text-primary' : 'text-on-surface'}`}
                                >
                                  {track.title}
                                </span>
                                <span className="text-[10px] text-on-surface-variant/80 truncate max-w-sm sm:max-w-md block mt-0.5 font-medium">
                                  {track.album?.artist?.name || 'Unknown Artist'} &bull; {track.album?.title || 'Single'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-on-surface-variant/80 text-xs">
                            {playCount.toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleLikeToggle(track.id)}
                                className={`inline-flex items-center gap-1.5 p-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-bold cursor-pointer ${
                                  userLikes.includes(track.id) ? 'text-primary' : 'text-on-surface-variant/60 hover:text-primary'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                                <span className="font-mono">{track.like_count || 0}</span>
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono text-xs text-on-surface-variant text-right w-20">
                            {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                          </td>
                          <td className="py-4 px-6 text-right w-16">
                            <div className="flex items-center justify-center gap-1">
                              <TrackDropdown
                                track={track}
                                myPlaylists={myPlaylists}
                                userLikes={userLikes}
                                uiLanguage={uiLanguage}
                                onLikeToggle={handleLikeToggle}
                                onSaveToPlaylist={handleSaveToPlaylist}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {/* 3. Matching Albums (Rendered on Popular/Latest Albums Special Queries) */}
          {(query.toLowerCase() === 'popular-albums' || query.toLowerCase() === 'latest-albums') && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">
              {uiLanguage === 'KO' ? '앨범 (Albums)' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'}
            </h3>
            {filteredAlbums.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium">No matching albums found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                {filteredAlbums.map((album) => (
                  <AlbumCard key={album.id} album={album} variant="grid" />
                ))}
              </div>
            )}
          </div>
          )}



        </div>
      )}
    </div>
  )
}
