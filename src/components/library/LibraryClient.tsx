'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Track } from '@/types/music'
import { Play, Pause, Heart, Music, Disc, ListMusic, ArrowLeft, MoreHorizontal, Clock, Check, X } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils'

interface LibraryClientProps {
  initialLikedTracks: Track[]
  isLoggedIn: boolean
}

// Dummy premium tracks for premium aesthetic fallback
const DUMMY_PLAYLIST: any[] = [
  {
    id: 'dummy-1',
    title: 'Electric Dreams',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 222,
    like_count: 342109,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-1',
    album: {
      id: 'dummy-album-1',
      title: 'Electric Dreams',
      cover_url: 'https://images.unsplash.com/photo-1564186763535-ebb21ec52744?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-1',
      artist: {
        id: 'dummy-artist-1',
        name: 'Neon Echo',
        slug: 'neonecho',
        avatar_url: '',
        bio: '',
        created_at: ''
      }
    }
  },
  {
    id: 'dummy-2',
    title: 'Midnight Pulse',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 255,
    like_count: 289551,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-2',
    album: {
      id: 'dummy-album-2',
      title: 'Midnight Pulse',
      cover_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-1',
      artist: {
        id: 'dummy-artist-1',
        name: 'Neon Echo',
        slug: 'neonecho',
        avatar_url: '',
        bio: '',
        created_at: ''
      }
    }
  },
  {
    id: 'dummy-3',
    title: 'Shadow Dance',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 198,
    like_count: 158003,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-3',
    album: {
      id: 'dummy-album-3',
      title: 'Shadow Dance',
      cover_url: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-1',
      artist: {
        id: 'dummy-artist-1',
        name: 'Neon Echo',
        slug: 'neonecho',
        avatar_url: '',
        bio: '',
        created_at: ''
      }
    }
  }
]

// Dummy Top 100 details matching mockup
const DUMMY_TOP_100: any[] = [
  {
    id: 'dummy-top-1',
    title: 'Neon Nights',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 222,
    like_count: 342109,
    status: 'published',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    album_id: 'dummy-album-top-1',
    album: {
      id: 'dummy-album-top-1',
      title: 'Digital Horizons',
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=350&auto=format&fit=crop',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-1',
      artist: { id: 'artist-1', name: 'Ether Pulse', slug: 'ether_pulse', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-top-2',
    title: 'After Hours',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 255,
    like_count: 289551,
    status: 'published',
    created_at: new Date(2023, 9, 12).toISOString(),
    album_id: 'dummy-album-top-2',
    album: {
      id: 'dummy-album-top-2',
      title: 'Velvet Sky',
      cover_url: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?q=80&w=350&auto=format&fit=crop',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'artist-2',
      artist: { id: 'artist-2', name: 'Luna Shadows', slug: 'luna_shadows', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-top-3',
    title: 'Static Waves',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 178,
    like_count: 158003,
    status: 'published',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    album_id: 'dummy-album-top-3',
    album: {
      id: 'dummy-album-top-3',
      title: 'Frequency Shift',
      cover_url: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'artist-3',
      artist: { id: 'artist-3', name: 'The Resonance', slug: 'the_resonance', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-top-4',
    title: 'Midnight City',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 312,
    like_count: 94332,
    status: 'published',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    album_id: 'dummy-album-top-4',
    album: {
      id: 'dummy-album-top-4',
      title: 'Metropolis Echoes',
      cover_url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?q=80&w=350&auto=format&fit=crop',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-4',
      artist: { id: 'artist-4', name: 'Urban Pulse', slug: 'urban_pulse', avatar_url: '', bio: '', created_at: '' }
    }
  }
]

// Curated dummy recommended tracks for MZ generation
const DUMMY_RECOMMENDED_PLAYLIST: any[] = [
  {
    id: 'dummy-rec-1',
    title: 'Neon Tokyo Odyssey',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 218,
    like_count: 512994,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-rec-1',
    album: {
      id: 'dummy-album-rec-1',
      title: 'Neon Odyssey',
      cover_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-rec-1',
      artist: { id: 'dummy-artist-rec-1', name: 'Shibuya Sound System', slug: 'shibuya_sound', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-rec-2',
    title: 'Shining Star',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration_sec: 195,
    like_count: 489221,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-rec-2',
    album: {
      id: 'dummy-album-rec-2',
      title: 'K-Pop Spark',
      cover_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-rec-2',
      artist: { id: 'dummy-artist-rec-2', name: 'AURA', slug: 'aura_kpop', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-rec-3',
    title: 'Sakura Petals',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    duration_sec: 242,
    like_count: 320119,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-rec-3',
    album: {
      id: 'dummy-album-rec-3',
      title: 'Spring in Kyoto',
      cover_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-rec-3',
      artist: { id: 'dummy-artist-rec-3', name: 'Haruka', slug: 'haruka_jpop', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-rec-4',
    title: 'Cyberpunk City',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    duration_sec: 205,
    like_count: 298511,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-rec-4',
    album: {
      id: 'dummy-album-rec-4',
      title: 'Grid Runner',
      cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-rec-4',
      artist: { id: 'dummy-artist-rec-4', name: 'Vector Void', slug: 'vector_void', avatar_url: '', bio: '', created_at: '' }
    }
  },
  {
    id: 'dummy-rec-5',
    title: 'Deep Blue Sea',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    duration_sec: 290,
    like_count: 187422,
    status: 'published',
    created_at: new Date().toISOString(),
    album_id: 'dummy-album-rec-5',
    album: {
      id: 'dummy-album-rec-5',
      title: 'Abyss',
      cover_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'dummy-artist-rec-5',
      artist: { id: 'dummy-artist-rec-5', name: 'Marina', slug: 'marina_ambient', avatar_url: '', bio: '', created_at: '' }
    }
  }
]

export function LibraryClient({
  initialLikedTracks,
  isLoggedIn
}: LibraryClientProps) {
  const [likedTracks, setLikedTracks] = useState<Track[]>(initialLikedTracks)
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const playlistIdParam = searchParams.get('playlistId')

  useEffect(() => {
    if (playlistIdParam) {
      setSelectedPlaylist(playlistIdParam)
    } else {
      setSelectedPlaylist(null)
    }
  }, [playlistIdParam])
  
  // Custom playlists CRUD states
  const [customPlaylists, setCustomPlaylists] = useState<any[]>([])
  
  // Edit playlist modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editPlaylistId, setEditPlaylistId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [editGenre, setEditGenre] = useState('')

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()
  const supabase = createClient()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLang = localStorage.getItem('language')
    if (storedLang) {
      setUiLanguage(storedLang.toUpperCase())
    }

    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        setUiLanguage(customEvent.detail)
      }
    }
    window.addEventListener('languageChange', handleLangChange)
    return () => window.removeEventListener('languageChange', handleLangChange)
  }, [])

  // Load liked songs from localStorage on mount
  useEffect(() => {
    try {
      const savedLikes = localStorage.getItem('profile-liked-songs')
      if (savedLikes) {
        const parsed = JSON.parse(savedLikes) as Track[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLikedTracks(prev => {
            const merged = [...prev];
            parsed.forEach(track => {
              if (!merged.some(t => t.id === track.id)) {
                merged.push(track);
              }
            });
            return merged;
          });
        }
      }
    } catch (e) {
      console.error('Error loading profile-liked-songs in LibraryClient:', e)
    }
  }, [])

  // Load custom playlists from server database on mount
  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const res = await fetch('/api/playlists')
        if (res.ok) {
          const data = await res.json()
          setCustomPlaylists(data || [])
        }
      } catch (e) {
        console.error('Error loading playlists from server:', e)
      }
    }
    loadPlaylists()
  }, [])

  const handleCreatePlaylist = async () => {
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uiLanguage === 'KO' ? `새 플레이리스트 #${customPlaylists.length + 1}` : `New Playlist #${customPlaylists.length + 1}`,
          description: serializePlaylistDescription('playlist', uiLanguage === 'KO' ? '보관함 폴더 설명입니다.' : 'A folder for your curated music.'),
          cover_url: '/images/top100_cover.png',
          genre: 'Pop'
        })
      })

      if (res.ok) {
        const newPlaylist = await res.json()
        setCustomPlaylists(prev => [...prev, newPlaylist])
        setSelectedPlaylist(newPlaylist.id)
      } else {
        const errData = await res.json()
        alert(`플레이리스트 생성에 실패했습니다: ${errData.error || 'Server Error'}`)
      }
    } catch (e) {
      console.error('Error creating playlist:', e)
    }
  }

  const handleSaveEdit = async () => {
    if (!editPlaylistId) return

    try {
      const original = customPlaylists.find(p => p.id === editPlaylistId)
      const originalType = original ? parsePlaylistDescription(original.description).type : 'playlist'
      const descriptionToSave = serializePlaylistDescription(originalType, editDescription)

      const res = await fetch(`/api/playlists/${editPlaylistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: descriptionToSave,
          cover_url: editCoverUrl,
          genre: editGenre
        })
      })

      if (res.ok) {
        const updatedPlaylist = await res.json()
        setCustomPlaylists(prev => prev.map(cp => 
          cp.id === editPlaylistId ? updatedPlaylist : cp
        ))
        setIsEditModalOpen(false)
      } else {
        const errData = await res.json()
        alert(`플레이리스트 수정에 실패했습니다: ${errData.error || 'Server Error'}`)
      }
    } catch (e) {
      console.error('Error updating playlist:', e)
    }
  }

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm(uiLanguage === 'KO' ? '정말로 이 보관함 폴더를 삭제하시겠습니까?' : 'Are you sure you want to delete this folder?')) {
      return
    }

    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setCustomPlaylists(prev => prev.filter(cp => cp.id !== id))
        setSelectedPlaylist(null)
      } else {
        const errData = await res.json()
        alert(`플레이리스트 삭제에 실패했습니다: ${errData.error || 'Server Error'}`)
      }
    } catch (e) {
      console.error('Error deleting playlist:', e)
    }
  }

  const handleOpenEdit = (pl: any) => {
    const { text } = parsePlaylistDescription(pl.description)
    setEditPlaylistId(pl.id)
    setEditTitle(pl.title)
    setEditDescription(text)
    setEditCoverUrl(pl.cover_url)
    setEditGenre(pl.genre || '')
    setIsEditModalOpen(true)
  }

  const handlePlay = async (track: Track, list: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.id.startsWith('dummy-') || track.file_url.startsWith('http')) {
      playTrack(track, list)
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
      playTrack(signedTrack, list)
    } catch (err) {
      console.error(err)
      alert('음원 재생 주소를 발급받지 못했습니다.')
    }
  }

  const handleUnlike = async (trackId: string) => {
    // 1. Remove from local storage keys
    try {
      const savedLikesStr = localStorage.getItem('profile-liked-songs')
      if (savedLikesStr) {
        const savedLikes = JSON.parse(savedLikesStr) as any[]
        const updatedLikes = savedLikes.filter(t => t.id !== trackId)
        localStorage.setItem('profile-liked-songs', JSON.stringify(updatedLikes))
      }
      const savedIdsStr = localStorage.getItem('profile-liked-song-ids')
      if (savedIdsStr) {
        const savedIds = JSON.parse(savedIdsStr) as string[]
        const updatedIds = savedIds.filter(id => id !== trackId)
        localStorage.setItem('profile-liked-song-ids', JSON.stringify(updatedIds))
      }
    } catch (e) {
      console.error('Error updating localStorage on unlike:', e)
    }

    // 2. Remove from state
    setLikedTracks((prev) => prev.filter((t) => t.id !== trackId))

    // 3. Optional DB call for real tracks
    if (
      trackId.startsWith('dummy-') || 
      trackId.startsWith('sample-') || 
      trackId.startsWith('hook-') || 
      trackId.startsWith('featured-')
    ) {
      return
    }

    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId })
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Define Playlists folders
  const systemPlaylists = [
    {
      id: 'liked',
      title: uiLanguage === 'KO' ? '좋아요 표시한 음악' : 'Liked Songs',
      description: uiLanguage === 'KO' ? '내가 좋아하는 곡 보관함' : 'Your liked tracks',
      cover_url: '/images/liked_cover.png',
      tracks: (likedTracks.length > 0 ? likedTracks : DUMMY_PLAYLIST) as Track[],
      type: 'PLAYLIST',
      isSystem: true,
      genre: '',
      stats: uiLanguage === 'KO' 
        ? `회원님이 직접 만든 보관함 • ${likedTracks.length || DUMMY_PLAYLIST.length}곡` 
        : `Created by you • ${likedTracks.length || DUMMY_PLAYLIST.length} songs`
    },
    {
      id: 'top100',
      title: 'Real-time TOP 100',
      description: uiLanguage === 'KO' ? '실시간 가장 인기 있는 AI 100곡' : 'Real-time most popular tracks',
      cover_url: '/images/top100_cover.png',
      tracks: DUMMY_TOP_100 as Track[],
      type: 'PLAYLIST',
      isSystem: true,
      genre: '',
      stats: 'Updated 12 mins ago • 100 songs, 6 hr 14 min'
    },
    {
      id: 'recommended',
      title: uiLanguage === 'KO' ? '추천 플레이리스트' : 'Recommended Playlist',
      description: uiLanguage === 'KO' ? 'BEATZ가 추천하는 MZ 세대 취향 저격 트랙' : 'Curated recommendations for you',
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=350&h=350&q=80',
      tracks: DUMMY_RECOMMENDED_PLAYLIST as Track[],
      type: 'PLAYLIST',
      isSystem: true,
      genre: '',
      stats: uiLanguage === 'KO' ? '매일 새로운 추천 • 10곡' : 'Refreshed daily • 10 songs'
    }
  ]

  const playlists = [
    ...systemPlaylists,
    ...customPlaylists.map(cp => ({
      id: cp.id,
      title: uiLanguage === 'KO' ? (cp.titleKo || cp.title) : cp.title,
      description: uiLanguage === 'KO' ? (cp.descriptionKo || cp.description) : cp.description,
      cover_url: cp.cover_url,
      tracks: (cp.tracks && cp.tracks.length > 0 ? cp.tracks : DUMMY_PLAYLIST) as Track[],
      type: 'PLAYLIST',
      isSystem: false,
      genre: cp.genre || '',
      stats: cp.stats || (uiLanguage === 'KO' 
        ? `보관함 폴더 • ${cp.tracks?.length || DUMMY_PLAYLIST.length}곡` 
        : `Library folder • ${cp.tracks?.length || DUMMY_PLAYLIST.length} songs`)
    }))
  ]

  const activePlaylist = playlists.find(p => p.id === selectedPlaylist)

  // Relative Date added formatter
  const formatDateAdded = (dateStr: string, id: string) => {
    if (id === 'dummy-top-1') return uiLanguage === 'KO' ? '2일 전' : '2 days ago'
    if (id === 'dummy-top-2') return 'Oct 12, 2023'
    if (id === 'dummy-top-3') return uiLanguage === 'KO' ? '어제' : 'Yesterday'
    if (id === 'dummy-top-4') return uiLanguage === 'KO' ? '5일 전' : '5 days ago'
    
    return uiLanguage === 'KO' ? '최근 추가됨' : 'Recently added'
  }

  // Rank shift details for Top 100 mockup
  const renderRankShift = (id: string, index: number) => {
    if (id === 'dummy-top-1') {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[12px] leading-tight text-white">{index + 1}</span>
          <span className="text-[9px] font-bold text-primary flex items-center gap-0.5 leading-none mt-0.5">▲ 2</span>
        </div>
      )
    }
    if (id === 'dummy-top-2') {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[12px] leading-tight text-white">{index + 1}</span>
          <span className="text-[9px] font-bold text-red-500 flex items-center gap-0.5 leading-none mt-0.5">▼ 1</span>
        </div>
      )
    }
    if (id === 'dummy-top-3') {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[12px] leading-tight text-white">{index + 1}</span>
          <span className="text-[7px] font-black text-red-500 leading-none bg-red-500/10 px-1 py-0.5 rounded uppercase mt-0.5 scale-90">NEW</span>
        </div>
      )
    }
    if (id === 'dummy-top-4') {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[12px] leading-tight text-white">{index + 1}</span>
          <span className="text-[10px] font-bold text-on-surface-variant/40 leading-none mt-0.5">-</span>
        </div>
      )
    }
    return <span className="text-[12px] text-on-surface-variant/60">{index + 1}</span>
  }

  return (
    <div className="max-w-7xl mx-auto px-[32px] py-8 text-on-surface font-sans">
      
      {!selectedPlaylist ? (
        // 1. Folders List View (Initial state)
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                <ListMusic className="w-2.5 h-2.5 text-primary" />
              </span>
              <h1 className="text-sm font-black uppercase tracking-widest text-on-surface">
                {uiLanguage === 'KO' ? '보관함 플레이리스트' : 'Library Playlists'}
              </h1>
            </div>
            <button
              onClick={handleCreatePlaylist}
              className="px-4 py-2 rounded-full bg-primary text-black font-extrabold text-[10px] uppercase tracking-wider hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg shadow-primary/10"
            >
              {uiLanguage === 'KO' ? '+ 새 플레이리스트' : '+ New Playlist'}
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setSelectedPlaylist(pl.id)}
                className="bg-[#111a12]/60 border border-emerald-950/15 hover:border-primary/30 hover:bg-[#111a12] p-3 rounded-xl flex flex-col group shadow-md text-left transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* Album Jacket Container */}
                <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-[#111a12] to-[#070b08] border border-outline-variant/20 shadow-md flex items-center justify-center select-none group-hover:shadow-primary/5 transition-all duration-300">
                  <Music className="w-6 h-6 text-on-surface-variant/25 absolute" />
                  <img
                    src={pl.cover_url}
                    alt={pl.title}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-20">
                    <div className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg shadow-primary/20">
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-0.5 w-full pt-0.5">
                  <p className="font-bold text-[11px] truncate text-on-surface group-hover:text-primary transition-colors">
                    {pl.title}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/80 truncate font-semibold leading-normal">
                    {parsePlaylistDescription(pl.description).text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // 2. Playlist Detail View (Mockup-identical State)
        activePlaylist && (
          <div className="space-y-8">
            
            {/* Back Button */}
            <button 
              onClick={() => setSelectedPlaylist(null)}
              className="inline-flex items-center gap-2 text-xs font-black text-on-surface-variant hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {uiLanguage === 'KO' ? '보관함 목록으로' : 'Back to Library'}
            </button>

            {/* Spotify-style Header with Gradient Backdrop */}
            <div className="-mx-[32px] px-[32px] pt-4 pb-6 bg-gradient-to-b from-[#0d2516] via-[#0e150e]/60 to-[#0e150e] rounded-t-3xl border-t border-emerald-950/15">
              <section className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 pb-4">
                <div className="h-48 w-48 md:h-60 md:w-60 rounded-2xl overflow-hidden bg-gradient-to-br from-[#111a12] to-[#070b08] border border-outline-variant/10 shadow-2xl shrink-0 select-none relative flex items-center justify-center">
                  <Music className="w-12 h-12 text-on-surface-variant/25 absolute" />
                  <img 
                    src={activePlaylist.cover_url} 
                    alt="" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="absolute inset-0 h-full w-full object-cover z-10" 
                  />
                </div>

                <div className="space-y-3 text-center md:text-left flex-1">
                  <div className="flex justify-center md:justify-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-[#e3fe06]/10 border border-[#e3fe06]/25 px-3 py-1 rounded-full w-fit leading-none">
                      PLAYLIST
                    </span>
                  </div>
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none">
                    {activePlaylist.title}
                  </h1>
                  <p className="text-xs text-on-surface-variant/80 font-bold tracking-wide">
                    {activePlaylist.stats} {activePlaylist.genre && `• ${activePlaylist.genre}`}
                  </p>

                  {/* Actions Row */}
                  <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                    <button
                      onClick={() => handlePlay(activePlaylist.tracks[0], activePlaylist.tracks)}
                      disabled={activePlaylist.tracks.length === 0}
                      className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-primary text-[#080d08] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current stroke-[2px] text-[#080d08]" />
                      Play All
                    </button>
                    <button className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-on-surface-variant hover:text-white transition-all cursor-pointer hover:border-white">
                      <Heart className="w-5 h-5" />
                    </button>
                    <button className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center text-on-surface-variant hover:text-white transition-all cursor-pointer hover:border-white">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {/* Custom playlist controls */}
                    {!activePlaylist.isSystem && (
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={() => handleOpenEdit(activePlaylist)}
                          className="h-10 px-4 rounded-full border border-white/20 text-xs font-bold text-on-surface-variant hover:text-white transition-all cursor-pointer hover:border-white"
                        >
                          {uiLanguage === 'KO' ? '편집' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDeletePlaylist(activePlaylist.id)}
                          className="h-10 px-4 rounded-full border border-red-500/20 text-xs font-bold text-red-400 hover:text-red-300 hover:border-red-500/50 transition-all cursor-pointer"
                        >
                          {uiLanguage === 'KO' ? '삭제' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Playlist Tracks Table (Sitting directly on the background, no border-box container) */}
            <div className="pt-4">
              <table className="w-full text-left text-xs text-on-surface-variant">
                <thead>
                  <tr className="border-b border-outline-variant/10 text-on-surface-variant/80 font-extrabold uppercase tracking-wider text-[10px] pb-4">
                    <th className="pb-3 px-4 w-12 text-center">#</th>
                    <th className="pb-3 px-4">{uiLanguage === 'KO' ? '제목' : 'TITLE'}</th>
                    <th className="pb-3 px-4">{uiLanguage === 'KO' ? '앨범' : 'ALBUM'}</th>
                    <th className="pb-3 px-4 w-32">{uiLanguage === 'KO' ? '추가된 날짜' : 'DATE ADDED'}</th>
                    <th className="pb-3 px-4 w-20 text-right">
                      <Clock className="w-4 h-4 ml-auto" />
                    </th>
                    <th className="pb-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {activePlaylist.tracks.map((track, index) => {
                    const isCurrent = currentTrack?.id === track.id
                    return (
                      <tr
                        key={track.id}
                        className={`border-b border-outline-variant/5 last:border-0 hover:bg-white/[0.02] transition-all group ${
                          isCurrent ? 'bg-primary/10' : ''
                        }`}
                      >
                        {/* Index / Rank Shift */}
                        <td className="py-4 px-4 text-center font-mono font-bold text-on-surface-variant/80">
                          <span className={isCurrent && isPlaying ? "text-primary font-bold" : ""}>
                            {activePlaylist.id === 'top100' ? renderRankShift(track.id, index) : index + 1}
                          </span>
                        </td>

                        {/* Title / Artist Info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="h-10 w-10 bg-gradient-to-br from-[#111a12] to-[#070b08] border border-outline-variant/10 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center cursor-pointer group/cover"
                              onClick={() => handlePlay(track, activePlaylist.tracks)}
                            >
                              <Music className="w-4 h-4 text-on-surface-variant/25 absolute" />
                              {track.album?.cover_url && (
                                <img
                                  src={track.album.cover_url}
                                  alt=""
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  className="absolute inset-0 h-full w-full object-cover z-10"
                                />
                              )}
                              {/* Hover Play/Pause Overlay */}
                              <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all z-20 ${
                                isCurrent && isPlaying
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}>
                                {isCurrent && isPlaying ? (
                                  <Pause className="w-4 h-4 text-white fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className={`font-bold text-xs truncate transition-colors ${isCurrent ? 'text-primary' : 'text-on-surface group-hover:text-white'}`}>
                                {track.title}
                              </p>
                              <p className="text-[10px] text-on-surface-variant truncate mt-0.5 font-medium">{track.album?.artist?.name}</p>
                            </div>
                          </div>
                        </td>

                        {/* Album Name */}
                        <td className="py-4 px-4 text-on-surface-variant font-medium">
                          {track.album?.title || '-'}
                        </td>

                        {/* Date Added */}
                        <td className="py-4 px-4 text-on-surface-variant/80 font-bold">
                          {formatDateAdded(track.created_at || '', track.id)}
                        </td>

                        {/* Duration */}
                        <td className="py-4 px-4 text-right font-mono text-on-surface-variant/60 font-bold">
                          {track.duration_sec
                            ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}`
                            : '-'}
                        </td>

                        {/* Unlike/Remove Option */}
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleUnlike(track.id)}
                            className="text-primary hover:text-red-400 hover:scale-105 active:scale-95 transition-all p-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer"
                            title={uiLanguage === 'KO' ? '보관함에서 제거' : 'Remove from Library'}
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Edit Playlist Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#111a12] border border-emerald-950/40 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                {uiLanguage === 'KO' ? '보관함 폴더 편집' : 'Edit Library Folder'}
              </h3>
              <p className="text-[10px] text-on-surface-variant/80 font-bold">
                {uiLanguage === 'KO' ? '폴더의 정보와 커버 이미지를 변경합니다.' : 'Modify folder details and cover art.'}
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  {uiLanguage === 'KO' ? '폴더 이름' : 'Folder Name'}
                </label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#070b08] border border-emerald-950/30 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder={uiLanguage === 'KO' ? '이름을 입력하세요' : 'Enter folder name'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  {uiLanguage === 'KO' ? '폴더 설명' : 'Description'}
                </label>
                <textarea 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-[#070b08] border border-emerald-950/30 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  placeholder={uiLanguage === 'KO' ? '설명을 입력하세요' : 'Enter folder description'}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  {uiLanguage === 'KO' ? '장르 카테고리' : 'Genre Category'}
                </label>
                <select
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  className="w-full bg-[#070b08] border border-emerald-950/30 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">{uiLanguage === 'KO' ? '장르 선택' : 'Select Genre'}</option>
                  {['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'City Pop', 'Trot', 'Ballad', 'Dance', 'Folk', 'Other'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                  {uiLanguage === 'KO' ? '커버 이미지 URL' : 'Cover Image URL'}
                </label>
                <input 
                  type="text" 
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  className="w-full bg-[#070b08] border border-emerald-950/30 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="https://images.unsplash.com/..."
                />
                
                {/* Preset suggestions */}
                <div className="pt-2">
                  <span className="text-[9px] font-black uppercase text-on-surface-variant/60 tracking-wider block mb-1.5">
                    {uiLanguage === 'KO' ? '추천 프리셋 커버' : 'Suggested Preset Covers'}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditCoverUrl('/images/top100_cover.png')}
                      className="px-2.5 py-1 rounded bg-[#070b08] border border-emerald-950/20 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      Neon Wave
                    </button>
                    <button 
                      onClick={() => setEditCoverUrl('/images/liked_cover.png')}
                      className="px-2.5 py-1 rounded bg-[#070b08] border border-emerald-950/20 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      Neon Heart
                    </button>
                    <button 
                      onClick={() => setEditCoverUrl('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop')}
                      className="px-2.5 py-1 rounded bg-[#070b08] border border-emerald-950/20 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      Acoustic
                    </button>
                    <button 
                      onClick={() => setEditCoverUrl('https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=350&auto=format&fit=crop')}
                      className="px-2.5 py-1 rounded bg-[#070b08] border border-emerald-950/20 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer"
                    >
                      Chill Piano
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-full border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface-variant hover:text-white transition-all cursor-pointer"
              >
                {uiLanguage === 'KO' ? '취소' : 'Cancel'}
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={!editTitle.trim()}
                className="px-6 py-2 rounded-full bg-primary text-black text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-primary/10"
              >
                {uiLanguage === 'KO' ? '저장' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
