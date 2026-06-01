'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Track } from '@/types/music'
import { Play, Pause, Heart, Music, Disc, ListMusic, ArrowLeft, MoreHorizontal, Clock, Check, X, Globe, Lock, Upload, Plus, Edit2, Trash2, Download } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'
import { AlbumCard } from '@/components/common/AlbumCard'


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
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

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
  const [editIsPublished, setEditIsPublished] = useState(false)
  const [editExposureOrder, setEditExposureOrder] = useState<number | ''>('')
  const [likedAlbums, setLikedAlbums] = useState<string[]>([])
  const [likedAlbumsData, setLikedAlbumsData] = useState<any[]>([])

  // User tracks (from song_history) and track menu
  const [userTracks, setUserTracks] = useState<any[]>([])
  const [trackProfiles, setTrackProfiles] = useState<Record<string, any>>({})
  const [openPlaylistTrackMenuId, setOpenPlaylistTrackMenuId] = useState<string | null>(null)

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive: boolean;
    showGenreSelect?: boolean;
    onConfirm: (selectedGenre?: string) => void;
  } | null>(null)
  const [publishGenre, setPublishGenre] = useState('')
  const [isUploadingCover, setIsUploadingCover] = useState(false)

  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
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

  // Load liked songs and liked albums from localStorage on mount
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

      const savedAlbums = localStorage.getItem('user_liked_albums')
      if (savedAlbums) {
        setLikedAlbums(JSON.parse(savedAlbums))
      }
    } catch (e) {
      console.error('Error loading localStorage keys in LibraryClient:', e)
    }
  }, [])

  const handleAlbumLikeToggle = (albumId: string) => {
    let next: string[]
    if (likedAlbums.includes(albumId)) {
      next = likedAlbums.filter((id) => id !== albumId)
    } else {
      next = [...likedAlbums, albumId]
    }
    setLikedAlbums(next)
    localStorage.setItem('user_liked_albums', JSON.stringify(next))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'))
    }
  }

  useEffect(() => {
    const fetchAlbums = async () => {
      if (likedAlbums.length === 0) {
        setLikedAlbumsData([])
        return
      }
      try {
        const { data } = await supabase.from('user_playlists').select('*').in('id', likedAlbums)
        if (data) {
          setLikedAlbumsData(data)
        }
      } catch (e) {
        console.error('Failed to fetch liked albums:', e)
      }
    }
    fetchAlbums()
  }, [likedAlbums])

  // Helper to show custom toast message
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 2500)
  }

  // Load custom playlists from server database
  const fetchPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists?type=playlist')
      if (res.ok) {
        const data = await res.json()
        setCustomPlaylists(data || [])
      }
    } catch (e) {
      console.error('Error loading playlists from server:', e)
    }
  }

  // Fetch user tracks from song_history
  const fetchUserTracks = async () => {
    if (!isLoggedIn) return
    try {
      const res = await fetch('/api/song-history')
      if (res.ok) {
        const rawData = await res.json() || []
        const completedData = rawData.filter((song: any) => song.audio_url || song.file_url)
        completedData.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        setUserTracks(completedData)
        
        const userIds = Array.from(new Set(completedData.map((song: any) => song.user_id).filter(Boolean))) as string[]
        if (userIds.length > 0) {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_url')
            .in('id', userIds)
          
          if (!error && profiles) {
            const profileMap: Record<string, any> = {}
            profiles.forEach((p: any) => {
              profileMap[p.id] = p
            })
            setTrackProfiles(profileMap)
          }
        }
      }
    } catch (e) {
      console.error('Error fetching user tracks:', e)
    }
  }

  // Global click listener to close track menu
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenPlaylistTrackMenuId(null)
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  useEffect(() => {
    fetchPlaylists()
    fetchUserTracks()
  }, [isLoggedIn])

  const handleOpenCreate = () => {
    setEditPlaylistId(null)
    setEditTitle('')
    setEditDescription('')
    setEditCoverUrl('')
    setEditGenre('')
    setEditIsPublished(false)
    setEditExposureOrder('')
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    try {
      if (!editPlaylistId) {
        // Create Playlist Flow
        const res = await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editTitle,
            description: serializePlaylistDescription('playlist', editDescription),
            cover_url: editCoverUrl || '/images/top100_cover.png',
            genre: editGenre,
            is_published: editIsPublished,
            exposure_order: editExposureOrder === '' ? null : Number(editExposureOrder)
          })
        })

        if (res.ok) {
          const newPlaylist = await res.json()
          await fetchPlaylists()
          setIsEditModalOpen(false)
          setSelectedPlaylist(newPlaylist.id)
          showToast(uiLanguage === 'KO' ? '플레이리스트가 생성되었습니다.' : uiLanguage === 'JA' ? 'プレイリストが作成されました。' : 'Playlist created.', 'success')
        } else {
          const errData = await res.json()
          showToast(`플레이리스트 생성에 실패했습니다: ${errData.error || 'Server Error'}`, 'error')
        }
      } else {
        // Edit Playlist Flow
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
            genre: editGenre,
            is_published: editIsPublished,
            exposure_order: editExposureOrder === '' ? null : Number(editExposureOrder)
          })
        })

        if (res.ok) {
          await fetchPlaylists()
          setIsEditModalOpen(false)
          showToast(uiLanguage === 'KO' ? '플레이리스트 정보가 수정되었습니다.' : uiLanguage === 'JA' ? 'プレイリストの詳細が更新されました。' : 'Playlist details updated.', 'success')
        } else {
          const errData = await res.json()
          showToast(`플레이리스트 수정에 실패했습니다: ${errData.error || 'Server Error'}`, 'error')
        }
      }
    } catch (e) {
      console.error('Error saving playlist:', e)
      showToast(uiLanguage === 'KO' ? '저장 중 오류가 발생했습니다.' : uiLanguage === 'JA' ? 'プレイリストの保存エラー。' : 'Error saving playlist.', 'error')
    }
  }

  const handleDeletePlaylist = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: uiLanguage === 'KO' ? '플레이리스트 삭제' : uiLanguage === 'JA' ? 'プレイリストを削除' : 'Delete Playlist',
      message: uiLanguage === 'KO'
        ? '정말로 이 플레이리스트를 삭제하시겠습니까? 플레이리스트는 삭제되지만 안에 들어있는 음원들은 삭제되지 않고 보관함에 보존됩니다.'
        : uiLanguage === 'JA' ? '本当にこのプレイリストを削除しますか？プレイリストは削除されますが、中のトラックは削除されず保存されます。' : 'Are you sure you want to delete this playlist? The playlist will be deleted, but the tracks inside it will not be deleted and will be preserved.',
      confirmText: uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete',
      cancelText: uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/playlists/${id}`, {
            method: 'DELETE'
          })

          if (res.ok) {
            await fetchPlaylists()
            setSelectedPlaylist(null)
            showToast(uiLanguage === 'KO' ? '플레이리스트가 삭제되었습니다.' : uiLanguage === 'JA' ? 'プレイリストが削除されました。' : 'Playlist deleted.', 'success')
          } else {
            const errData = await res.json()
            showToast(`플레이리스트 삭제에 실패했습니다: ${errData.error || 'Server Error'}`, 'error')
          }
        } catch (e) {
          console.error('Error deleting playlist:', e)
        }
      }
    })
  }

  const handleOpenEdit = (pl: any) => {
    const { text } = parsePlaylistDescription(pl.description)
    setEditPlaylistId(pl.id)
    setEditTitle(pl.title)
    setEditDescription(text)
    setEditCoverUrl(pl.cover_url)
    setEditGenre(pl.genre || '')
    setEditIsPublished(pl.is_published || false)
    setEditExposureOrder(pl.exposure_order || '')
    setIsEditModalOpen(true)
  }

  const handlePlaylistCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast(uiLanguage === 'KO' ? '이미지 크기는 2MB 이내여야 합니다.' : uiLanguage === 'JA' ? '画像は2MB以下である必要があります。' : 'Image must be under 2MB.', 'error')
      return
    }
    setIsUploadingCover(true)
    try {
      const fileName = `playlist-cover-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditCoverUrl(data.publicUrl)
      showToast(uiLanguage === 'KO' ? '커버 이미지가 업로드되었습니다.' : uiLanguage === 'JA' ? 'カバー画像がアップロードされました。' : 'Cover image uploaded.', 'success')
    } catch (e: any) {
      console.error(e)
      showToast(uiLanguage === 'KO' ? '업로드 실패' : uiLanguage === 'JA' ? 'アップロード失敗' : 'Upload failed', 'error')
    } finally {
      setIsUploadingCover(false)
    }
  }

  const handleMoveTrack = async (trackId: string, newPlaylistId: string | null) => {
    try {
      const res = await fetch(`/api/song-history/${trackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: newPlaylistId })
      })
      if (res.ok) {
        showToast(
          uiLanguage === 'KO'
            ? (newPlaylistId ? '플레이리스트에 곡이 추가되었습니다.' : '플레이리스트에서 곡이 제외되었습니다.')
            : (newPlaylistId ? 'Track added to playlist.' : 'Track removed from playlist.'),
          'success'
        )
        fetchUserTracks()
      } else {
        const errData = await res.json()
        showToast(errData.error || '실패했습니다.', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('네트워크 오류가 발생했습니다.', 'error')
    }
    setOpenPlaylistTrackMenuId(null)
  }

  const togglePublishPlaylist = async (id: string, currentStatus: boolean) => {
    const playlist = customPlaylists.find(p => p.id === id)
    const title = playlist ? playlist.title : '이 플레이리스트'

    if (!currentStatus) {
      setPublishGenre(playlist?.genre || '')
      setConfirmModal({
        isOpen: true,
        title: uiLanguage === 'KO' ? '플레이리스트 공개 퍼블리싱' : uiLanguage === 'JA' ? 'プレイリストを公開' : 'Publish Playlist',
        message: uiLanguage === 'KO'
          ? `'${title}' 플레이리스트를 공개하시겠습니까?\n퍼블리싱하려면 장르 카테고리를 필수로 선택해주셔야 합니다.`
          : uiLanguage === 'JA' ? `公開しますか: ` : `Do you want to publish '${title}'?\nYou must select a genre category to publish.`,
        confirmText: uiLanguage === 'KO' ? '공개 퍼블리싱' : uiLanguage === 'JA' ? '公開する' : 'Publish',
        cancelText: uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel',
        isDestructive: false,
        showGenreSelect: true,
        onConfirm: async (selectedGenre) => {
          if (!selectedGenre) {
            showToast(uiLanguage === 'KO' ? '장르 카테고리를 선택해야 퍼블리싱할 수 있습니다.' : uiLanguage === 'JA' ? 'ジャンルカテゴリーを選択する必要があります。' : 'You must select a genre category.', 'error')
            return
          }
          try {
            const res = await fetch(`/api/playlists/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_published: true, genre: selectedGenre })
            })
            if (res.ok) {
              await fetchPlaylists()
              showToast(uiLanguage === 'KO' ? '플레이리스트가 퍼블리싱되었습니다.' : uiLanguage === 'JA' ? 'プレイリストが公開されました。' : 'Playlist published.', 'success')
            }
          } catch (e) {
            console.error(e)
            showToast('네트워크 오류가 발생했습니다.', 'error')
          }
        }
      })
    } else {
      setConfirmModal({
        isOpen: true,
        title: uiLanguage === 'KO' ? '비공개 전환' : uiLanguage === 'JA' ? '非公開にする' : 'Make Private',
        message: uiLanguage === 'KO'
          ? `'${title}' 플레이리스트를 비공개로 전환하시겠습니까?`
          : uiLanguage === 'JA' ? `変更しますか: ` : `Do you want to make '${title}' private?`,
        confirmText: uiLanguage === 'KO' ? '비공개 전환' : uiLanguage === 'JA' ? '非公開にする' : 'Make Private',
        cancelText: uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel',
        isDestructive: false,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/playlists/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_published: false })
            })
            if (res.ok) {
              await fetchPlaylists()
              showToast(uiLanguage === 'KO' ? '비공개로 전환되었습니다.' : uiLanguage === 'JA' ? 'プレイリストが非公開に設定されました。' : 'Playlist set to private.', 'info')
            }
          } catch (e) {
            console.error(e)
            showToast('네트워크 오류가 발생했습니다.', 'error')
          }
        }
      })
    }
  }

  const handlePlay = async (track: Track, list: Track[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.id.startsWith('dummy-') || track.file_url.startsWith('http')) {
      playTrack(track, list)
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
      playTrack(signedTrack, list)
      setNowPlayingOpen(true)
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
      title: uiLanguage === 'KO' ? '좋아요 표시한 음악' : uiLanguage === 'JA' ? 'お気に入りの曲' : 'Liked Songs',
      description: uiLanguage === 'KO' ? '내가 좋아하는 곡 보관함' : uiLanguage === 'JA' ? 'あなたのお気に入りのトラック' : 'Your liked tracks',
      cover_url: '/images/liked_cover.png',
      tracks: likedTracks as Track[],
      type: 'PLAYLIST',
      isSystem: true,
      genre: '',
      isPublished: false,
      exposureOrder: null as number | null,
      stats: uiLanguage === 'KO' 
        ? `회원님이 직접 만든 보관함 • ${likedTracks.length} songs` 
        : uiLanguage === 'JA' ? `作成者：あなた • ${likedTracks.length} 曲` : `Created by you • ${likedTracks.length} songs`
    },
    {
      id: 'liked-albums',
      title: uiLanguage === 'KO' ? '좋아요 표시한 앨범' : uiLanguage === 'JA' ? 'お気に入りのアルバム' : 'Liked Albums',
      description: uiLanguage === 'KO' ? '내가 좋아하는 앨범 보관함' : uiLanguage === 'JA' ? 'あなたのお気に入りのアルバム' : 'Your liked albums',
      cover_url: '',
      tracks: [],
      type: 'ALBUM_LIST',
      isSystem: true,
      genre: '',
      isPublished: false,
      exposureOrder: null as number | null,
      stats: uiLanguage === 'KO' 
        ? `회원님이 직접 만든 보관함 • ${likedAlbums.length} albums` 
        : uiLanguage === 'JA' ? `作成者：あなた • ${likedAlbums.length} アルバム` : `Created by you • ${likedAlbums.length} albums`
    }
  ]

  const playlists = [
    ...systemPlaylists,
    ...[...customPlaylists].sort((a: any, b: any) => {
      const aVal = a.exposure_order;
      const bVal = b.exposure_order;
      
      const aHasOrder = aVal !== null && aVal !== undefined && aVal !== '';
      const bHasOrder = bVal !== null && bVal !== undefined && bVal !== '';
      
      if (aHasOrder && bHasOrder) {
        return Number(aVal) - Number(bVal);
      }
      if (aHasOrder) return -1;
      if (bHasOrder) return 1;
      
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    }).map(cp => {
      const pTracks = userTracks
        .filter(t => t.playlist_id === cp.id)
        .sort((a: any, b: any) => {
          const aVal = a.exposure_order;
          const bVal = b.exposure_order;
          
          const aHasOrder = aVal !== null && aVal !== undefined && aVal !== '';
          const bHasOrder = bVal !== null && bVal !== undefined && bVal !== '';
          
          if (aHasOrder && bHasOrder) {
            return Number(aVal) - Number(bVal);
          }
          if (aHasOrder) return -1;
          if (bHasOrder) return 1;
          
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        })
        .map(song => {
          const formGenre = song.form?.genre || song.genre || cp.genre || 'Pop'
          const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
          const dbPlayCount = Number(song.form?.play_count || 0)

          const originalProfile = trackProfiles[song.user_id]
          const artistName = originalProfile ? (originalProfile.display_name || originalProfile.email?.split('@')[0]) : 'Me'
          const artistSlug = originalProfile ? (originalProfile.email?.split('@')[0] || 'me') : 'me'
          const artistAvatar = originalProfile?.avatar_url || '/default-album.png'

          return {
            id: song.id,
            title: song.title,
            file_url: song.audio_url || '',
            duration_sec: song.form?.duration_sec || 180,
            like_count: dbLikeCount,
            play_count: dbPlayCount,
            album_id: cp.id,
            created_at: song.created_at,
            status: song.status || 'completed',
            lyricist: song.form?.lyricist || '',
            composer: song.form?.composer || '',
            arranger: song.form?.arranger || '',
            lyrics: song.lyrics || '',
            style_prompt: song.prompt || song.form?.prompt || '',
            image_url: song.image_url || cp.cover_url || '/default-album.png',
            album: {
              id: cp.id,
              title: song.form?.styleDesc || cp.title,
              cover_url: cp.cover_url || '/default-album.png',
              release_type: 'single',
              status: cp.is_published ? 'published' : 'private',
              created_at: cp.created_at,
              artist_id: song.user_id,
              artist: {
                id: song.user_id,
                name: artistName,
                slug: artistSlug,
                avatar_url: artistAvatar,
                bio: '',
                created_at: song.created_at
              }
            }
          }
        })

      return {
        id: cp.id,
        title: uiLanguage === 'KO' ? (cp.titleKo || cp.title) : cp.title,
        description: uiLanguage === 'KO' ? (cp.descriptionKo || cp.description) : cp.description,
        cover_url: cp.cover_url,
        tracks: pTracks as Track[],
        type: 'PLAYLIST',
        isSystem: false,
        genre: cp.genre || '',
        isPublished: cp.is_published || false,
        exposureOrder: cp.exposure_order,
        stats: uiLanguage === 'KO' 
          ? `보관함 폴더 • ${pTracks.length} songs` 
          : uiLanguage === 'JA' ? `ライブラリフォルダ • ${pTracks.length} 曲` : `Library folder • ${pTracks.length} songs`
      }
    })
  ]

  const activePlaylist = playlists.find(p => p.id === selectedPlaylist)

  // Relative Date added formatter
  const formatDateAdded = (dateStr: string, id: string) => {
    if (id === 'dummy-top-1') return uiLanguage === 'KO' ? '2일 전' : uiLanguage === 'JA' ? '2日前' : '2 days ago'
    if (id === 'dummy-top-2') return 'Oct 12, 2023'
    if (id === 'dummy-top-3') return uiLanguage === 'KO' ? '어제' : uiLanguage === 'JA' ? '昨日' : 'Yesterday'
    if (id === 'dummy-top-4') return uiLanguage === 'KO' ? '5일 전' : uiLanguage === 'JA' ? '5日前' : '5 days ago'
    
    return uiLanguage === 'KO' ? '최근 추가됨' : uiLanguage === 'JA' ? '最近追加された項目' : 'Recently added'
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
                <ListMusic className="w-6 h-6 text-primary shrink-0" />
                {uiLanguage === 'KO' ? '보관함 플레이리스트' : uiLanguage === 'JA' ? 'ライブラリプレイリスト' : 'Library Playlists'}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {/* Dashed Create Playlist Card */}
            <div 
              onClick={handleOpenCreate}
              className="bg-[#111a12]/20 border border-dashed border-emerald-950/40 hover:border-primary/40 hover:bg-[#111a12]/40 p-4 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer aspect-square group select-none relative"
            >
              <div className="w-12 h-12 rounded-full bg-[#111a12] border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary text-zinc-500 transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-[11px] text-on-surface-variant/70 group-hover:text-primary transition-colors">
                {uiLanguage === 'KO' ? '새 플레이리스트 만들기' : uiLanguage === 'JA' ? '新しいプレイリストを作成' : 'Create New Playlist'}
              </span>
            </div>

            {/* Playlist Cards */}
            {playlists.map((pl) => {
              const isLiked = likedAlbums.includes(pl.id)
              return (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl.id)}
                  className="bg-[#111a12]/60 border border-emerald-950/15 hover:border-primary/30 hover:bg-[#111a12] p-3 rounded-xl flex flex-col group shadow-md text-left transition-all duration-300 cursor-pointer overflow-hidden relative hover:scale-[1.02]"
                >
                  {/* Jacket Container */}
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gradient-to-br from-[#111a12] to-[#070b08] border border-outline-variant/20 shadow-md flex items-center justify-center select-none group-hover:shadow-primary/5 transition-all duration-300">
                    <Music className="w-6 h-6 text-on-surface-variant/25 absolute" />
                    {pl.id === 'liked' ? (
                      <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black transition-transform duration-500 group-hover:scale-105">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
                        <Heart className="w-12 h-12 text-primary fill-primary filter drop-shadow-[0_0_25px_rgba(227,254,6,0.6)] z-20 transform group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    ) : pl.id === 'liked-albums' ? (
                      <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black transition-transform duration-500 group-hover:scale-105">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
                        <Disc className="w-12 h-12 text-primary filter drop-shadow-[0_0_25px_rgba(227,254,6,0.6)] z-20 transform group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    ) : !pl.cover_url || pl.cover_url.includes('default-album') || pl.cover_url.includes('top100_cover') ? (
                      <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black transition-transform duration-500 group-hover:scale-105">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
                        <Music className="w-10 h-10 text-primary filter drop-shadow-[0_0_15px_rgba(227,254,6,0.5)] z-20 transform group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    ) : (
                      <img
                        src={pl.cover_url}
                        alt={pl.title}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500 group-hover:scale-105"
                      />
                    )}

                    {/* Status Badges for custom playlists */}
                    {!pl.isSystem && (
                      <>
                        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-extrabold border backdrop-blur-md shadow-sm z-20 select-none ${
                          pl.isPublished 
                            ? 'bg-primary/20 text-primary border-primary/30' 
                            : 'bg-black/60 text-zinc-400 border-white/10'
                        }`}>
                          {pl.isPublished ? (uiLanguage === 'KO' ? '공개됨' : uiLanguage === 'JA' ? '公開済み' : 'Published') : (uiLanguage === 'KO' ? '비공개' : uiLanguage === 'JA' ? '非公開' : 'Private')}
                        </span>
                        {pl.exposureOrder && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-extrabold border border-primary bg-primary text-[#0b0c0b] shadow-sm z-20 select-none">
                            {pl.exposureOrder}{uiLanguage === 'KO' ? '순위' : uiLanguage === 'JA' ? '順位' : ' Rank'}
                          </span>
                        )}
                      </>
                    )}

                    {/* Heart Button overlay */}
                    {!pl.isSystem && (
                      <div className={`absolute bottom-2 right-2 z-20 transition-all duration-300 ${isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleAlbumLikeToggle(pl.id)
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                            isLiked
                              ? 'bg-[#e3fe06] text-black font-extrabold'
                              : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
                          }`}
                          title={uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Like'}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    )}

                    {/* Custom playlist Action Button Overlay on Hover */}
                    {!pl.isSystem ? (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-10">
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              togglePublishPlaylist(pl.id, pl.isPublished); 
                            }} 
                            className={`w-8 h-8 rounded-full bg-black/70 flex items-center justify-center hover:bg-primary transition-all backdrop-blur-sm cursor-pointer hover:scale-110 active:scale-95 ${
                              pl.isPublished ? 'text-primary hover:text-white' : 'text-white'
                            }`}
                            title={pl.isPublished ? (uiLanguage === 'KO' ? '비공개 전환' : uiLanguage === 'JA' ? '非公開にする' : 'Make Private') : (uiLanguage === 'KO' ? '공개 퍼블리싱' : uiLanguage === 'JA' ? '公開する' : 'Publish')}
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleOpenEdit(pl); 
                            }} 
                            className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-primary transition-all backdrop-blur-sm cursor-pointer hover:scale-110 active:scale-95"
                            title={uiLanguage === 'KO' ? '수정' : uiLanguage === 'JA' ? '編集' : 'Edit'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeletePlaylist(pl.id); 
                            }} 
                            className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-500 transition-all backdrop-blur-sm cursor-pointer hover:scale-110 active:scale-95"
                            title={uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : pl.id === 'liked-albums' ? null : (
                      /* System playlist play overlay */
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-10">
                        <div className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg shadow-primary/20">
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Title and stats */}
                  <div className="min-w-0 w-full pt-1.5 flex flex-col gap-0.5">
                    <p className="font-bold text-xs truncate text-on-surface group-hover:text-primary transition-colors pr-1">
                      {pl.title}
                    </p>
                    <p className="text-[10px] text-on-surface-variant/80 mt-0.5 flex items-center gap-1.5 font-semibold">
                      {pl.id === 'liked-albums' ? (
                        <span>
                          {likedAlbums.length}{' '}
                          {uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'albums'}
                        </span>
                      ) : (
                        <span>
                          {pl.tracks.length}{' '}
                          {uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : 'songs'}
                        </span>
                      )}
                      <span className="text-zinc-700">•</span>
                      <span className="flex items-center gap-1">
                        <Heart
                          className={`w-2.5 h-2.5 ${
                            pl.id === 'liked-albums'
                              ? likedAlbums.length > 0
                                ? 'fill-current text-primary'
                                : 'text-zinc-500'
                              : pl.id === 'liked'
                              ? likedTracks.length > 0
                                ? 'fill-current text-primary'
                                : 'text-zinc-500'
                              : isLiked
                              ? 'fill-current text-primary'
                              : 'text-zinc-500'
                          }`}
                        />
                        <span>
                          {pl.id === 'liked-albums'
                            ? likedAlbums.length
                            : pl.id === 'liked'
                            ? likedTracks.length
                            : isLiked
                            ? 1
                            : 0}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : selectedPlaylist === 'liked-albums' ? (
        // 2. Liked Albums Detail View
        <div className="flex flex-col gap-6">
          {/* Back Button */}
          <button 
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {uiLanguage === 'KO' ? '목록으로' : uiLanguage === 'JA' ? '戻る' : 'Back'}
          </button>
          
          <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
             <Disc className="w-6 h-6 text-primary shrink-0" />
             {uiLanguage === 'KO' ? '좋아요 표시한 앨범' : uiLanguage === 'JA' ? 'お気に入りのアルバム' : 'Liked Albums'}
          </h1>
          
          {likedAlbumsData.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {likedAlbumsData.map(album => (
                <AlbumCard key={album.id} album={album} variant="library" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-container-low rounded-3xl border border-outline-variant/10 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                <Disc className="w-8 h-8 text-on-surface-variant/40" />
              </div>
              <p className="text-on-surface font-bold mb-1">
                {uiLanguage === 'KO' ? '좋아요 표시한 앨범이 없습니다.' : uiLanguage === 'JA' ? 'お気に入りのアルバムはありません。' : 'No liked albums yet.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        // 3. Playlist Detail View (Matching My Music Management style)
        activePlaylist && (
          <div className="flex flex-col gap-6">
            {/* Back Button */}
            <button 
              onClick={() => setSelectedPlaylist(null)}
              className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {uiLanguage === 'KO' ? '목록으로' : uiLanguage === 'JA' ? '戻る' : 'Back'}
            </button>

            {/* Hero Header Banner */}
            <div className="relative w-full bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950/40 rounded-3xl p-6 md:p-8 border border-zinc-800/60 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none"></div>
              
              {/* Cover Art */}
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/5 bg-zinc-900 relative">
                <Music className="w-12 h-12 text-on-surface-variant/25 absolute inset-0 m-auto" />
                {activePlaylist.id === 'liked' ? (
                  <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-black">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-60 scale-150"></div>
                    <Heart className="w-16 h-16 md:w-20 md:h-20 text-primary fill-primary filter drop-shadow-[0_0_35px_rgba(227,254,6,0.6)] z-20" />
                  </div>
                ) : (
                  <img 
                    src={activePlaylist.cover_url || '/default-album.png'} 
                    alt="Album Cover" 
                    className="absolute inset-0 w-full h-full object-cover z-10" 
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-album.png";
                    }}
                  />
                )}
              </div>

              {/* Album Details Info */}
              <div className="flex-1 flex flex-col gap-2 w-full md:w-auto text-left z-10">
                <span className="text-[10px] font-extrabold text-primary border border-primary/30 bg-primary/5 px-2.5 py-0.5 rounded-full tracking-wider uppercase inline-block self-start">
                  PLAYLIST
                </span>
                <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mt-1">{activePlaylist.title}</h1>
                <p className="text-xs text-zinc-400 font-semibold tracking-wide mt-1">
                  {uiLanguage === 'KO' ? '보관함 폴더' : uiLanguage === 'JA' ? 'ライブラリフォルダ' : 'Library Folder'} • {activePlaylist.tracks.length} songs {activePlaylist.genre && `• ${activePlaylist.genre}`}
                </p>

                {/* Actions Button Row */}
                <div className="flex items-center flex-wrap gap-3 mt-4">
                  <button 
                    onClick={() => handlePlay(activePlaylist.tracks[0], activePlaylist.tracks)}
                    disabled={activePlaylist.tracks.length === 0}
                    className="px-6 py-2.5 rounded-full bg-primary hover:bg-[#e3fe06] text-[#0b0c0b] text-xs font-extrabold flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-primary shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> PLAY ALL
                  </button>

                  <button 
                    onClick={() => handleAlbumLikeToggle(activePlaylist.id)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                      likedAlbums.includes(activePlaylist.id)
                        ? 'border-[#e3fe06] bg-[#e3fe06]/10 text-[#e3fe06] hover:bg-[#e3fe06]/25'
                        : 'border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                    title={uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Like'}
                  >
                    <Heart className={`w-4 h-4 ${likedAlbums.includes(activePlaylist.id) ? 'fill-current' : ''}`} />
                  </button>

                  <button className="w-9 h-9 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {!activePlaylist.isSystem && (
                    <div className="flex gap-2 ml-auto">
                      <button 
                        onClick={() => togglePublishPlaylist(activePlaylist.id, activePlaylist.isPublished)} 
                        className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${
                          activePlaylist.isPublished 
                            ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-black' 
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                      >
                        {activePlaylist.isPublished ? (uiLanguage === 'KO' ? '공개 해제' : uiLanguage === 'JA' ? '非公開にする' : 'Make Private') : (uiLanguage === 'KO' ? '공개 퍼블리싱' : uiLanguage === 'JA' ? '公開する' : 'Publish')}
                      </button>
                      <button 
                        onClick={() => {
                          const pl = customPlaylists.find(p => p.id === activePlaylist.id)
                          if (pl) handleOpenEdit(pl)
                        }} 
                        className="px-4 py-1.5 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        {uiLanguage === 'KO' ? '편집' : uiLanguage === 'JA' ? '編集' : 'Edit'}
                      </button>
                      <button 
                        onClick={() => handleDeletePlaylist(activePlaylist.id)} 
                        className="px-4 py-1.5 rounded-full border border-red-950/40 hover:border-red-900/60 text-red-400 hover:text-red-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        {uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tracks List (Sitting directly on the background, no border-box container) */}
            {activePlaylist.tracks.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800 mt-6">
                {uiLanguage === 'KO' 
                  ? (uiLanguage === 'KO' ? '플레이리스트에 들어있는 곡이 없습니다.' : uiLanguage === 'JA' ? 'プレイリストに曲がありません。' : 'No songs in this playlist.') 
                  : uiLanguage === 'JA' ? 'このプレイリストは空です。' : 'This playlist is empty.'}
              </div>
            ) : (
              <div className="w-full mt-6 flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-[50px_2fr_1.5fr_1.5fr_100px] gap-4 px-4 py-2 border-b border-zinc-800/40 text-xs font-bold text-zinc-500 uppercase tracking-wider text-left">
                  <div>#</div>
                  <div>{uiLanguage === 'KO' ? '제목' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</div>
                  <div>{uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Album'}</div>
                  <div>{uiLanguage === 'KO' ? '추가된 날짜' : uiLanguage === 'JA' ? '追加された日付' : 'Date Added'}</div>
                  <div className="text-right flex justify-end items-center"><Clock className="w-4 h-4 text-zinc-500" /></div>
                </div>

                {/* Table Rows */}
                <div className="flex flex-col gap-1 mt-3">
                  {activePlaylist.tracks.map((track, index) => {
                    const isCurrent = currentTrack?.id === track.id
                    const isPlayingThis = isCurrent && isPlaying
                    const displayDuration = track.duration_sec 
                      ? `${Math.floor(track.duration_sec / 60)}:${String(track.duration_sec % 60).padStart(2, '0')}` 
                      : '3:00'
                    
                    return (
                      <div 
                        key={track.id} 
                        className={`grid grid-cols-[50px_2fr_1.5fr_1.5fr_100px] gap-4 px-4 py-3 items-center rounded-xl hover:bg-white/5 transition-all group ${
                          isCurrent ? 'bg-primary/10' : ''
                        }`}
                      >
                        {/* Index */}
                        <div className="text-sm font-semibold font-mono text-zinc-500 text-left">
                          <span className={isPlayingThis ? 'text-primary font-bold' : ''}>{index + 1}</span>
                        </div>

                        {/* Title & Cover info */}
                        <div className="flex items-center gap-3 min-w-0 text-left">
                          <div 
                            className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5 bg-zinc-900 cursor-pointer"
                            onClick={() => handlePlay(track, activePlaylist.tracks)}
                          >
                            <img 
                              src={track.image_url || track.album?.cover_url || '/default-album.png'} 
                              alt="Track Cover" 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "/default-album.png";
                              }}
                            />
                            {/* Hover Play/Pause Overlay */}
                            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all ${
                              isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              {isPlayingThis ? (
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
                            <span className={`text-sm font-bold truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>{track.title}</span>
                            <span className="text-xs text-zinc-400 font-semibold truncate">{track.album?.artist?.name || 'AI Artist'}</span>
                          </div>
                        </div>

                        {/* Album Title */}
                        <div className="text-sm text-zinc-400 font-medium truncate text-left">
                          {track.album?.title || '-'}
                        </div>

                        {/* Date Added */}
                        <div className="text-sm text-zinc-400 font-medium truncate text-left">
                          {formatDateAdded(track.created_at || '', track.id)}
                        </div>

                        {/* Duration & Heart & More */}
                        <div className="text-right flex items-center justify-end gap-3 text-sm text-zinc-500 font-mono relative">
                          <span>{displayDuration}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (track.id.startsWith('dummy-')) {
                                setLikedTracks((prev) => prev.filter((t) => t.id !== track.id))
                              } else {
                                handleUnlike(track.id)
                              }
                            }}
                            className="text-primary hover:text-red-400 hover:scale-105 transition-all p-1 rounded-lg hover:bg-white/[0.04] cursor-pointer"
                            title={uiLanguage === 'KO' ? '보관함에서 제거' : uiLanguage === 'JA' ? 'ライブラリから削除' : 'Remove from Library'}
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </button>

                          {!track.id.startsWith('dummy-') && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenPlaylistTrackMenuId(openPlaylistTrackMenuId === track.id ? null : track.id);
                                }}
                                className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                                  openPlaylistTrackMenuId === track.id ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {/* Dropdown Menu */}
                              {openPlaylistTrackMenuId === track.id && (
                                <div 
                                  className="absolute right-0 top-8 w-48 bg-[#111a12] border border-emerald-950/40 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {!activePlaylist.isSystem && (
                                    <>
                                      <button
                                        onClick={() => handleMoveTrack(track.id, null)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        {uiLanguage === 'KO' ? '이 플레이리스트에서 빼기' : uiLanguage === 'JA' ? 'プレイリストから削除' : 'Remove from Playlist'}
                                      </button>
                                      <div className="h-px bg-outline-variant/10 my-1 mx-2"></div>
                                    </>
                                  )}

                                  <div className="px-3 py-1 text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">
                                    {uiLanguage === 'KO' ? '플레이리스트에 추가/이동' : uiLanguage === 'JA' ? 'プレイリストに追加/移動' : 'Add/Move to Playlist'}
                                  </div>
                                  <div className="max-h-40 overflow-y-auto scrollbar-none">
                                    {customPlaylists
                                      .filter(p => p.id !== activePlaylist.id)
                                      .map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => handleMoveTrack(track.id, p.id)}
                                          className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-white/5 transition-colors cursor-pointer truncate font-semibold"
                                        >
                                          {p.title}
                                        </button>
                                      ))}
                                    {customPlaylists.filter(p => p.id !== activePlaylist.id).length === 0 && (
                                      <div className="px-4 py-2 text-xs text-on-surface-variant/40 italic font-medium">
                                        {uiLanguage === 'KO' ? '추가할 플레이리스트 없음' : uiLanguage === 'JA' ? '利用可能なプレイリストがありません' : 'No playlists available'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Modals & Notifications Portals */}
      {mounted && typeof window !== 'undefined' && document.body && (
        <>
          {/* Edit Playlist Modal */}
          {isEditModalOpen && createPortal(
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
              <div 
                className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-3">
                  <h2 className="text-2xl font-sans text-white font-medium">
                    {editPlaylistId 
                      ? (uiLanguage === 'KO' ? '플레이리스트 정보 수정' : uiLanguage === 'JA' ? 'プレイリスト情報を編集' : 'Edit Playlist Info') 
                      : (uiLanguage === 'KO' ? '새 플레이리스트 만들기' : uiLanguage === 'JA' ? '新しいプレイリストを作成' : 'Create New Playlist')}
                  </h2>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div 
                  className="p-5 pt-2 flex flex-col gap-4 text-left"
                >
                  {/* Title */}
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={uiLanguage === 'KO' ? '플레이리스트 제목' : uiLanguage === 'JA' ? 'プレイリストのタイトル' : 'Playlist Title'}
                    className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 font-semibold text-sm"
                  />
                  
                  {/* Description */}
                  <div className="relative">
                    <textarea 
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value.substring(0, 200))}
                      placeholder={uiLanguage === 'KO' ? '플레이리스트 설명' : uiLanguage === 'JA' ? 'プレイリストの説明' : 'Playlist Description'}
                      className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-white focus:outline-none focus:border-primary/50 h-28 resize-none font-semibold text-sm"
                    />
                    <div className="text-right text-[11px] text-on-surface-variant mt-1 font-bold">
                      {editDescription.length} / 200
                    </div>
                  </div>

                  {/* Genre Category (Required) */}
                  <div className="flex flex-col gap-1.5 text-xs font-bold text-on-surface-variant">
                    <label>{uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリー (必須)' : 'Genre Category (Required)'}</label>
                    <select
                      value={editGenre}
                      onChange={(e) => setEditGenre(e.target.value)}
                      className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                    >
                      <option value="">{uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリーを選択' : 'Select Genre Category'}</option>
                      {GENRES.map(g => (
                        <option key={g.name} value={g.name}>
                          {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Exposure Order Setting */}
                  <div className="flex flex-col gap-1.5 text-xs font-bold text-on-surface-variant">
                    <label>{uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順序の設定' : 'Exposure Order Setting'}</label>
                    <select
                      value={editExposureOrder || ''}
                      onChange={(e) => setEditExposureOrder(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                    >
                      <option value="">{uiLanguage === 'KO' ? '기본 (최신 등록순)' : uiLanguage === 'JA' ? 'デフォルト (最新)' : 'Default (Latest)'}</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num}{uiLanguage === 'KO' ? '순위 (우선 노출)' : uiLanguage === 'JA' ? ' ランク (優先)' : ' Rank (Prioritized)'}</option>
                      ))}
                    </select>
                  </div>

                  {/* Publishing Status Toggle */}
                  <div className="flex items-center justify-between bg-[#141415] border border-outline-variant/15 p-3 rounded-lg mt-1 text-left select-none">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white">
                        {uiLanguage === 'KO' ? '플레이리스트 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? 'プレイリストの公開 (パブリック)' : 'Playlist Publishing (Public)'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-semibold leading-normal">
                        {uiLanguage === 'KO' ? '내 채널(공개 프로필)에 이 플레이리스트를 공개합니다.' : uiLanguage === 'JA' ? 'このプレイリストをマイチャンネルに公開します。' : 'Publish this playlist on my channel.'}
                      </span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={editIsPublished} 
                      onChange={(e) => setEditIsPublished(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant/30 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Cover Image Upload & Preview */}
                  <div className="flex flex-col items-center my-2 gap-3 relative">
                    <div className="w-48 h-48 rounded-xl overflow-hidden bg-[#141415] border border-outline-variant/20 flex items-center justify-center group relative shadow-lg">
                      {editCoverUrl ? (
                        <>
                          <img src={editCoverUrl} className="w-full h-full object-cover" alt="Playlist Cover" />
                          <button 
                            onClick={() => setEditCoverUrl('')} 
                            className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors">
                          <Upload className="w-8 h-8 mb-2 opacity-50 text-zinc-400" />
                          <span className="text-sm font-medium text-zinc-300">
                            {uiLanguage === 'KO' ? '플레이리스트 커버 업로드' : uiLanguage === 'JA' ? 'プレイリストのカバーをアップロード' : 'Upload Playlist Cover'}
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={handlePlaylistCoverUpload} />
                        </label>
                      )}
                    </div>

                    {/* Preset Suggestions */}
                    <div className="w-full">
                      <span className="text-[9px] font-black uppercase text-on-surface-variant/60 tracking-wider block mb-1 text-center">
                        {uiLanguage === 'KO' ? '추천 프리셋 커버' : uiLanguage === 'JA' ? 'おすすめのプリセットカバー' : 'Suggested Preset Covers'}
                      </span>
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <button 
                          type="button"
                          onClick={() => setEditCoverUrl('/images/top100_cover.png')}
                          className="px-2.5 py-1 rounded bg-[#141415] border border-outline-variant/10 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer text-on-surface-variant hover:text-white"
                        >
                          Neon Wave
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditCoverUrl('/images/liked_cover.png')}
                          className="px-2.5 py-1 rounded bg-[#141415] border border-outline-variant/10 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer text-on-surface-variant hover:text-white"
                        >
                          Neon Heart
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditCoverUrl('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop')}
                          className="px-2.5 py-1 rounded bg-[#141415] border border-outline-variant/10 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer text-on-surface-variant hover:text-white"
                        >
                          Acoustic
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditCoverUrl('https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=350&auto=format&fit=crop')}
                          className="px-2.5 py-1 rounded bg-[#141415] border border-outline-variant/10 hover:border-primary/30 text-[9px] font-bold transition-all cursor-pointer text-on-surface-variant hover:text-white"
                        >
                          Chill Piano
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Image Generation Prompt (UI only) */}
                  <div className="flex gap-2 items-center mt-2">
                    <input 
                      type="text"
                      placeholder="Prompt for an AI-generated image..."
                      className="flex-1 bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-primary/50"
                    />
                    <button 
                      type="button"
                      className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
                      onClick={() => alert(uiLanguage === 'KO' ? "현재는 디자인(UI) 레이아웃만 적용되어 있습니다. 실제 AI 이미지 생성 API 연동이 필요합니다!" : uiLanguage === 'JA' ? "現在、UIレイアウトのみが実装されています。API連携が必要です！" : "Currently, only the UI layout is implemented. API integration is required!")}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-outline-variant/10 bg-surface-container/20">
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-5 py-2.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-sm font-bold text-white rounded-xl transition-all cursor-pointer"
                  >
                    {uiLanguage === 'KO' ? 'Cancel' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={!editTitle.trim()}
                    className="px-6 py-2.5 bg-[#F2F2F7] hover:bg-white text-black text-sm font-bold rounded-xl disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {uiLanguage === 'KO' ? 'Save' : uiLanguage === 'JA' ? '保存' : 'Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Toast Notification */}
          {toast && createPortal(
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-fade-in transition-all duration-300 bg-[#0e150e]/90 border-emerald-500/20 text-white font-bold text-xs uppercase tracking-wider">
              {toast.type === 'success' && <Check className="w-4 h-4 text-primary" />}
              {toast.type === 'error' && <X className="w-4 h-4 text-red-500" />}
              <span>{toast.message}</span>
            </div>,
            document.body
          )}

          {/* Custom Confirm Modal */}
          {confirmModal && confirmModal.isOpen && createPortal(
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
              <div className="bg-[#111a12] border border-emerald-950/40 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl relative">
                <div className="space-y-2">
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant/80 font-bold whitespace-pre-line leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>

                {confirmModal.showGenreSelect && (
                  <div className="space-y-1.5 text-xs font-bold text-on-surface-variant">
                    <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                      {uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリーを選択' : 'Select Genre Category'}
                    </label>
                    <select
                      value={publishGenre}
                      onChange={(e) => setPublishGenre(e.target.value)}
                      className="w-full bg-[#070b08] border border-emerald-950/30 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-primary/50 transition-colors"
                    >
                      <option value="">{uiLanguage === 'KO' ? '장르 선택' : uiLanguage === 'JA' ? 'ジャンルを選択' : 'Select Genre'}</option>
                      {GENRES.map(g => (
                        <option key={g.name} value={g.name}>
                          {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-full border border-white/10 hover:border-white/20 text-xs font-bold text-on-surface-variant hover:text-white transition-all cursor-pointer"
              >
                {confirmModal.cancelText}
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm(confirmModal.showGenreSelect ? publishGenre : undefined)
                  setConfirmModal(null)
                }}
                disabled={confirmModal.showGenreSelect && !publishGenre}
                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-lg ${
                  confirmModal.isDestructive 
                    ? 'bg-red-500 text-white shadow-red-500/10' 
                    : 'bg-primary text-black shadow-primary/10'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
        </>
      )}
      
    </div>
  )
}
