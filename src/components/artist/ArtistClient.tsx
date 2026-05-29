'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Artist, Album, Track } from '@/types/music'
import { Play, Pause, Heart, Users, Library, Music, Check, MoreHorizontal, User } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'

interface ArtistClientProps {
  artist: Artist
  albums: Album[]
  initialTracks: Track[]
  initialUserLikes: string[]
}

// Dummy database fallbacks for Neon Echo to match the mockup exactly
const DUMMY_POPULAR_TRACKS = [
  {
    id: 'dummy-1',
    title: 'Electric Dreams',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 222,
    like_count: 342109002, // 342,109,002 plays in mockup
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-1',
    album: {
      id: 'dummy-album-1',
      title: 'Electric Dreams',
      cover_url: '/images/vanguard_cover.png',
      release_type: 'album',
      status: 'published',
      created_at: '',
      artist_id: 'neonecho',
      artist: { name: 'Neon Echo', slug: 'neonecho' }
    }
  },
  {
    id: 'dummy-2',
    title: 'Midnight Pulse',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 255,
    like_count: 289551920, // 289,551,920 plays
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-2',
    album: {
      id: 'dummy-album-2',
      title: 'Midnight Pulse',
      cover_url: '/images/silent_tides_cover.png',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'neonecho',
      artist: { name: 'Neon Echo', slug: 'neonecho' }
    }
  },
  {
    id: 'dummy-3',
    title: 'Shadow Dance',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 198,
    like_count: 158003441, // 158,003,441 plays
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-3',
    album: {
      id: 'dummy-album-3',
      title: 'Shadow Dance',
      cover_url: '/images/retro_future_cover.png',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'neonecho',
      artist: { name: 'Neon Echo', slug: 'neonecho' }
    }
  },
  {
    id: 'dummy-4',
    title: 'Static Sky',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 301,
    like_count: 102994122, // 102,994,122 plays
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-4',
    album: {
      id: 'dummy-album-4',
      title: 'Static Sky',
      cover_url: '/images/live_tokyo_cover.png',
      release_type: 'album',
      status: 'published',
      created_at: '',
      artist_id: 'neonecho',
      artist: { name: 'Neon Echo', slug: 'neonecho' }
    }
  },
  {
    id: 'dummy-5',
    title: 'Vibration Theory',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration_sec: 235,
    like_count: 94332100, // 94,332,100 plays
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-5',
    album: {
      id: 'dummy-album-5',
      title: 'Vibration Theory',
      cover_url: '/images/vanguard_cover.png',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'neonecho',
      artist: { name: 'Neon Echo', slug: 'neonecho' }
    }
  }
]

const DUMMY_DISCOGRAPHY = [
  { id: 'disco-1', title: 'Electric Dreams', cover_url: '/images/vanguard_cover.png', release_type: 'lp', release_year: '2024' },
  { id: 'disco-2', title: 'Midnight Pulse', cover_url: '/images/silent_tides_cover.png', release_type: 'single', release_year: '2023' },
  { id: 'disco-3', title: 'Shadow Dance', cover_url: '/images/retro_future_cover.png', release_type: 'ep', release_year: '2023' },
  { id: 'disco-4', title: 'Static Sky', cover_url: '/images/live_tokyo_cover.png', release_type: 'lp', release_year: '2022' },
  { id: 'disco-5', title: 'Vibration Theory', cover_url: '/images/vanguard_cover.png', release_type: 'single', release_year: '2022' },
  { id: 'disco-6', title: 'Echoes of Tomorrow', cover_url: '/images/silent_tides_cover.png', release_type: 'lp', release_year: '2021' }
]

const DUMMY_RELATED_ARTISTS = [
  { id: 'rel-1', name: 'Solaris', slug: 'solaris', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' },
  { id: 'rel-2', name: 'Pulse Unit', slug: 'pulse_unit', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop' },
  { id: 'rel-3', name: 'Void Voyager', slug: 'void_voyager', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop' },
  { id: 'rel-4', name: 'Electric Aura', slug: 'electric_aura', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' },
  { id: 'rel-5', name: 'Lumina', slug: 'lumina', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop' },
  { id: 'rel-6', name: 'Analog Soul', slug: 'analog_soul', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop' }
]

export function ArtistClient({
  artist,
  albums,
  initialTracks,
  initialUserLikes
}: ArtistClientProps) {
  const isNeonEcho = artist.slug === 'neonecho'
  const router = useRouter()

  // If the artist is Neon Echo, load mockup tracks, else database tracks
  const defaultTracks = isNeonEcho 
    ? DUMMY_POPULAR_TRACKS 
    : artist.is_user
      ? initialTracks
      : initialTracks.length > 0 
        ? initialTracks 
        : DUMMY_POPULAR_TRACKS

  const defaultAlbums = isNeonEcho 
    ? DUMMY_DISCOGRAPHY 
    : artist.is_user
      ? albums
      : albums.length > 0 
        ? albums 
        : DUMMY_DISCOGRAPHY

  const [tracks, setTracks] = useState<Track[]>(defaultTracks as Track[])
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [isFollowed, setIsFollowed] = useState(false)

  // Extra profile fields loaded from local storage for user creators
  const [profileBio, setProfileBio] = useState(artist.bio)
  const [profileBanner, setProfileBanner] = useState(artist.banner_url)
  const [profileFollowers, setProfileFollowers] = useState(artist.followers || 0)
  const [profileHandle, setProfileHandle] = useState(artist.slug || artist.name.toLowerCase().replace(/\s+/g, ''))
  const [profileTags, setProfileTags] = useState<string[]>(['Dream', 'Dubstep', 'Doom Metal', 'K-pop', 'Ambient-POP'])
  const [profileFollowing, setProfileFollowing] = useState(0)
  const [profilePlays, setProfilePlays] = useState('0')
  const [profileLikes, setProfileLikes] = useState('0')

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const supabase = createClient()

  useEffect(() => {
    if (artist.is_user) {
      try {
        const extra = localStorage.getItem(`profile-extra-${artist.id}`)
        if (extra) {
          const parsed = JSON.parse(extra)
          if (parsed.bio !== undefined) setProfileBio(parsed.bio)
          if (parsed.banner_url !== undefined) setProfileBanner(parsed.banner_url)
          if (parsed.followers !== undefined) setProfileFollowers(parsed.followers)
          if (parsed.handle !== undefined) setProfileHandle(parsed.handle)
          if (parsed.tags !== undefined) setProfileTags(parsed.tags)
          if (parsed.following !== undefined) setProfileFollowing(parsed.following)
          if (parsed.plays !== undefined) setProfilePlays(parsed.plays)
          if (parsed.likes !== undefined) setProfileLikes(parsed.likes)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [artist])

  useEffect(() => {
    const checkRedirect = async () => {
      if (artist.is_user) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && user.id === artist.id) {
          router.push('/profile?tab=public')
        }
      }
    }
    checkRedirect()
  }, [artist, supabase, router])

  const handleLikeToggle = async (trackId: string) => {
    if (trackId.startsWith('dummy-')) {
      if (userLikes.includes(trackId)) {
        setUserLikes((prev) => prev.filter((id) => id !== trackId))
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, like_count: (t.like_count || 1) - 1 } : t))
        )
      } else {
        setUserLikes((prev) => [...prev, trackId])
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, like_count: (t.like_count || 0) + 1 } : t))
        )
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

  const handlePlayTrack = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.id.startsWith('dummy-') || track.file_url.startsWith('http')) {
      playTrack(track, tracks)
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

      playTrack(signedTrack, tracks)
    } catch (err) {
      console.error(err)
      alert('음원 재생에 실패했습니다.')
    }
  }

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    handlePlayTrack(tracks[0])
  }

  // Neon Echo grayscale portrait / User banner / default banner
  const portraitUrl = isNeonEcho 
    ? '/images/media__1779826172648.png' 
    : artist.is_user
      ? (profileBanner || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&auto=format&fit=crop&q=80')
      : artist.banner_url || '/images/media__1779826172648.png'

  // Neon Echo silhouette / User banner / default silhouette
  const silhouetteUrl = isNeonEcho 
    ? '/images/media__1779826553763.png' 
    : artist.is_user
      ? (profileBanner || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&auto=format&fit=crop&q=80')
      : '/images/media__1779826553763.png'

  if (artist.is_user) {
    return (
      <div className="max-w-7xl mx-auto px-[32px] pt-0 md:pt-0 font-sans text-on-surface w-full">
        
        {/* Premium Cover Banner Header for Public Channel View */}
        <div className="relative w-full h-[260px] md:h-[350px] rounded-3xl overflow-hidden mb-6 border border-outline-variant/10 shadow-2xl">
          {/* Banner Image Background */}
          <img 
            src={portraitUrl} 
            alt="Banner" 
            className="w-full h-full object-cover" 
          />
          {/* Glassmorphic dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0b] via-[#0b0c0b]/40 to-transparent flex flex-col justify-end p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex items-center gap-4 md:gap-6">
                {/* Circular Avatar */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-primary/50 shadow-[0_0_20px_rgba(227,254,6,0.3)] overflow-hidden shrink-0 bg-[#0e150e]">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#18181b] flex items-center justify-center">
                      <User className="w-10 h-10 text-primary" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 md:space-y-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{artist.name}</h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">@{profileHandle}</p>
                  <div className="flex gap-4 text-xs font-bold text-zinc-300 pt-1">
                    <span className="flex items-center gap-1"><Play className="w-3.5 h-3.5 fill-current text-primary" /> {profilePlays} Plays</span>
                    <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-primary" /> {profileLikes} Likes</span>
                  </div>
                  {profileBio && (
                    <p className="text-xs text-zinc-350 leading-relaxed max-w-md md:max-w-xl line-clamp-2 md:line-clamp-none pt-1">
                      {profileBio}
                    </p>
                  )}
                  {profileTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {profileTags.map((tag: string) => (
                        <span 
                          key={tag} 
                          className="px-2 py-0.5 bg-white/10 hover:bg-white/20 border border-white/5 text-[9px] font-bold rounded text-white transition-colors cursor-pointer"
                          onClick={() => alert(`장르 검색: ${tag}`)}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setIsFollowed(prev => !prev);
                    setProfileFollowers(prev => isFollowed ? prev - 1 : prev + 1);
                  }}
                  className={`px-6 py-2.5 rounded-full text-xs font-extrabold transition-all duration-300 border backdrop-blur-sm ${
                    isFollowed 
                      ? 'bg-primary text-[#0b0c0b] border-primary shadow-[0_0_15px_rgba(227,254,6,0.3)]' 
                      : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                  }`}
                >
                  {isFollowed ? '✓ Following' : '+ Follow'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats and Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-surface-container/30 border border-outline-variant/10 p-3 rounded-2xl backdrop-blur-sm">
          <div className="flex flex-wrap gap-2">
            <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm">
              <span className="text-primary font-extrabold">{tracks.length}</span> songs
            </div>
            <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm">
              <span className="text-primary font-extrabold">{profileFollowers}</span> followers
            </div>
            <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm">
              <span className="text-primary font-extrabold">{profileFollowing}</span> following
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayAll}
              disabled={tracks.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-[#080d08] font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/10 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Play All
            </button>
          </div>
        </div>

        {/* Featured Showcase (Up to 2 tracks) */}
        {tracks.length > 0 && (
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tracks.slice(0, 2).map((song, index) => {
                const isPlayingThis = currentTrack?.id === song.id && isPlaying;
                return (
                  <div key={song.id} className="relative rounded-3xl overflow-hidden border border-[#1b3a2a] shadow-2xl p-6 bg-gradient-to-r from-[#07140e] via-[#0b170f] to-[#050a06] flex flex-col sm:flex-row items-center gap-6 min-h-[180px] group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none"></div>
                    
                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden shrink-0 shadow-lg">
                      <img 
                        src={song.album?.cover_url || "/default-album.png"} 
                        alt="Cover" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-album.png";
                        }}
                      />
                      <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white">
                        3:00
                      </span>
                      <button 
                        onClick={() => handlePlayTrack(song)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background pl-1 shadow-md">
                          {isPlayingThis ? <Pause className="w-5 h-5 ml-[-4px]" /> : <Play className="w-5 h-5" />}
                        </div>
                      </button>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                        <span className="text-[10px] font-extrabold text-[#e3fe06] bg-[#e3fe06]/10 border border-[#e3fe06]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                          FEATURED {index === 0 ? 'SINGLE' : 'TRACK'}
                        </span>
                        <span className="text-[10px] font-extrabold text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                          V2.0
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-white tracking-tight truncate">
                        {song.title}
                      </h3>
                      <p className="text-xs text-zinc-400 font-medium truncate">
                        {song.album?.title || 'Single'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium pt-1 justify-center sm:justify-start">
                        <span className="flex items-center gap-1">
                          <Play className="w-3.5 h-3.5 fill-current text-zinc-500" /> {song.play_count || 0} Plays
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleLikeToggle(song.id); }}
                          className={`flex items-center gap-1 hover:text-primary transition-colors ${userLikes.includes(song.id) ? 'text-primary font-bold' : 'text-zinc-500'}`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${userLikes.includes(song.id) ? 'fill-current text-primary' : 'text-zinc-500'}`} /> {song.like_count || 0} Likes
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Songs Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight">
              Songs
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tracks.map((song) => {
              const isPlayingThis = currentTrack?.id === song.id && isPlaying;
              return (
                <div key={song.id} className="bg-surface-container/40 hover:bg-surface-container-high/60 border border-outline-variant/10 p-3 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01] group shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-md">
                      <img 
                        src={song.album?.cover_url || "/default-album.png"} 
                        alt="Cover" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-album.png";
                        }}
                      />
                      <button 
                        onClick={() => handlePlayTrack(song)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      >
                        {isPlayingThis ? (
                          <Pause className="w-4 h-4 text-primary fill-current" />
                        ) : (
                          <Play className="w-4 h-4 text-primary fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-bold text-on-surface truncate">{song.title}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <span className="text-zinc-500 font-mono">▶</span> {song.play_count || 0}
                        </span>
                        <span>•</span>
                        <span>{song.album?.title || 'Single'}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLikeToggle(song.id); }}
                    className={`p-2 rounded-full hover:bg-white/5 transition-all shrink-0 cursor-pointer ${
                      userLikes.includes(song.id) ? 'text-primary' : 'text-zinc-500 hover:text-primary'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${userLikes.includes(song.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              );
            })}
            {tracks.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-450 bg-white/[0.01] rounded-2xl border border-dashed border-outline-variant/10">
                등록된 음원이 없습니다.
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  // AI Artist (Neon Echo) Layout
  return (
    <div className="font-sans text-on-surface w-full">
      
      {/* 1. Artist Hero Section */}
      <section className="-mx-[32px] -mt-[24px] relative h-[28vh] min-h-[240px] md:h-[34vh] overflow-hidden bg-[#0e150e] flex flex-col justify-end">
        {/* Background portrait */}
        <div className="absolute inset-0 select-none">
          <img 
            src={portraitUrl} 
            alt="" 
            className="w-full h-full object-cover grayscale opacity-55 brightness-[0.75]"
          />
          {/* Smooth gradients to blend image into the forest green-black background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e150e] via-[#0e150e]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e150e]/50 via-transparent to-transparent" />
        </div>

        {/* Artist Profile Content */}
        <div className="max-w-7xl mx-auto w-full px-[32px] pb-6 md:pb-8 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-black">
                <Check className="w-2.5 h-2.5 stroke-[4px]" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                Verified Artist
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
              {artist.name}
            </h1>

            <p className="text-[10px] md:text-xs font-semibold text-on-surface-variant tracking-wide">
              {isNeonEcho ? '24,582,104 monthly listeners' : '1,240,115 monthly listeners'}
            </p>

            {/* Action Row */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-[#080d08] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current stroke-[2px]" />
                Play
              </button>
              <button
                onClick={() => setIsFollowed(!isFollowed)}
                className={`px-6 py-3 rounded-full border border-white/20 font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${
                  isFollowed ? 'bg-white/10 text-white' : 'bg-transparent text-zinc-300 hover:border-white'
                }`}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
              <button className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-on-surface-variant hover:text-white transition-all cursor-pointer">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-12 animate-fade-in duration-700">
        {/* 2. Popular Tracks and Artist Pick/About grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Popular Tracks (Left) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-black text-on-surface uppercase tracking-widest">
            Popular
          </h2>

          <div className="space-y-1.5">
            {tracks.length > 0 ? (
              tracks.slice(0, 5).map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id
                return (
                  <div 
                    key={track.id} 
                    className={`py-3 flex items-center justify-between group hover:bg-white/[0.02] px-4 rounded-xl transition-all duration-200 ${
                      isCurrent ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-xs font-bold text-on-surface-variant/60 w-4 text-center">
                        {idx + 1}
                      </span>
                      <button
                        onClick={() => handlePlayTrack(track)}
                        className="w-10 h-10 bg-surface-container-lowest border border-outline-variant/20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative cursor-pointer"
                      >
                        {track.album?.cover_url ? (
                          <img src={track.album.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-on-surface-variant/40" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          {isCurrent && isPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current text-primary" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current text-white" />
                          )}
                        </div>
                      </button>
                      <div className="min-w-0">
                        <p className={`font-bold text-xs truncate transition-colors ${isCurrent ? 'text-primary' : 'text-on-surface group-hover:text-white'}`}>
                          {track.title}
                        </p>
                        {isNeonEcho ? null : (
                          <p className="text-[10px] text-on-surface-variant/80 truncate mt-0.5 font-medium">{track.album?.artist?.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <button
                        onClick={() => handleLikeToggle(track.id)}
                        className="text-on-surface-variant/80 hover:text-primary transition-colors p-1"
                      >
                        <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                      </button>
                      <span className="text-[11px] font-mono text-on-surface-variant w-24 text-right">
                        {track.like_count ? track.like_count.toLocaleString() : '0'}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant/60 font-bold w-10 text-right">
                        {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs text-on-surface-variant/60 bg-white/[0.01] border border-dashed border-outline-variant/10 rounded-xl">
                등록된 음원이 없습니다.
              </div>
            )}
          </div>

          {tracks.length > 5 && (
            <button className="text-[11px] font-black uppercase text-on-surface-variant hover:text-white transition-colors tracking-widest pl-4">
              See More
            </button>
          )}
        </div>

        {/* Right side: Artist Pick & About */}
        <div className="space-y-8">
          
          {/* Artist Pick */}
          {!artist.is_user && (
            <div className="space-y-4">
              <h2 className="text-sm font-black text-on-surface uppercase tracking-widest">
                Artist Pick
              </h2>
              <div className="bg-surface-container-low border border-outline-variant/15 p-4 rounded-2xl flex items-center gap-4 shadow-xl">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-container-lowest border border-outline-variant/20 shrink-0">
                  <img src="/images/media__1779823538571.png" alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-white/20">
                      <img src={portraitUrl} alt="" className="w-full h-full object-cover grayscale" />
                    </span>
                    <span className="text-[9px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Posted by Neon Echo</span>
                  </div>
                  <p className="font-extrabold text-xs text-on-surface truncate">Neon Echo: Best Of</p>
                  <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Playlist</p>
                </div>
              </div>
            </div>
          )}

          {/* About */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-on-surface uppercase tracking-widest">
              About
            </h2>
            <div className="relative h-60 rounded-2xl overflow-hidden border border-outline-variant/15 shadow-xl group flex flex-col justify-end p-6 bg-surface-container-low">
              {/* Background */}
              <div className="absolute inset-0 select-none">
                <img src={silhouetteUrl} alt="" className="w-full h-full object-cover brightness-[0.7] group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e150e] via-[#0e150e]/60 to-transparent" />
              </div>
              
              <div className="relative z-10 space-y-2">
                <p className="text-xs text-zinc-350 leading-relaxed font-semibold line-clamp-3">
                  {artist.is_user
                    ? profileBio || 'Creating premium quality AI audio, sound designs, and full album tracks.'
                    : isNeonEcho
                      ? 'Neon Echo is a genre-defying visionary blending cinematic soundscapes with driving electronic beats. Based in London,...'
                      : artist.bio || 'Creating premium quality AI audio, sound designs, and full album tracks.'}
                </p>
                <button className="text-[10px] font-bold uppercase text-white hover:text-primary tracking-widest transition-colors">
                  Read more
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Discography Grid */}
      {defaultAlbums.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
            <h2 className="text-xs font-black text-on-surface uppercase tracking-widest">
              Discography
            </h2>
            <button className="text-[11px] text-primary hover:text-[#e3fe06] transition-colors font-bold tracking-tight">
              Show all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {(defaultAlbums as any[]).map((album) => (
              <Link
                key={album.id}
                href={`/albums/${album.slug || 'neonecho'}`}
                className="bg-surface-container-low border border-outline-variant/15 hover:border-[#e3fe06]/30 hover:bg-white/[0.01] p-4 rounded-2xl flex flex-col justify-between group shadow-lg transition-all duration-300 cursor-pointer"
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
                  <span className="absolute top-2 right-2 text-[8px] font-bold px-2 py-0.5 rounded bg-primary text-[#080d08] uppercase tracking-widest scale-90">
                    {album.release_type}
                  </span>
                </div>
                <div className="pt-3 min-w-0">
                  <p className="font-bold text-xs truncate text-on-surface group-hover:text-primary transition-colors">{album.title}</p>
                  <p className="text-[10px] text-on-surface-variant/80 truncate mt-0.5 font-bold">
                    {album.release_year || (album.release_date ? new Date(album.release_date).getFullYear() : '2024')} • Album
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Fans Also Like Grid */}
      {!artist.is_user && (
        <section className="space-y-6">
          <h2 className="text-xs font-black text-on-surface uppercase tracking-widest">
            Fans also like
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {DUMMY_RELATED_ARTISTS.map((rel) => (
              <Link
                key={rel.id}
                href={`/artists/${rel.slug}`}
                className="bg-surface-container-low border border-outline-variant/15 hover:border-white/[0.12] hover:bg-white/[0.01] p-5 rounded-2xl flex flex-col items-center text-center group shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-square w-24 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/20 mb-4">
                  <img
                    src={rel.avatar_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-xs truncate text-on-surface group-hover:text-white transition-colors">{rel.name}</p>
                  <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-wider">Artist</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      </div>
    </div>
  )
}
