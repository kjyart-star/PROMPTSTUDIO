'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Artist, Album, Track } from '@/types/music'
import { Play, Pause, Heart, Users, Library, Music, Check, MoreHorizontal, User, Lock, Globe, Pencil, X, Info, Upload, Download, ChevronRight } from 'lucide-react'
import { TrackDropdown } from '@/components/common/TrackDropdown'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription } from '@/lib/utils'
import { AlbumCard } from '@/components/common/AlbumCard'

interface ArtistClientProps {
  artist: Artist
  albums: Album[]
  initialTracks: Track[]
  initialUserLikes: string[]
}



interface ArtistClientProps {
  artist: Artist
  albums: Album[]
  initialTracks: Track[]
  initialUserLikes: string[]
  playlists?: any[]
  currentUserId?: string | null
}

export function ArtistClient({
  artist,
  albums,
  initialTracks,
  initialUserLikes,
  playlists = [],
  currentUserId
}: ArtistClientProps) {
  const isNeonEcho = artist.slug === 'neonecho'
  const router = useRouter()

  const defaultTracks = initialTracks
  const defaultAlbums = albums

  const [tracks, setTracks] = useState<Track[]>(defaultTracks as Track[])
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
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
    try {
      const savedLikes = localStorage.getItem('artist-liked-songs')
      if (savedLikes) {
        const parsedLikes = JSON.parse(savedLikes)
        setUserLikes((prev) => Array.from(new Set([...prev, ...parsedLikes])))
        
        setTracks((prev) => prev.map(t => {
          if (parsedLikes.includes(t.id) && (!t.like_count || t.like_count === 0)) {
            return { ...t, like_count: 1 }
          }
          return t
        }))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])
  const [isFollowed, setIsFollowed] = useState(false)
  const [uiLanguage, setUiLanguage] = useState<'KO' | 'EN' | 'JA'>('KO')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('language')
      if (storedLang) {
        setUiLanguage(storedLang.toUpperCase() as any)
      } else {
        const browserLang = navigator.language || ''
        const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : browserLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN'
        setUiLanguage(defaultLang)
        localStorage.setItem('language', defaultLang)
      }

      const handleLangChange = (e: any) => {
        setUiLanguage(e.detail.toUpperCase())
      }
      window.addEventListener('languageChange', handleLangChange)
      return () => window.removeEventListener('languageChange', handleLangChange)
    }
  }, [])

  // Extra profile fields loaded from local storage for user creators
  const [profileName, setProfileName] = useState(artist.name || '')
  const [profileBio, setProfileBio] = useState(artist.bio)
  const [profileBanner, setProfileBanner] = useState(artist.banner_url)
  const [profileFollowers, setProfileFollowers] = useState(artist.followers || 0)
  const [profileHandle, setProfileHandle] = useState(artist.slug || artist.name.toLowerCase().replace(/\s+/g, ''))
  const [profileTags, setProfileTags] = useState<string[]>(['Dream', 'Dubstep', 'Doom Metal', 'K-pop', 'Ambient-POP'])
  const [profileFollowing, setProfileFollowing] = useState(0)
  const [profilePlays, setProfilePlays] = useState('0')
  const [profileLikes, setProfileLikes] = useState('0')

  // Edit Channel State
  const [isEditingChannel, setIsEditingChannel] = useState(false)
  const [editName, setEditName] = useState(artist.name || '')
  const [editHandle, setEditHandle] = useState(artist.slug || '')
  const [editBio, setEditBio] = useState(artist.bio || '')
  const [editTags, setEditTags] = useState<string[]>(['Dream', 'Dubstep', 'Doom Metal', 'K-pop', 'Ambient-POP'])
  const [editAvatar, setEditAvatar] = useState(artist.avatar_url || '')
  const [editBanner, setEditBanner] = useState(artist.banner_url || '')
  const [newGenreInput, setNewGenreInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const isOwner = currentUserId === artist.owner_user_id

  const startEditingChannel = () => {
    setEditName(artist.name || '')
    setEditHandle(artist.slug || '')
    setEditBio(artist.bio || '')
    setEditTags(profileTags)
    setEditAvatar(artist.avatar_url || '')
    setEditBanner(artist.banner_url || '')
    setIsEditingChannel(true)
  }

  const saveChannel = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: artist.id,
          channelId: artist.id,
          name: editName,
          slug: editHandle,
          bio: editBio,
          tags: editTags,
          avatar_url: editAvatar,
          banner_url: editBanner
        })
      })
      if (!response.ok) throw new Error('Failed to update channel')
      
      // Update local UI
      artist.name = editName
      artist.slug = editHandle.toLowerCase().replace(/[^a-z0-9_\-]/g, '')
      artist.bio = editBio
      setProfileTags(editTags)
      artist.avatar_url = editAvatar
      artist.banner_url = editBanner
      
      setProfileName(editName)
      setProfileHandle(editHandle.toLowerCase().replace(/[^a-z0-9_\-]/g, ''))
      setProfileBio(editBio)
      
      setIsEditingChannel(false)
    } catch (e) {
      console.error(e)
      alert("채널 수정 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChannelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentUserId}-${Date.now()}.${fileExt}`
      const filePath = `channel-avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setEditAvatar(publicUrl)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert("이미지 업로드에 실패했습니다.")
    }
  }

  const handleChannelBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${currentUserId}-banner-${Date.now()}.${fileExt}`
      const filePath = `channel-banners/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setEditBanner(publicUrl)
    } catch (error) {
      console.error('Error uploading banner:', error)
      alert("배너 업로드에 실패했습니다.")
    }
  }

  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
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
    try {
      const savedFollows = localStorage.getItem('profile-followed-artists')
      if (savedFollows) {
        const parsed = JSON.parse(savedFollows)
        const found = parsed.some((item: any) => item.id === artist.id)
        setIsFollowed(found)
      }
    } catch (e) {
      console.error(e)
    }
  }, [artist])

  const toggleFollowArtist = async () => {
    try {
      const savedFollowsRaw = localStorage.getItem('profile-followed-artists')
      let parsedFollows = savedFollowsRaw ? JSON.parse(savedFollowsRaw) : []
      const alreadyFollowed = parsedFollows.some((item: any) => item.id === artist.id)
      
      const nextFollowed = !alreadyFollowed
      setIsFollowed(nextFollowed)
      
      setProfileFollowers(prev => nextFollowed ? prev + 1 : Math.max(0, prev - 1))

      if (nextFollowed) {
        parsedFollows.push({
          id: artist.id,
          name: artist.name,
          slug: artist.slug || '',
          avatar_url: artist.avatar_url || '',
          bio: artist.bio || ''
        })
      } else {
        parsedFollows = parsedFollows.filter((item: any) => item.id !== artist.id)
      }
      localStorage.setItem('profile-followed-artists', JSON.stringify(parsedFollows))

      const { data: { user: myUser } } = await supabase.auth.getUser()
      if (myUser) {
        const extraKey = `profile-extra-${myUser.id}`
        const myExtraRaw = localStorage.getItem(extraKey)
        let myExtra = myExtraRaw ? JSON.parse(myExtraRaw) : {}
        let currentFollowing = myExtra.following !== undefined ? Number(myExtra.following) : 0
        myExtra.following = nextFollowed ? currentFollowing + 1 : Math.max(0, currentFollowing - 1)
        localStorage.setItem(extraKey, JSON.stringify(myExtra))
      }
    } catch (e) {
      console.error(e)
    }
  }

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
    const isMock = String(trackId).startsWith('dummy-') || String(trackId).startsWith('s') || String(trackId).startsWith('pop-') || String(trackId).startsWith('rock-');
    const isCurrentlyLiked = userLikes.includes(trackId);

    // Optimistic Update
    if (isCurrentlyLiked) {
      setUserLikes((prev) => {
        const next = prev.filter((id) => id !== trackId)
        localStorage.setItem('artist-liked-songs', JSON.stringify(next))
        return next
      })
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, like_count: Math.max(0, (t.like_count || 1) - 1) } : t))
      )
    } else {
      setUserLikes((prev) => {
        const next = [...prev, trackId]
        localStorage.setItem('artist-liked-songs', JSON.stringify(next))
        return next
      })
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, like_count: (t.like_count || 0) + 1 } : t))
      )
    }

    if (isMock) {
      return
    }

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId })
      })

      const data = await res.json()
      if (res.ok) {
        // Sync exact like count from server
        setTracks((prev) =>
          prev.map((t) => (t.id === trackId ? { ...t, like_count: data.like_count } : t))
        )
      }
    } catch (err) {
      console.error(err)
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

  const handlePlayTrack = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      setNowPlayingOpen(true)
      return
    }

    if (track.id.startsWith('dummy-') || track.file_url.startsWith('http')) {
      playTrack(track, tracks)
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
        file_url: data.signedUrl
      }

      playTrack(signedTrack, tracks)
      setNowPlayingOpen(true)
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

  const totalPlays = tracks.reduce((sum, track) => sum + (track.play_count || 0), 0) + Number(profilePlays)
  const totalLikes = tracks.reduce((sum, track) => sum + (track.like_count || 0), 0) + Number(profileLikes)

  if (artist.is_user || !isNeonEcho) {
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
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-primary/50 overflow-hidden shrink-0 bg-[#0e150e]">
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
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{profileName}</h1>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">@{profileHandle}</p>
                  <div className="flex gap-4 text-xs font-bold text-zinc-300 pt-1">
                    <span className="flex items-center gap-1"><Play className="w-3.5 h-3.5 fill-current text-primary" /> {totalPlays.toLocaleString()} Plays</span>
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 fill-current text-primary" /> {totalLikes.toLocaleString()} Likes</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 fill-current text-primary" /> {profileFollowers.toLocaleString()} Followers</span>
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
                  onClick={toggleFollowArtist}
                  className={`px-6 py-2.5 rounded-full text-xs font-extrabold transition-all duration-300 border backdrop-blur-sm ${
                    isFollowed 
                      ? 'bg-primary text-[#0b0c0b] border-primary' 
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
            {isOwner && (
              <>
                <div className="hidden md:flex items-center gap-4 border-l border-outline-variant/20 pl-4 ml-2">
                  <button 
                    onClick={() => router.push('/profile?tab=private')} 
                    className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-on-surface-variant hover:text-white`}
                  >
                    <Lock className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '관리 대시보드' : uiLanguage === 'JA' ? '管理ダッシュボード' : 'Admin Dashboard'}
                  </button>
                  <button 
                    onClick={() => router.push('/profile?tab=channels')} 
                    className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-on-surface-variant hover:text-white`}
                  >
                    <Users className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Manage Channels'}
                  </button>
                  <button 
                    onClick={() => {}} 
                    className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-primary font-extrabold`}
                  >
                    <Globe className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '아티스트 채널' : uiLanguage === 'JA' ? 'アーティストチャンネル' : 'Artist Channel'}
                  </button>
                </div>
                <button 
                  onClick={startEditingChannel}
                  className="hidden md:flex px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface text-xs font-bold rounded-xl items-center gap-2 transition-colors ml-2"
                >
                  <Pencil className="w-3.5 h-3.5 text-on-surface-variant" /> Edit Channel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Featured Showcase (Up to 2 tracks) */}
        {tracks.length > 0 && (
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tracks.slice(0, 2).map((song, index) => {
                const isPlayingThis = currentTrack?.id === song.id && isPlaying;
                return (
                  <div key={song.id} className="relative rounded-3xl border border-[#1b3a2a] shadow-2xl p-6 bg-gradient-to-r from-[#07140e] via-[#0b170f] to-[#050a06] flex flex-col sm:flex-row items-center gap-6 min-h-[180px] group">
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
                        className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all cursor-pointer ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        {isPlayingThis ? (
                          <div className="flex items-end justify-center gap-[3px] h-6 w-6">
                            <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                            <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                            <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background pl-1 shadow-md">
                            <Play className="w-5 h-5" />
                          </div>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                        <span className="text-[10px] font-extrabold text-[#e3fe06] bg-[#e3fe06]/10 border border-[#e3fe06]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                          FEATURED {index === 0 ? 'SINGLE' : 'TRACK'}
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
                        <div className="flex items-center justify-center gap-1">
                          <TrackDropdown
                            track={song}
                            myPlaylists={myPlaylists}
                            userLikes={userLikes}
                            uiLanguage={uiLanguage}
                            onLikeToggle={handleLikeToggle}
                            onSaveToPlaylist={handleSaveToPlaylist}
                          />
                        </div>
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
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight cursor-pointer group hover:text-primary transition-colors">
              {uiLanguage === 'KO' ? '음원 목록' : uiLanguage === 'JA' ? 'トラック一覧' : 'Songs'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tracks.map((song) => {
              const isCurrent = currentTrack?.id === song.id;
              const isPlayingThis = isCurrent && isPlaying;
              return (
                <div key={song.id} className={`bg-surface-container/40 hover:bg-surface-container-high/60 border border-outline-variant/10 p-3 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01] group shadow-sm ${isCurrent ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}>
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
                        className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all cursor-pointer ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        {isPlayingThis ? (
                          <div className="flex items-end justify-center gap-[3px] h-4 w-4">
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                          </div>
                        ) : (
                          <Play className="w-4 h-4 text-primary fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-sm font-bold truncate ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{song.title}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <span className="text-zinc-500 font-mono">▶</span> {song.play_count || 0}
                        </span>
                        <span>•</span>
                        <span>{song.album?.title || 'Single'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleLikeToggle(song.id); }}
                      className={`p-2 rounded-full hover:bg-white/5 transition-all shrink-0 cursor-pointer ${
                        userLikes.includes(song.id) ? 'text-primary' : 'text-zinc-500 hover:text-primary'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${userLikes.includes(song.id) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="flex items-center justify-center gap-1">
                      <TrackDropdown
                        track={song}
                        myPlaylists={myPlaylists}
                        userLikes={userLikes}
                        uiLanguage={uiLanguage}
                        onLikeToggle={handleLikeToggle}
                        onSaveToPlaylist={handleSaveToPlaylist}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {tracks.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-450 bg-white/[0.01] rounded-2xl border border-dashed border-outline-variant/10">
                {uiLanguage === 'KO' ? '등록된 음원이 없습니다.' : uiLanguage === 'JA' ? '登録されたトラックがありません。' : 'No registered tracks.'}
              </div>
            )}
          </div>
        </div>

        {/* Albums Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight cursor-pointer group hover:text-primary transition-colors">
              {uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {(albums || []).slice(0, 10).map((album) => (
              <AlbumCard key={album.id} album={album} variant="grid" />
            ))}
            {(!albums || albums.length === 0) && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                {uiLanguage === 'KO' ? '공개된 앨범이 없습니다.' : uiLanguage === 'JA' ? '公開されたアルバムがありません。' : 'No public albums.'}
              </div>
            )}
          </div>
        </div>

        {/* Playlists Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight cursor-pointer group hover:text-primary transition-colors">
              {uiLanguage === 'KO' ? '플레이리스트' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlists'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {(playlists || []).slice(0, 5).map((playlist) => {
              const tracksCount = playlist.tracks?.length || 0;
              return (
                <div 
                  key={playlist.id} 
                  className="bg-surface-container p-3 rounded-xl border border-outline-variant/10 shadow-sm flex flex-col gap-3 transition-all hover:bg-surface-container-high group hover:scale-[1.02] cursor-pointer relative"
                >
                  <div className="relative aspect-square w-full rounded-t-2xl rounded-b-lg overflow-hidden bg-surface-container-highest flex items-center justify-center border-t-8 border-primary/20 group-hover:opacity-80 transition-opacity">
                    <img 
                      src={playlist.cover_url || '/default-album.png'} 
                      alt="Cover" 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-album.png";
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">{playlist.title}</span>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                      <span>▶ {playlist.plays || tracksCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!playlists || playlists.length === 0) && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                {uiLanguage === 'KO' ? '공개된 플레이리스트가 없습니다.' : uiLanguage === 'JA' ? '公開されたプレイリストがありません。' : 'No public playlists.'}
              </div>
            )}
          </div>
        </div>

        {typeof window !== 'undefined' && document.body && isEditingChannel && createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
            <div className="bg-[#121214] border border-zinc-800/80 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="relative py-5 flex items-center justify-center border-b border-zinc-850/40">
                <h2 className="text-base font-extrabold text-white">{uiLanguage === 'KO' ? '채널 수정' : uiLanguage === 'JA' ? 'チャンネル編集' : 'Edit Channel'}</h2>
                <button 
                  onClick={() => setIsEditingChannel(false)} 
                  className="absolute right-4 w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    Background image <Info className="w-3.5 h-3.5 text-zinc-500" />
                  </label>
                  <div 
                    className="relative w-full h-44 bg-zinc-900/60 hover:bg-zinc-900 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer group overflow-hidden transition-colors"
                    onClick={() => document.getElementById('channel-banner-input')?.click()}
                  >
                    {editBanner ? (
                      <img src={editBanner} alt="Banner Preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-zinc-500 group-hover:text-primary transition-colors" />
                        <span className="text-xs text-zinc-400 font-medium">Upload a photo</span>
                      </>
                    )}
                    <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    <input id="channel-banner-input" type="file" accept="image/*" className="hidden" onChange={handleChannelBannerUpload} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    Channel picture <Info className="w-3.5 h-3.5 text-zinc-500" />
                  </label>
                  <div 
                    className="relative w-24 h-24 rounded-full cursor-pointer group overflow-visible shrink-0 self-start"
                    onClick={() => document.getElementById('channel-avatar-input')?.click()}
                  >
                    {editAvatar ? (
                      <img src={editAvatar} alt="Avatar Preview" className="w-24 h-24 rounded-full object-cover border border-zinc-800 shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                        <User className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </div>
                    <input id="channel-avatar-input" type="file" accept="image/*" className="hidden" onChange={handleChannelImageUpload} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400">Channel Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Xen Music"
                    className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-400">Add a bio</label>
                    <span className="text-[10px] font-medium text-zinc-500">{editBio?.length || 0}/1200</span>
                  </div>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value.slice(0, 1200))}
                    placeholder="Tell us about this channel..."
                    maxLength={1200}
                    className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors h-28 resize-none placeholder-zinc-600"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400">
                    Handle*
                    <span className="text-[10px] font-normal text-zinc-500 ml-2">(영문소문자, 숫자, _, - 만 가능)</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm font-medium text-zinc-500 font-mono">@</span>
                    <input 
                      type="text" 
                      value={editHandle}
                      onChange={(e) => setEditHandle(e.target.value)}
                      placeholder="xen_x"
                      required
                      className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 pl-7 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-400">Genres</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1 flex items-center">
                      <input 
                        type="text" 
                        value={newGenreInput}
                        onChange={(e) => setNewGenreInput(e.target.value.slice(0, 20))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newGenreInput.trim() && editTags.length < 5 && !editTags.includes(newGenreInput.trim())) {
                              setEditTags([...editTags, newGenreInput.trim()]);
                              setNewGenreInput('');
                            }
                          }
                        }}
                        placeholder="Type a genre..."
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600"
                      />
                      <span className="absolute right-3 text-[10px] text-zinc-500 font-medium">{newGenreInput.length}/20</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        if (newGenreInput.trim() && editTags.length < 5 && !editTags.includes(newGenreInput.trim())) {
                          setEditTags([...editTags, newGenreInput.trim()]);
                          setNewGenreInput('');
                        }
                      }}
                      disabled={!newGenreInput.trim() || editTags.length >= 5}
                      className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-sm font-bold text-white transition-all shrink-0"
                    >
                      Add
                    </button>
                  </div>
                  
                  {editTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editTags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300">
                          {tag}
                          <button 
                            type="button" 
                            onClick={() => setEditTags(editTags.filter(t => t !== tag))}
                            className="hover:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-zinc-850/40 flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditingChannel(false)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveChannel}
                  disabled={isSaving || !editName || !editHandle}
                  className="px-6 py-2.5 rounded-xl bg-primary text-[#080d08] text-sm font-extrabold hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/10 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                >
                  {isSaving ? 'Saving...' : 'Save Channel'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}

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
              {profileName}
            </h1>

            <p className="text-[10px] md:text-xs font-semibold text-on-surface-variant tracking-wide">
              {isNeonEcho ? '24,582,104 monthly listeners' : `${(artist.followers || 0).toLocaleString()} monthly listeners`}
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
                onClick={toggleFollowArtist}
                className={`px-6 py-3 rounded-full border border-white/20 font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${
                  isFollowed ? 'bg-white/10 text-white' : 'bg-transparent text-zinc-300 hover:border-white'
                }`}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
              <button className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant/10">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            
              {isOwner && (
                <>
                  <div className="hidden md:flex items-center gap-4 border-l border-outline-variant/20 pl-4 ml-2">
                    <button 
                      onClick={() => router.push('/profile?tab=private')} 
                      className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-on-surface-variant hover:text-white`}
                    >
                      <Lock className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '관리 대시보드' : uiLanguage === 'JA' ? '管理ダッシュボード' : 'Admin Dashboard'}
                    </button>
                    <button 
                      onClick={() => router.push('/profile?tab=channels')} 
                      className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-on-surface-variant hover:text-white`}
                    >
                      <Users className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Manage Channels'}
                    </button>
                    <button 
                      onClick={() => {}} 
                      className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-primary font-extrabold`}
                    >
                      <Globe className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '아티스트 채널' : uiLanguage === 'JA' ? 'アーティストチャンネル' : 'Artist Channel'}
                    </button>
                  </div>
                  <button 
                    onClick={startEditingChannel}
                    className="hidden md:flex px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface text-xs font-bold rounded-xl items-center gap-2 transition-colors ml-2"
                  >
                    <Pencil className="w-3.5 h-3.5 text-on-surface-variant" /> Edit Channel
                  </button>
                </>
              )}
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
                            <div className="flex items-end justify-center gap-[3px] h-3.5 w-3.5">
                              <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                              <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                              <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                            </div>
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
                      <div className="flex items-center justify-center gap-1 ml-2">
                        <TrackDropdown
                          track={track}
                          myPlaylists={myPlaylists}
                          userLikes={userLikes}
                          uiLanguage={uiLanguage}
                          onLikeToggle={handleLikeToggle}
                          onSaveToPlaylist={handleSaveToPlaylist}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-xs text-on-surface-variant/60 bg-white/[0.01] border border-dashed border-outline-variant/10 rounded-xl">
                {uiLanguage === 'KO' ? '등록된 음원이 없습니다.' : uiLanguage === 'JA' ? '登録されたトラックがありません。' : 'No registered tracks.'}
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
                  <img src={artist.avatar_url || "/images/media__1779823538571.png"} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-white/20">
                      <img src={portraitUrl} alt="" className="w-full h-full object-cover grayscale" />
                    </span>
                    <span className="text-[9px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Posted by {profileName || 'Artist'}</span>
                  </div>
                  <p className="font-extrabold text-xs text-on-surface truncate">{profileName || 'Artist'}: Best Of</p>
                  <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Playlist</p>
                </div>
              </div>
            </div>
          )}

          {/* About */}
          {((artist.is_user ? profileBio : artist.bio) || isNeonEcho) && (
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
                      : artist.bio || (isNeonEcho
                        ? 'Neon Echo is a genre-defying visionary blending cinematic soundscapes with driving electronic beats. Based in London,...'
                        : '등록된 채널 소개가 없습니다.')}
                  </p>
                  <button className="text-[10px] font-bold uppercase text-white hover:text-primary tracking-widest transition-colors">
                    Read more
                  </button>
                </div>
              </div>
            </div>
          )}

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
              <AlbumCard key={album.id} album={album} variant="grid" />
            ))}
          </div>
        </section>
      )}



      </div>
    </div>
  )
}
