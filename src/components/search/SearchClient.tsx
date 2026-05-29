'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Track, Album, Artist } from '@/types/music'
import { Play, Pause, Heart, Users, Library, Music } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'

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

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const supabase = createClient()
  
  // Filter logic
  const filteredTracks = tracks.filter((track) => {
    const titleMatch = track.title.toLowerCase().includes(query.toLowerCase())
    const artistMatch = track.album?.artist?.name?.toLowerCase().includes(query.toLowerCase())
    const albumMatch = track.album?.title?.toLowerCase().includes(query.toLowerCase())
    const genreMatch = track.album?.genres?.some(g => g.toLowerCase().includes(query.toLowerCase()))
    return titleMatch || artistMatch || albumMatch || genreMatch
  })

  const filteredArtists = initialArtists.filter((artist) =>
    artist.name.toLowerCase().includes(query.toLowerCase()) ||
    artist.slug.toLowerCase().includes(query.toLowerCase())
  )

  const filteredAlbums = initialAlbums.filter((album) =>
    album.title.toLowerCase().includes(query.toLowerCase()) ||
    album.artist?.name?.toLowerCase().includes(query.toLowerCase())
  )

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

  // Play handler
  const handlePlayTrack = async (track: Track) => {
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
            <h2 className="text-sm font-black text-on-surface uppercase tracking-widest">
              {uiLanguage === 'KO' ? '모두 둘러보기' : 'Browse all'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {GENRES.map((g) => (
                <button
                  key={g.name}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(g.q)}`)}
                  className={`relative aspect-[4/3] rounded-2xl ${g.color} p-5 overflow-hidden group shadow-lg text-left hover:scale-[1.04] transition-all cursor-pointer`}
                >
                  <div className="flex flex-col select-none">
                    <span className="text-lg font-black tracking-tight text-white leading-tight">{g.name}</span>
                    <span className="text-xs font-bold text-white/80 mt-0.5">{g.korean}</span>
                  </div>
                  <img 
                    src={g.image} 
                    alt="" 
                    className="absolute -right-4 -bottom-4 w-20 h-20 object-cover rounded-xl rotate-[25deg] shadow-2xl group-hover:scale-110 transition-transform duration-300"
                  />
                </button>
              ))}
            </div>
          </div>

        </div>
      ) : (
        // Search Results state
        <div className="space-y-10">
          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
            <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
              Search Results for <span className="text-primary">"{query}"</span>
            </h2>
            <button
              onClick={() => router.push('/search')}
              className="text-[11px] text-on-surface-variant hover:text-white transition-colors uppercase tracking-widest font-black cursor-pointer"
            >
              Clear Search
            </button>
          </div>

          {/* 1. Matching Songs */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">
              Songs
            </h3>
            {filteredTracks.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium">No matching songs found.</p>
            ) : (
              <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/10 bg-surface-container-lowest/80 text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                      <th className="py-4 px-6 w-16 text-center">#</th>
                      <th className="py-4 px-6">Title</th>
                      <th className="py-4 px-6">Album</th>
                      <th className="py-4 px-6 w-24 text-right">Plays</th>
                      <th className="py-4 px-6 w-24 text-center">Like</th>
                      <th className="py-4 px-6 w-20 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {filteredTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id
                      const playCount = track.play_count || 0;
                      return (
                        <tr
                          key={track.id}
                          className={`hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 transition-all duration-200 group ${
                            isCurrent ? 'bg-primary/10' : ''
                          }`}
                        >
                          <td className="py-4 px-6 font-mono text-on-surface-variant/60 text-center w-16">
                            <span className="group-hover:hidden">{idx + 1}</span>
                            <button
                              onClick={() => handlePlayTrack(track)}
                              className="hidden group-hover:inline-block text-primary cursor-pointer"
                            >
                              {isCurrent && isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                            </button>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-surface-container-lowest border border-outline-variant/20 rounded overflow-hidden shrink-0 flex items-center justify-center">
                                {track.album?.cover_url ? (
                                  <img src={track.album.cover_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Music className="w-4 h-4 text-zinc-700" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className={`font-bold block truncate max-w-md ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                                  {track.title}
                                </span>
                                <span className="text-[10px] text-on-surface-variant/80 truncate max-w-md block mt-0.5 font-medium">
                                  {track.album?.artist?.name}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-on-surface-variant font-medium truncate max-w-xs">
                            {track.album?.title}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-on-surface-variant">
                            {playCount.toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => handleLikeToggle(track.id)}
                              className="text-on-surface-variant/80 hover:text-primary transition-colors p-1"
                            >
                              <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                            </button>
                          </td>
                          <td className="py-4 px-6 font-mono text-on-surface-variant/60 text-right w-20">
                            {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Matching Artists */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">
              Artists
            </h3>
            {filteredArtists.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium">No matching artists found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                {filteredArtists.map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/artists/${artist.slug}`}
                    className="bg-surface-container-low border border-outline-variant/10 hover:border-white/[0.12] hover:bg-white/[0.01] p-5 rounded-2xl flex flex-col items-center text-center group shadow-lg transition-all duration-300 cursor-pointer"
                  >
                    <div className="relative aspect-square w-24 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/20 mb-4">
                      {artist.avatar_url ? (
                        <img src={artist.avatar_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                      ) : (
                        <Users className="w-8 h-8 text-zinc-700" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-xs truncate text-on-surface group-hover:text-white transition-colors">{artist.name}</p>
                      <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">Artist</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 3. Matching Albums */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">
              Albums
            </h3>
            {filteredAlbums.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 font-medium">No matching albums found.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                {filteredAlbums.map((album) => (
                  <Link
                    key={album.id}
                    href={`/albums/${album.slug || 'neonecho'}`}
                    className="bg-surface-container-low border border-outline-variant/10 hover:border-[#e3fe06]/30 hover:bg-white/[0.01] p-4 rounded-2xl flex flex-col justify-between group shadow-lg transition-all duration-300 cursor-pointer"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-outline-variant/20">
                      {album.cover_url ? (
                        <img
                          src={album.cover_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                        />
                      ) : (
                        <Library className="w-8 h-8 text-zinc-700" />
                      )}
                    </div>
                    <div className="pt-3 min-w-0">
                      <p className="font-bold text-xs truncate text-on-surface group-hover:text-primary transition-colors">{album.title}</p>
                      <p className="text-[10px] text-on-surface-variant/60 truncate mt-0.5 font-bold">
                        {album.artist?.name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
