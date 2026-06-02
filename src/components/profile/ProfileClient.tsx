'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { User, Users, Globe, Lock, Play, Pause, Edit2, X, Check, Upload, Folder, Plus, ArrowLeft, Trash2, Info, Pencil, Clock, Heart, MoreHorizontal, ChevronRight, Settings, CreditCard, Sliders, Music, ListMusic, Download, Search, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { GENRES } from '@/lib/constants'


interface ProfileClientProps {
  user: any
  isAdmin?: boolean
  initialProfile?: any
}


const defaultHooks = [
  { id: 'hook-1', title: 'Spiderwebs 🕸️', plays: 139, likes: 13, image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'hook-2', title: 'Slid 🎚️ OH OH OH', plays: 48, likes: 6, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'hook-3', title: 'Hooked 🔥 ⛓️', plays: 116, likes: 6, image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 'hook-4', title: 'Can\'t let you go', plays: 106, likes: 8, image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 'hook-5', title: 'The Quantum Dream', plays: 91, likes: 5, image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 'hook-6', title: 'Midnight Train 🚂', plays: 210, likes: 18, image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 'hook-7', title: 'Lost in Forest 🌲', plays: 75, likes: 4, image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 'hook-8', title: 'Golden Hours 🌅', plays: 340, likes: 29, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'hook-9', title: 'Digital Rain ☔', plays: 185, likes: 12, image: 'https://images.unsplash.com/photo-1429087900562-27db55f42e75?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 'hook-10', title: 'Ethereal Sky ☁️', plays: 95, likes: 8, image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&auto=format&fit=crop&q=60', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' }
]

const mockAlbumTracks: Record<string, any[]> = {
  'hook-1': [
    { id: 'h1t1', title: 'Spiderwebs Intro', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration_sec: 145, plays: 139, likes: 13, genre: 'Ambient' },
    { id: 'h1t2', title: 'Spiderwebs (Extended Mix)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration_sec: 210, plays: 95, likes: 8, genre: 'Electronic' },
    { id: 'h1t3', title: 'Spiderwebs Outro', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration_sec: 90, plays: 44, likes: 3, genre: 'Ambient' }
  ],
  'hook-2': [
    { id: 'h2t1', title: 'Slid Main Theme', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration_sec: 180, plays: 48, likes: 6, genre: 'Retro Synth' },
    { id: 'h2t2', title: 'Slid (Retro Synth Remix)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration_sec: 195, plays: 32, likes: 4, genre: 'Pop' }
  ],
  'hook-3': [
    { id: 'h3t1', title: 'Hooked (Original Mix)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration_sec: 176, plays: 116, likes: 6, genre: 'Trap' },
    { id: 'h3t2', title: 'Hooked (Radio Edit)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration_sec: 150, plays: 80, likes: 3, genre: 'Hip Hop' }
  ],
  'hook-4': [
    { id: 'h4t1', title: "Can't let you go", audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration_sec: 220, plays: 106, likes: 8, genre: 'Pop' },
    { id: 'h4t2', title: "Can't let you go (Acoustic)", audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration_sec: 185, plays: 72, likes: 5, genre: 'Acoustic' }
  ],
  'hook-5': [
    { id: 'h5t1', title: 'The Quantum Dream (Pt. 1)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration_sec: 240, plays: 91, likes: 5, genre: 'Soundtrack' },
    { id: 'h5t2', title: 'The Quantum Dream (Pt. 2)', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', duration_sec: 215, plays: 60, likes: 3, genre: 'Ambient' }
  ],
  'hook-6': [
    { id: 'h6t1', title: 'Midnight Train Journey', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', duration_sec: 210, plays: 210, likes: 18, genre: 'Pop' }
  ],
  'hook-7': [
    { id: 'h7t1', title: 'Deep in the Woods', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', duration_sec: 180, plays: 75, likes: 4, genre: 'Ambient' }
  ],
  'hook-8': [
    { id: 'h8t1', title: 'Golden Hour Sunshine', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', duration_sec: 220, plays: 340, likes: 29, genre: 'Synthpop' }
  ],
  'hook-9': [
    { id: 'h9t1', title: 'Cyber Raindrops', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', duration_sec: 190, plays: 185, likes: 12, genre: 'Synthwave' }
  ],
  'hook-10': [
    { id: 'h10t1', title: 'Clouds Above', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', duration_sec: 205, plays: 95, likes: 8, genre: 'Ambient' }
  ]
}

const featuredTrack = {
  id: 'featured-1',
  title: 'Doom Kid',
  plays: 80,
  likes: 15,
  comments: 3,
  duration: '2:20',
  genre: 'Funk Pop',
  version: 'v2.0',
  image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  style_desc: 'Dark synth, heavy electronic bass, 80s pop vibe, retro energetic beat'
}

const MOCK_SAMPLE_SONGS = [
  {
    id: 'sample-1',
    title: 'Urban Bourbon',
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    genre: 'R&B',
    plays: '6',
    likes: '2',
    comments: 0,
    duration_sec: 180,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-2',
    title: 'Doom Kid',
    image_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    genre: 'Punk-Pop',
    plays: '80',
    likes: '15',
    comments: 3,
    duration_sec: 220,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-3',
    title: 'Ashes of Liars',
    image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    genre: 'EDM',
    plays: '23',
    likes: '4',
    comments: 0,
    duration_sec: 150,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-4',
    title: 'Bloodline (Shoto Todoroki)',
    image_url: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    genre: 'Metal',
    plays: '71',
    likes: '12',
    comments: 1,
    duration_sec: 195,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-5',
    title: 'Soul Fire 🔥',
    image_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    genre: 'Phonk',
    plays: '56',
    likes: '9',
    comments: 2,
    duration_sec: 215,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-6',
    title: 'Keep It Cute',
    image_url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    genre: 'Lofi-Edm',
    plays: '86',
    likes: '14',
    comments: 0,
    duration_sec: 165,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-7',
    title: "Chaos' Reach",
    image_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    genre: 'Rock',
    plays: '62',
    likes: '8',
    comments: 1,
    duration_sec: 175,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-8',
    title: 'Soft Hands',
    image_url: 'https://images.unsplash.com/photo-1517230807585-42d139a542fc?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    genre: 'Indie',
    plays: '158',
    likes: '22',
    comments: 4,
    duration_sec: 190,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  },
  {
    id: 'sample-9',
    title: 'Ski Masking',
    image_url: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=500&q=60',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    genre: 'Acoustic-Folk',
    plays: '143',
    likes: '19',
    comments: 2,
    duration_sec: 205,
    created_at: new Date().toISOString(),
    is_published: true,
    is_sample: true
  }
]

const MOCK_SAMPLE_PLAYLISTS = [
  {
    id: 'sample-playlist-1',
    title: 'Katch-22',
    cover_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=60',
    description: 'Special curated playlist',
    genre: 'Synthwave',
    is_published: true,
    is_mock: true,
    tracks: Array.from({ length: 22 }, (_, i) => ({
      id: `katch-track-${i}`,
      title: `Track ${i + 1}`,
      audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      duration_sec: 180,
      plays: 120,
      likes: 15,
      genre: 'Pop'
    })),
    created_at: new Date().toISOString()
  }
]



function FolderTreeNode({ node, selectedPlaylist, setSelectedPlaylist, expandedFolders, handleToggleFolder, depth = 0, handleCreateSubfolder, handleRenameFolder, deletePlaylist, handleMoveTrack, showToast, folderTrackCounts, selectedSong, setSelectedSong }: any) {
  const isExpanded = expandedFolders.has(node.id)
  const isSelected = selectedPlaylist === node.id
  const hasChildren = node.children && node.children.length > 0
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [menuCoords, setMenuCoords] = useState<{top: number, right: number} | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
      ) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col w-full">
      <div 
        className={`group relative flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'text-zinc-300 hover:bg-white/5'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const trackId = e.dataTransfer.getData('track-id') || e.dataTransfer.getData('text/plain');
          if (trackId && handleMoveTrack && showToast) {
            handleMoveTrack(trackId, node.id);
            showToast(`'${node.title}' 폴더로 이동되었습니다.`, 'success');
          }
        }}
        onClick={(e) => {
          setSelectedPlaylist(node.id);
          if (hasChildren) {
            handleToggleFolder(e, node.id);
          }
        }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden pr-6">
          {hasChildren ? (
            <button 
              onClick={(e) => handleToggleFolder(e, node.id)} 
              className="p-0.5 text-zinc-500 hover:text-white shrink-0"
            >
              <svg className={`w-3.5 h-3.5 fill-current transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
            </button>
          ) : (
            <div className="w-4.5 shrink-0"></div>
          )}
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          <span className="text-sm truncate font-medium">{node.title}</span>
          <span className="text-xs text-on-surface-variant/50 shrink-0 ml-1">
            ({folderTrackCounts ? (folderTrackCounts[node.id] || 0) : 0})
          </span>
        </div>

        {/* The 3-dot menu icon */}
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} ref={menuRef}>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!isMenuOpen && menuRef.current) {
                const rect = menuRef.current.getBoundingClientRect();
                setMenuCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              }
              setIsMenuOpen(!isMenuOpen); 
            }}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          
          {isMenuOpen && menuCoords && typeof window !== 'undefined' && require('react-dom').createPortal(
            <div 
              ref={dropdownRef}
              className="fixed w-36 bg-white border border-gray-200 rounded shadow-xl z-[9999] text-sm font-medium overflow-hidden text-black"
              style={{ top: menuCoords.top, right: menuCoords.right }}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleCreateSubfolder(node.id); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 fill-gray-500" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>
                하위 폴더 생성
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); handleRenameFolder(node.id, node.title); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 fill-gray-500" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                이름 변경
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsMenuOpen(false); 
                  deletePlaylist(node.id); 
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 text-[#d32f2f] transition-colors"
              >
                <svg className="w-4 h-4 fill-[#d32f2f]" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                삭제
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {node.children.map((child: any) => (
            <FolderTreeNode 
              key={child.id} 
              node={child} 
              selectedPlaylist={selectedPlaylist}
              setSelectedPlaylist={setSelectedPlaylist}
              expandedFolders={expandedFolders}
              handleToggleFolder={handleToggleFolder}
              handleCreateSubfolder={handleCreateSubfolder}
              handleRenameFolder={handleRenameFolder}
              deletePlaylist={deletePlaylist}
              handleMoveTrack={handleMoveTrack}
              showToast={showToast}
              folderTrackCounts={folderTrackCounts}
              depth={depth + 1}
              selectedSong={selectedSong}
              setSelectedSong={setSelectedSong}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProfileClient({ user, isAdmin = false, initialProfile }: ProfileClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()

  const handleDownloadTrack = async (url: string, filename: string, imageUrl?: string) => {
    if (!url) return
    try {
      let downloadUrl = url;
      if (downloadUrl && !downloadUrl.startsWith('http') && !downloadUrl.startsWith('dummy-') && !downloadUrl.startsWith('sample-') && !downloadUrl.startsWith('hook-') && !downloadUrl.startsWith('featured-')) {
        try {
          const supabase = createClient()
          const { data, error } = await supabase.storage
            .from('tracks')
            .createSignedUrl(downloadUrl, 3600)
          if (!error && data) {
            downloadUrl = data.signedUrl;
          }
        } catch (err) {
          console.error(err)
        }
      }
      let proxyUrl = `/api/download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`
      if (imageUrl) {
        proxyUrl += `&image=${encodeURIComponent(imageUrl)}`
      }
      const a = document.createElement('a')
      a.href = proxyUrl
      a.download = `${filename}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      window.open(url, '_blank')
    }
  }

  const [history, setHistory] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'private' | 'public' | 'channels' | 'albums'>(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'private' || tab === 'public' || tab === 'channels') return tab as 'private' | 'public' | 'channels';
    return 'public';
  })
  const [trackSearchQuery, setTrackSearchQuery] = useState('')
  const [trackSortOrder, setTrackSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [currentAlbumPage, setCurrentAlbumPage] = useState(1)
  const albumsPerPage = 15

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(1)
    setCurrentAlbumPage(1)
  }, [activeTab])


  const [openPlaylistTrackMenuId, setOpenPlaylistTrackMenuId] = useState<string | null>(null)
  
  // Media Upload State
  const [selectedSong, setSelectedSong] = useState<any | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  
  // Settings States
  const [activeSettingSection, setActiveSettingSection] = useState<'credits' | 'profile' | 'preferences'>('credits')
  const [userCredits, setUserCredits] = useState<number>(120)
  const [transactions, setTransactions] = useState<any[]>([])
  const [uiLanguage, setUiLanguage] = useState<'KO' | 'EN' | 'JA'>('KO')
  const [audioQuality, setAudioQuality] = useState<'standard' | 'high'>('high')
  const [autoplay, setAutoplay] = useState<boolean>(true)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [billingCycle, setBillingCycle] = useState<string>('monthly')
  const [planRenewalDate, setPlanRenewalDate] = useState<string>('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ 
    display_name?: string, 
    avatar_url?: string,
    banner_url?: string,
    bio?: string,
    tags?: string[],
    followers?: number,
    following?: number,
    plays?: number,
    likes?: number,
    handle?: string
  } | null>(initialProfile || null)
  const [likedSongIds, setLikedSongIds] = useState<string[]>([])
  const [likedAlbums, setLikedAlbums] = useState<string[]>([])
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editName, setEditName] = useState(initialProfile?.display_name || '')
  const [editAvatar, setEditAvatar] = useState(initialProfile?.avatar_url || '')

  // New Profile States
  const [profileBio, setProfileBio] = useState<string>(initialProfile?.bio || 'Welcome Dreamer... I create ambient and cinematic soundtracks.')
  const [profileTags, setProfileTags] = useState<string[]>(initialProfile?.tags || ['Dream', 'Dubstep', 'Doom Metal', 'K-pop', 'Ambient-POP'])
  const [profileBanner, setProfileBanner] = useState<string>(initialProfile?.banner_url || '')
  const [profileFollowers, setProfileFollowers] = useState<number>(initialProfile?.followers || 0)
  const [profileFollowing, setProfileFollowing] = useState<number>(initialProfile?.following || 0)
  const [isFollowing, setIsFollowing] = useState<boolean>(false)
  const [profileHandle, setProfileHandle] = useState<string>(initialProfile?.handle || 'ostdreamer')

  // Edit fields state
  const [editBio, setEditBio] = useState<string>(initialProfile?.bio || '')
  const [editTags, setEditTags] = useState<string[]>(initialProfile?.tags || [])
  const [newGenreInput, setNewGenreInput] = useState<string>('')
  const [editBanner, setEditBanner] = useState<string>(initialProfile?.banner_url || '')
  const [editHandle, setEditHandle] = useState<string>(initialProfile?.handle || '')


  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null)

  
  const handleRenameFolder = async (folderId: string, oldName: string) => {
    const newName = window.prompt('새 폴더 이름을 입력하세요:', oldName)
    if (!newName || newName === oldName) return;
    try {
      const folder = playlists.find(p => p.id === folderId)
      if (!folder) return
      
      const res = await fetch(`/api/playlists/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newName.trim(), 
          description: folder.description 
        })
      })
      if (res.ok) {
        fetchPlaylists()
        showToast('폴더 이름이 변경되었습니다.', 'success')
      } else {
        showToast('이름 변경 실패', 'error')
      }
    } catch (e) {
      showToast('오류가 발생했습니다.', 'error')
    }
  }

  const handleCreateSubfolder = async (parentId: string) => {
    const newName = window.prompt('새 하위 폴더 이름을 입력하세요:')
    if (!newName) return;
    try {
      const descriptionToSave = serializePlaylistDescription('folder', '', parentId)
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newName.trim(),
          description: descriptionToSave,
          cover_url: '',
          genre: '',
          is_published: false,
          exposure_order: null
        })
      })
      if (res.ok) {
        fetchPlaylists()
        setExpandedFolders(prev => new Set(prev).add(parentId))
        showToast('하위 폴더가 생성되었습니다.', 'success')
      } else {
        showToast('하위 폴더 생성 실패', 'error')
      }
    } catch (e) {
      showToast('오류가 발생했습니다.', 'error')
    }
  }

  // --- Folder Management State ---
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isFolderManageModalOpen, setIsFolderManageModalOpen] = useState(false)

  const [newQuickFolderName, setNewQuickFolderName] = useState('')
  const [isQuickCreating, setIsQuickCreating] = useState(false)

  const handleQuickCreateFolder = async () => {
    if (!newQuickFolderName.trim()) return showToast('폴더 이름을 입력해주세요.', 'error')
    if (isQuickCreating) return;
    setIsQuickCreating(true)
    try {
      const descriptionToSave = serializePlaylistDescription('folder', '', null)
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newQuickFolderName.trim(),
          description: descriptionToSave,
          cover_url: '',
          genre: '',
          is_published: false,
          exposure_order: null
        })
      })
      if (res.ok) {
        fetchPlaylists()
        setNewQuickFolderName('')
        showToast('새 폴더가 생성되었습니다.', 'success')
      } else {
        const err = await res.json()
        showToast('폴더 생성 실패: ' + (err.error || '오류가 발생했습니다.'), 'error')
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsQuickCreating(false)
    }
  }

  const [moveTrackModalData, setMoveTrackModalData] = useState<any | null>(null)
  const [selectedPlaylistFilter, setSelectedPlaylistFilter] = useState<string>('all')
  
  const handleToggleFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const buildFolderTree = (folders: any[]) => {
    const map = new Map<string, any>()
    folders.forEach(f => map.set(f.id, { ...f, children: [] }))
    const rootNodes: any[] = []
    map.forEach(node => {
      let parentId = null;
      try {
        const parsed = parsePlaylistDescription(node.description);
        parentId = parsed.parentId;
      } catch (e) {}
        
      if (parentId && map.has(parentId)) {
        map.get(parentId).children.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    return rootNodes
  }

  const folderTree = buildFolderTree(playlists.filter(p => !p.isSystem && parsePlaylistDescription(p.description).type === 'folder'))


  // Channels state
  const [channels, setChannels] = useState<any[]>([])
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelSlug, setNewChannelSlug] = useState('')
  const [newChannelBio, setNewChannelBio] = useState('')
  const [newChannelAvatar, setNewChannelAvatar] = useState('')
  const [newChannelBanner, setNewChannelBanner] = useState('')
  const [newChannelTags, setNewChannelTags] = useState<string[]>([])
  const [newChannelGenreInput, setNewChannelGenreInput] = useState('')
  const [newChannelPlays, setNewChannelPlays] = useState('0')
  const [newChannelLikes, setNewChannelLikes] = useState('0')
  const [newChannelFollowers, setNewChannelFollowers] = useState(0)
  const [newChannelFollowing, setNewChannelFollowing] = useState(0)

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 2500)
  }

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleChannelAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('이미지 크기는 2MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-channel-avatar-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setNewChannelAvatar(data.publicUrl)
      showToast('채널 아바타 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) {
      showToast('업로드 실패', 'error')
    }
  }

  const handleChannelBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return showToast('배너 이미지 크기는 5MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-channel-banner-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setNewChannelBanner(data.publicUrl)
      showToast('채널 배너 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) {
      showToast('업로드 실패', 'error')
    }
  }

  const resetChannelModal = () => {
    setNewChannelName('')
    setNewChannelSlug('')
    setNewChannelBio('')
    setNewChannelAvatar('')
    setNewChannelBanner('')
    setNewChannelTags([])
    setNewChannelGenreInput('')
    setNewChannelPlays('0')
    setNewChannelLikes('0')
    setNewChannelFollowers(0)
    setNewChannelFollowing(0)
    setShowChannelModal(false)
  }

  const handleAddChannel = async () => {
    if (!newChannelName) {
      return showToast(uiLanguage === 'KO' ? '채널명을 입력해주세요.' : uiLanguage === 'JA' ? 'チャンネル名を入力してください。' : 'Channel name is required.', 'error')
    }
    
    // 핸들이 비어있으면 자동 생성
    const cleanSlug = newChannelSlug.toLowerCase().replace(/[^a-z0-9_\-]/g, '')
    const finalSlug = cleanSlug || `user_${Math.random().toString(36).substring(2, 10)}`

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newChannelName, 
          slug: finalSlug, 
          bio: newChannelBio,
          avatar_url: newChannelAvatar,
          banner_url: newChannelBanner,
          tags: newChannelTags,
          plays: newChannelPlays,
          likes: newChannelLikes,
          followers: newChannelFollowers,
          following: newChannelFollowing
        })
      })
      const data = await res.json()
      if (!res.ok) {
        return showToast(data.error || '채널 생성 실패 (관리자 권한이 필요할 수 있습니다)', 'error')
      }
      showToast(uiLanguage === 'KO' ? '새 채널이 생성되었습니다.' : uiLanguage === 'JA' ? '新しいチャンネルが作成されました。' : 'New channel created.', 'success')
      resetChannelModal()
      fetchChannels()
    } catch (e) {
      console.error(e)
      showToast('채널 생성 중 오류 발생', 'error')
    }
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0]
    if (!file || !selectedSong) return
    
    // Max 16MB for video to match Spotify Canvas standards, 5MB for image
    const maxSize = type === 'video' ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`${type === 'video' ? '동영상은 16MB' : '이미지는 5MB'} 이하만 업로드 가능합니다.`, 'error');
      return;
    }

    setIsUploadingMedia(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `ugc-${type}-${selectedSong.id}-${Date.now()}.${ext}`
      const supabase = createClient()
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file)
        
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const payload = type === 'image' ? { image_url: publicUrl } : { video_url: publicUrl }

      const res = await fetch(`/api/song-history/${selectedSong.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setHistory(prev => prev.map(s => s.id === selectedSong.id ? { ...s, ...payload } : s))
        setSelectedSong((prev: any) => prev ? { ...prev, ...payload } : null)
        showToast(uiLanguage === 'KO' ? `${type === 'image' ? '썸네일이' : '동영상이'} 업로드되었습니다.` : 'Media uploaded.', 'success')
      } else {
        const err = await res.json()
        showToast(uiLanguage === 'KO' ? '업데이트 실패: ' + (err.error || '오류 발생') : 'Update failed', 'error')
      }
    } catch (err: any) {
      console.error('Media upload error:', err)
      showToast(uiLanguage === 'KO' ? '업로드 중 오류가 발생했습니다.' : 'Error during upload.', 'error')
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const handleDeleteChannel = async (id: string) => {
    if (!window.confirm(uiLanguage === 'KO' ? '정말로 이 채널을 삭제하시겠습니까?' : uiLanguage === 'JA' ? '本当にこのチャンネルを削除しますか？' : 'Are you sure you want to delete this channel?')) {
      return
    }
    
    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        return showToast(data.error || '채널 삭제 실패', 'error')
      }
      showToast(uiLanguage === 'KO' ? '채널이 삭제되었습니다.' : uiLanguage === 'JA' ? 'チャンネルが削除されました。' : 'Channel deleted.', 'success')
      fetchChannels()
    } catch (e) {
      console.error(e)
      showToast(uiLanguage === 'KO' ? '채널 삭제 중 오류가 발생했습니다.' : uiLanguage === 'JA' ? 'チャンネルの削除中にエラーが発生しました。' : 'Error deleting channel.', 'error')
    }
  }
  
  // Playlist Modal State
  const [playlistType, setPlaylistType] = useState<'album' | 'playlist' | 'folder'>('album')
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false)
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [playlistTitle, setPlaylistTitle] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const [playlistCover, setPlaylistCover] = useState('')
  const [playlistGenre, setPlaylistGenre] = useState('')
  const [playlistIsPublished, setPlaylistIsPublished] = useState(false)
  const [playlistExposureOrder, setPlaylistExposureOrder] = useState<number | ''>('')
  const [publicSubView, setPublicSubView] = useState<'main' | 'all_songs' | 'all_albums' | 'all_playlists' | 'following'>('main')

  const handleSelectPlaylist = (playlist: any) => {
    setSelectedPlaylist(playlist);
    const url = new URL(window.location.href);
    url.searchParams.set('playlistId', playlist.id);
    url.searchParams.delete('view');
    window.history.pushState({ playlistId: playlist.id }, '', url.toString());
  };

  const handleSetPublicSubView = (view: 'main' | 'all_songs' | 'all_albums' | 'all_playlists' | 'following') => {
    setPublicSubView(view);
    const url = new URL(window.location.href);
    url.searchParams.delete('playlistId');
    if (view === 'main') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', view);
    }
    window.history.pushState({ view }, '', url.toString());
  };

  const [followedArtists, setFollowedArtists] = useState<any[]>([])

  useEffect(() => {
    try {
      const savedFollows = localStorage.getItem('profile-followed-artists')
      if (savedFollows) {
        setFollowedArtists(JSON.parse(savedFollows))
      }
    } catch (e) {
      console.error(e)
    }
  }, [publicSubView])

  const handleUnfollowArtist = async (artistId: string) => {
    try {
      const savedFollowsRaw = localStorage.getItem('profile-followed-artists')
      let parsedFollows = savedFollowsRaw ? JSON.parse(savedFollowsRaw) : []
      parsedFollows = parsedFollows.filter((item: any) => item.id !== artistId)
      localStorage.setItem('profile-followed-artists', JSON.stringify(parsedFollows))
      setFollowedArtists(parsedFollows)

      setProfileFollowing(prev => Math.max(0, prev - 1))
      
      if (user) {
        const extraKey = `profile-extra-${user.id}`
        const myExtraRaw = localStorage.getItem(extraKey)
        let myExtra = myExtraRaw ? JSON.parse(myExtraRaw) : {}
        let currentFollowing = myExtra.following !== undefined ? Number(myExtra.following) : 0
        myExtra.following = Math.max(0, currentFollowing - 1)
        localStorage.setItem(extraKey, JSON.stringify(myExtra))
      }
      
      showToast('팔로우를 취소했습니다.', 'success')
    } catch (e) {
      console.error(e)
    }
  }

  const handleBackFromDetail = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('playlistId')) {
      window.history.back();
    } else {
      setSelectedPlaylist(null);
      setPublicSubView('main');
    }
  };

  const handleBackFromSubview = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) {
      window.history.back();
    } else {
      setPublicSubView('main');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const playlistId = params.get('playlistId');
      const view = params.get('view') as any;

      if (playlistId) {
        const dbPl = playlists.filter(p => p.is_published);
        const combined = [
          ...dbPl,
          ...defaultHooks.map(h => ({
            id: h.id,
            title: h.title,
            cover_url: h.image,
            plays: h.plays,
            likes: h.likes,
            description: `AI Artist • ${mockAlbumTracks[h.id]?.length || 0}곡`,
            is_published: true,
            is_mock: true,
            tracks: mockAlbumTracks[h.id] || []
          }))
        ];
        const found = combined.find(p => p.id === playlistId);
        if (found) {
          setSelectedPlaylist(found);
        }
      } else {
        setSelectedPlaylist(null);
      }

      if (view) {
        setPublicSubView(view);
      } else {
        setPublicSubView('main');
      }
    };

    window.addEventListener('popstate', handlePopState);
    if (playlists.length > 0) {
      handlePopState();
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, [playlists]);

  // Profile Stats States
  const [profilePlays, setProfilePlays] = useState('0')
  const [profileLikes, setProfileLikes] = useState('0')

  // Edit fields state
  const [editFollowers, setEditFollowers] = useState(0)
  const [editFollowing, setEditFollowing] = useState(0)
  const [editPlays, setEditPlays] = useState('0')
  const [editLikes, setEditLikes] = useState('0')

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

  // Audio Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCoverFile, setUploadCoverFile] = useState<File | null>(null)
  const [uploadCoverUrl, setUploadCoverUrl] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadChannelId, setUploadChannelId] = useState('')
  const [uploadGenre, setUploadGenre] = useState('')
  const [uploadLyrics, setUploadLyrics] = useState('')
  const [uploadPrompt, setUploadPrompt] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadLyricist, setUploadLyricist] = useState('')
  const [uploadComposer, setUploadComposer] = useState('')
  const [uploadArranger, setUploadArranger] = useState('')
  const [uploadDuration, setUploadDuration] = useState<number | null>(null)
  const [uploadIsPublished, setUploadIsPublished] = useState(true)
  const [isUploading, setIsUploading] = useState(false)

  const openUploadModal = () => {
    setUploadFile(null)
    setUploadCoverFile(null)
    setUploadCoverUrl('')
    setUploadTitle('')
    setUploadGenre('')
    setUploadLyrics('')
    setUploadPrompt('')
    setUploadNotes('')
    setUploadLyricist('')
    setUploadComposer('')
    setUploadArranger('')
    setUploadChannelId('')
    setUploadDuration(null)
    setUploadIsPublished(true)
    setIsUploading(false)
    setIsUploadModalOpen(true)
  }

  const closeUploadModal = () => {
    setIsUploadModalOpen(false)
  }

  const handleUploadCoverImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('이미지 크기는 2MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-track-cover-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setUploadCoverUrl(data.publicUrl)
      showToast('커버 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) { showToast('업로드 실패', 'error') }
  }

  const handleAudioUpload = async () => {
    if (!uploadFile) {
      showToast('오디오 파일을 선택해주세요.', 'error')
      return
    }
    if (!uploadTitle.trim()) {
      showToast('곡 제목을 입력해주세요.', 'error')
      return
    }
    if (!uploadGenre) {
      showToast('장르를 선택해주세요.', 'error')
      return
    }

    setIsUploading(true)
    try {
      // 1. Get signed upload URL via API /api/upload
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type })
      })
      const signData = await res.json()
      if (!res.ok) throw new Error(signData.error || 'signed URL 발급 실패')

      // 2. Upload file to storage using binary PUT
      const uploadRes = await fetch(signData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type },
        body: uploadFile
      })
      if (!uploadRes.ok) throw new Error('오디오 파일 업로드 실패')

      // The path returned is signData.path (e.g. `audio/uuid.mp3`)
      // Save this path as the song's audio_url so it is resolved dynamically
      const audioUrl = signData.path

      // 3. Insert into database song_history
      const supabase = createClient()
      const { error: insertError } = await supabase
        .from('song_history')
        .insert({
          user_id: user.id,
          title: uploadTitle.trim(),
          channel_id: uploadChannelId || null,
          prompt: uploadPrompt.trim() || '',
          lyrics: uploadLyrics.trim() || '',
          notes: uploadNotes.trim() || '',
          genre: uploadGenre,
          audio_url: audioUrl,
          image_url: uploadCoverUrl || '',
          status: 'completed',
          is_published: uploadIsPublished,
          form: {
            duration_sec: uploadDuration,
            genre: uploadGenre,
            lyricist: uploadLyricist.trim(),
            composer: uploadComposer.trim(),
            arranger: uploadArranger.trim()
          }
        })

      if (insertError) throw insertError

      showToast('음원이 성공적으로 등록되었습니다.', 'success')
      setIsUploadModalOpen(false)
      fetchHistory()
    } catch (err: any) {
      console.error(err)
      showToast(err.message || '음원 등록 실패', 'error')
    } finally {
      setIsUploading(false)
    }
  }




  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setEditName(data.display_name || '')
        setEditAvatar(data.avatar_url || '')
        if (data.credits !== undefined && data.credits !== null) {
          setUserCredits(data.credits)
          localStorage.setItem('user-credits', String(data.credits))
        }
      }
    } catch (e) { console.error(e) }
  }

  // Load extra profile data on mount
  useEffect(() => {
    if (!user) return
    try {
      const hasDbValues = profile && (
        profile.banner_url !== undefined ||
        profile.bio !== undefined ||
        profile.handle !== undefined
      )

      if (hasDbValues) {
        if (profile.bio !== undefined && profile.bio !== null) {
          setProfileBio(profile.bio)
          setEditBio(profile.bio)
        }
        if (profile.tags !== undefined && profile.tags !== null) {
          setProfileTags(profile.tags)
          setEditTags(profile.tags)
        }
        if (profile.banner_url !== undefined && profile.banner_url !== null) {
          setProfileBanner(profile.banner_url)
          setEditBanner(profile.banner_url)
        }
        if (profile.followers !== undefined && profile.followers !== null) {
          setProfileFollowers(profile.followers)
          setEditFollowers(profile.followers)
        }
        if (profile.following !== undefined && profile.following !== null) {
          setProfileFollowing(profile.following)
          setEditFollowing(profile.following)
        }
        if (profile.plays !== undefined && profile.plays !== null) {
          setProfilePlays(String(profile.plays))
          setEditPlays(String(profile.plays))
        }
        if (profile.likes !== undefined && profile.likes !== null) {
          setProfileLikes(String(profile.likes))
          setEditLikes(String(profile.likes))
        }
        if (profile.handle !== undefined && profile.handle !== null) {
          setProfileHandle(profile.handle)
          setEditHandle(profile.handle)
        } else {
          const defaultHandle = profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer'
          setProfileHandle(defaultHandle)
          setEditHandle(defaultHandle)
        }
      } else {
        const extra = localStorage.getItem(`profile-extra-${user.id}`)
        if (extra) {
          const parsed = JSON.parse(extra)
          if (parsed.bio !== undefined) {
            setProfileBio(parsed.bio)
            setEditBio(parsed.bio)
          }
          if (parsed.tags !== undefined) {
            setProfileTags(parsed.tags)
            setEditTags(parsed.tags)
          }
          if (parsed.banner_url !== undefined) {
            setProfileBanner(parsed.banner_url)
            setEditBanner(parsed.banner_url)
          }
          if (parsed.followers !== undefined) {
            setProfileFollowers(parsed.followers)
            setEditFollowers(parsed.followers)
          }
          if (parsed.following !== undefined) {
            setProfileFollowing(parsed.following)
            setEditFollowing(parsed.following)
          }
          if (parsed.plays !== undefined) {
            setProfilePlays(parsed.plays)
            setEditPlays(parsed.plays)
          }
          if (parsed.likes !== undefined) {
            setProfileLikes(parsed.likes)
            setEditLikes(parsed.likes)
          }
          if (parsed.handle !== undefined) {
            setProfileHandle(parsed.handle)
            setEditHandle(parsed.handle)
          } else {
            const defaultHandle = profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer'
            setProfileHandle(defaultHandle)
            setEditHandle(defaultHandle)
          }
        } else {
          // Initialize defaults
          setEditBio(profileBio)
          setEditTags([...profileTags])
          setEditBanner(profileBanner)
          setEditFollowers(profileFollowers)
          setEditFollowing(profileFollowing)
          setEditPlays(profilePlays)
          setEditLikes(profileLikes)
          const defaultHandle = profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer'
          setProfileHandle(defaultHandle)
          setEditHandle(defaultHandle)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [user, profile])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/song-history')
      if (res.ok) {
        const rawData = await res.json() || []
        const completedData = rawData.filter((item: any) => item.audio_url || item.file_url)
        completedData.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        setHistory(completedData)
      }
    } catch (e) { console.error(e) }
  }

  const handleMoveTrack = async (trackId: string, newPlaylistId: string | null) => {
    try {
      const res = await fetch(`/api/song-history/${trackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: newPlaylistId })
      })
      if (res.ok) {
        await fetchHistory()
      }
    } catch (e) {
      console.error(e)
    }
    setOpenPlaylistTrackMenuId(null)
  }

  const handleDeleteTrack = async (trackId: string) => {
    try {
      const res = await fetch(`/api/song-history?id=${trackId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchHistory()
      } else {
        console.error('Failed to delete track')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists')
      if (res.ok) setPlaylists(await res.json() || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    fetchProfile()
    fetchHistory()
    fetchPlaylists()
    fetchChannels()
    try {
      const savedIds = localStorage.getItem('profile-liked-song-ids')
      if (savedIds) {
        setLikedSongIds(JSON.parse(savedIds))
      }
      const savedAlbums = localStorage.getItem('user_liked_albums')
      if (savedAlbums) {
        setLikedAlbums(JSON.parse(savedAlbums))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    const handleStorageChange = () => {
      const savedAlbums = localStorage.getItem('user_liked_albums')
      if (savedAlbums) {
        try {
          setLikedAlbums(JSON.parse(savedAlbums))
        } catch (e) {
          console.error(e)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Parse URL tab parameter
  useEffect(() => {
    const handleUrlTab = () => {
      const tab = searchParams.get('tab')
      if (tab === 'settings') {
        const section = searchParams.get('section')
        router.replace(section ? `/settings?section=${section}` : '/settings')
      } else if (tab === 'private') {
        setActiveTab('private')
      } else if (tab === 'public') {
        setActiveTab('public')
      } else if (tab === 'channels') {
        setActiveTab('channels')
      }
    }

    handleUrlTab()
    window.addEventListener('popstate', handleUrlTab)
    return () => window.removeEventListener('popstate', handleUrlTab)
  }, [router, searchParams])

  // Load Settings and Preferences
  useEffect(() => {
    const savedPlan = localStorage.getItem('user-plan')
    if (savedPlan) {
      setUserPlan(savedPlan)
    } else {
      localStorage.setItem('user-plan', 'free')
    }

    const savedBilling = localStorage.getItem('user-plan-billing')
    if (savedBilling) {
      setBillingCycle(savedBilling)
    }

    const savedRenewal = localStorage.getItem('user-plan-renewal')
    if (savedRenewal) {
      setPlanRenewalDate(savedRenewal)
    }

    const savedCredits = localStorage.getItem('user-credits')
    if (savedCredits !== null) {
      setUserCredits(parseFloat(savedCredits))
    } else {
      localStorage.setItem('user-credits', '120')
    }

    const savedTx = localStorage.getItem('user-transactions')
    if (savedTx) {
      try {
        setTransactions(JSON.parse(savedTx))
      } catch (e) {
        console.error(e)
      }
    } else {
      const defaultTx = [
        { id: 'tx-1', date: '2026-05-28 10:15', type: 'charge', desc: 'Credit Top-up (+100)', amount: '+100', status: 'Completed' },
        { id: 'tx-2', date: '2026-05-27 15:40', type: 'use', desc: 'Song Generation (-10)', amount: '-10', status: 'Completed' },
        { id: 'tx-3', date: '2026-05-26 11:22', type: 'use', desc: 'Stem Extraction (-5)', amount: '-5', status: 'Completed' },
      ]
      setTransactions(defaultTx)
      localStorage.setItem('user-transactions', JSON.stringify(defaultTx))
    }

    const savedLanguage = localStorage.getItem('language') as 'KO' | 'EN' | 'JA' | null
    if (savedLanguage === 'KO' || savedLanguage === 'EN' || savedLanguage === 'JA') {
      setUiLanguage(savedLanguage)
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail === 'KO' || customEvent.detail === 'EN' || customEvent.detail === 'JA') {
        setUiLanguage(customEvent.detail as 'KO' | 'EN' | 'JA')
      }
    }
    window.addEventListener('languageChange', handleLanguageChange)

    const savedQuality = localStorage.getItem('pref-audio-quality') as 'standard' | 'high' | null
    if (savedQuality) setAudioQuality(savedQuality)
    
    const savedAutoplay = localStorage.getItem('pref-autoplay')
    if (savedAutoplay !== null) setAutoplay(savedAutoplay === 'true')

    return () => {
      window.removeEventListener('languageChange', handleLanguageChange)
    }
  }, [])

  const changeLanguage = (lang: 'KO' | 'EN' | 'JA') => {
    setUiLanguage(lang)
    localStorage.setItem('language', lang)
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }))
    showToast(lang === 'KO' ? '언어가 한국어로 변경되었습니다.' : lang === 'JA' ? '言語が日本語に変更されました。' : 'Language set to English.', 'success')
  }

  const handleQualityChange = (val: 'standard' | 'high') => {
    setAudioQuality(val)
    localStorage.setItem('pref-audio-quality', val)
    showToast(uiLanguage === 'KO' ? `스트리밍 음질: ${val === 'high' ? '고음질 (320kbps)' : '일반음질 (128kbps)'}` : uiLanguage === 'JA' ? `ストリーミング音質: ${val === 'high' ? '高音質 (320kbps)' : '標準音質 (128kbps)'}` : `Streaming Quality: ${val === 'high' ? 'High (320kbps)' : 'Standard (128kbps)'}`, 'success')
  }

  const handleAutoplayChange = (val: boolean) => {
    setAutoplay(val)
    localStorage.setItem('pref-autoplay', String(val))
    showToast(uiLanguage === 'KO' ? `자동 재생: ${val ? '켜짐' : '꺼짐'}` : uiLanguage === 'JA' ? `自動再生: ${val ? 'オン' : 'オフ'}` : `Autoplay: ${val ? 'ON' : 'OFF'}`, 'success')
  }

  const handleChargeCredits = (amount: number) => {
    const nextCredits = userCredits + amount
    setUserCredits(nextCredits)
    localStorage.setItem('user-credits', String(nextCredits))

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    const newTx = {
      id: `tx-${Date.now()}`,
      date: dateStr,
      type: 'charge',
      desc: uiLanguage === 'KO' ? `크레딧 충전 (+${amount})` : uiLanguage === 'JA' ? `クレジットチャージ (+${amount})` : `Credit Top-up (+${amount})`,
      amount: `+${amount}`,
      status: 'Completed'
    }
    const nextTx = [newTx, ...transactions]
    setTransactions(nextTx)
    localStorage.setItem('user-transactions', JSON.stringify(nextTx))
    showToast(uiLanguage === 'KO' ? `${amount} 크레딧이 충전되었습니다!` : uiLanguage === 'JA' ? `${amount} クレジットが正常にチャージされました！` : `${amount} credits successfully charged!`, 'success')
  }

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

  const startEditingProfile = () => {
    setEditName(profile?.display_name || '')
    setEditAvatar(profile?.avatar_url || '')
    setEditBio(profileBio)
    setEditTags([...profileTags])
    setEditBanner(profileBanner)
    setEditFollowers(profileFollowers)
    setEditFollowing(profileFollowing)
    setEditPlays(profilePlays)
    setEditLikes(profileLikes)
    setEditHandle(profileHandle)
    setNewGenreInput('')
    setIsEditingProfile(true)
  }

  const saveProfile = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          display_name: editName, 
          avatar_url: editAvatar,
          bio: editBio,
          tags: editTags,
          banner_url: editBanner,
          followers: editFollowers,
          following: editFollowing,
          plays: editPlays,
          likes: editLikes,
          handle: editHandle
        })
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        
        // Save extra fields to localStorage
        const extraData = {
          bio: editBio,
          tags: editTags,
          banner_url: editBanner,
          followers: editFollowers,
          following: editFollowing,
          plays: editPlays,
          likes: editLikes,
          handle: editHandle
        }
        localStorage.setItem(`profile-extra-${user.id}`, JSON.stringify(extraData))
        
        setProfileBio(editBio)
        setProfileTags(editTags)
        setProfileBanner(editBanner)
        setProfileFollowers(editFollowers)
        setProfileFollowing(editFollowing)
        setProfilePlays(editPlays)
        setProfileLikes(editLikes)
        setProfileHandle(editHandle)
        
        setIsEditingProfile(false)
      }
    } catch (e) { console.error(e) }
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('이미지 크기는 2MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-avatar-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditAvatar(data.publicUrl)
      showToast('아바타 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) { showToast('업로드 실패', 'error') }
  }

  const handleProfileBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return showToast('배너 이미지 크기는 5MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-banner-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditBanner(data.publicUrl)
      showToast('배너 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) { showToast('업로드 실패', 'error') }
  }

  const handlePlaylistCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('이미지 크기는 2MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-playlist-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setPlaylistCover(data.publicUrl)
      showToast('플레이리스트 커버 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) { showToast('업로드 실패', 'error') }
  }

  const openCreateModal = (type: 'album' | 'playlist' | 'folder') => {
    setPlaylistType(type)
    setEditingPlaylistId(null)
    setPlaylistTitle('')
    setPlaylistDescription('')
    setPlaylistCover('')
    setPlaylistGenre('')
    setPlaylistIsPublished(false)
    setPlaylistExposureOrder('')
    setIsPlaylistModalOpen(true)
  }

  const openEditModal = (playlist: any) => {
    const { type, text } = parsePlaylistDescription(playlist.description)
    setPlaylistType(type)
    setEditingPlaylistId(playlist.id)
    setPlaylistTitle(playlist.title)
    setPlaylistDescription(text)
    setPlaylistCover(playlist.cover_url || '')
    setPlaylistGenre(playlist.genre || '')
    setPlaylistIsPublished(playlist.is_published || false)
    setPlaylistExposureOrder(playlist.exposure_order || '')
    setIsPlaylistModalOpen(true)
  }

  const closePlaylistModal = () => {
    setIsPlaylistModalOpen(false)
  }

  const handleCancelEdit = () => {
    const original = editingPlaylistId ? playlists.find(p => p.id === editingPlaylistId) : null
    const originalParsed = original ? parsePlaylistDescription(original.description) : null
    const hasChanges = original 
      ? (playlistTitle !== original.title ||
         playlistDescription !== (originalParsed?.text || '') ||
         playlistCover !== (original.cover_url || '') ||
         playlistGenre !== (original.genre || '') ||
         playlistIsPublished !== (original.is_published || false) ||
         playlistExposureOrder !== (original.exposure_order || '') ||
         playlistType !== (originalParsed?.type || 'album'))
      : (playlistTitle !== '' || playlistDescription !== '' || playlistCover !== '' || playlistGenre !== '' || playlistIsPublished !== false || playlistExposureOrder !== '')

    const typeLabel = playlistType === 'album' ? '앨범' : '플레이리스트'

    if (hasChanges) {
      setConfirmModal({
        isOpen: true,
        title: `${typeLabel} 편집 취소`,
        message: `작성 중인 변경 사항이 저장되지 않습니다. 정말 편집을 취소하시겠습니까?`,
        confirmText: '편집 취소 (닫기)',
        cancelText: '계속 수정하기',
        isDestructive: true,
        onConfirm: () => {
          setConfirmModal(null)
          closePlaylistModal()
        }
      })
    } else {
      closePlaylistModal()
    }
  }

  const savePlaylistModal = async () => {
    const typeLabel = playlistType === 'album' ? '앨범' : '플레이리스트'
    if (!playlistTitle) return showToast(`${typeLabel} 이름을 입력해주세요.`, 'error')
    
    // 공개된 앨범/플레이리스트일 경우 장르가 필수인지 검사
    if (playlistIsPublished && !playlistGenre) {
      return showToast(`공개된(퍼블리싱된) ${typeLabel}은 장르 카테고리를 반드시 선택해야 합니다.`, 'error');
    }

    const executeSave = async () => {
      try {
        const descriptionToSave = serializePlaylistDescription(playlistType, playlistDescription)

        if (editingPlaylistId) {
          const res = await fetch(`/api/playlists/${editingPlaylistId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: playlistTitle, 
              description: descriptionToSave, 
              cover_url: playlistCover,
              genre: playlistGenre,
              is_published: playlistIsPublished,
              exposure_order: playlistExposureOrder === '' ? null : Number(playlistExposureOrder)
            })
          })
          if (res.ok) {
            fetchPlaylists()
            if (selectedPlaylist && selectedPlaylist.id === editingPlaylistId) {
              setSelectedPlaylist(await res.json())
            }
            closePlaylistModal()
            showToast(`${typeLabel} 정보가 수정되었습니다.`, 'success')
          } else {
            const err = await res.json()
            showToast(`${typeLabel} 수정 실패: ` + (err.error || '오류가 발생했습니다.'), 'error')
          }
        } else {
          const res = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: playlistTitle, 
              description: descriptionToSave, 
              cover_url: playlistCover,
              genre: playlistGenre,
              is_published: playlistIsPublished,
              exposure_order: playlistExposureOrder === '' ? null : Number(playlistExposureOrder)
            })
          })
          if (res.ok) {
            fetchPlaylists()
            closePlaylistModal()
            showToast(`${typeLabel}이 생성되었습니다.`, 'success')
          } else {
            const err = await res.json()
            showToast(`${typeLabel} 생성 실패: ` + (err.error || 'DB 테이블 설정을 확인해주세요.'), 'error')
          }
        }
      } catch (e: any) {
        console.error(e)
        showToast('오류가 발생했습니다: ' + (e.message || '서버 연결 상태를 확인해주세요.'), 'error')
      }
    }

    const existingPlaylist = editingPlaylistId ? playlists.find(p => p.id === editingPlaylistId) : null
    const isUnpublishing = existingPlaylist && existingPlaylist.is_published && !playlistIsPublished

    if (playlistIsPublished && (!existingPlaylist || !existingPlaylist.is_published)) {
      setConfirmModal({
        isOpen: true,
        title: `${typeLabel} 퍼블리싱 등록`,
        message: `'${playlistTitle}' ${typeLabel}을 내 채널(공개 프로필)에 등록하여 공개하시겠습니까?`,
        confirmText: '등록 및 저장',
        cancelText: '취소',
        isDestructive: false,
        onConfirm: async () => {
          setConfirmModal(null)
          await executeSave()
        }
      })
    } else if (isUnpublishing) {
      setConfirmModal({
        isOpen: true,
        title: `${typeLabel} 퍼블리싱 취소`,
        message: `'${playlistTitle}' ${typeLabel}의 퍼블리싱을 취소하고 비공개로 전환하시겠습니까?`,
        confirmText: '퍼블리싱 취소 및 저장',
        cancelText: '취소',
        isDestructive: true,
        onConfirm: async () => {
          setConfirmModal(null)
          await executeSave()
        }
      })
    } else {
      await executeSave()
    }
  }

  const deletePlaylist = async (id: string) => {
    const playlist = playlists.find(p => p.id === id)
    const type = playlist ? parsePlaylistDescription(playlist.description).type : 'album'
    const typeLabel = type === 'playlist' ? '플레이리스트' : '앨범'
    const title = playlist ? playlist.title : `이 ${typeLabel}`
    
    setConfirmModal({
      isOpen: true,
      title: `${typeLabel} 삭제`,
      message: `정말 '${title}' ${typeLabel}을 삭제하시겠습니까?\n(${typeLabel} 안의 곡들은 삭제되지 않고 보관함에 보존됩니다.)`,
      confirmText: '삭제',
      cancelText: '취소',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
          if (res.ok) {
            if (selectedPlaylist?.id === id) setSelectedPlaylist(null)
            fetchPlaylists()
            showToast(`${typeLabel}이 삭제되었습니다.`, 'success')
          }
        } catch (e) { console.error(e) }
      }
    })
  }


  const togglePublishMusic = async (historyId: string, currentStatus: boolean) => {
    const song = history.find(h => h.id === historyId)
    const title = song ? song.title : '이 곡'
    
    if (!currentStatus) {
      setPublishGenre(song?.genre || '')
      setConfirmModal({
        isOpen: true,
        title: '음원 퍼블리싱',
        message: `'${title}' 곡을 퍼블리싱하여 내 채널에 공개하시겠습니까?\n퍼블리싱하려면 장르 카테고리를 필수로 선택해주셔야 합니다.`,
        confirmText: '퍼블리싱',
        cancelText: '취소',
        isDestructive: false,
        showGenreSelect: true,
        onConfirm: async (selectedGenre) => {
          if (!selectedGenre) {
            showToast('장르 카테고리를 선택해야 퍼블리싱할 수 있습니다.', 'error')
            return
          }
          try {
            const supabase = createClient()
            const { error } = await supabase.from('song_history').update({ 
              is_published: true, 
              genre: selectedGenre 
            }).eq('id', historyId)
            if (!error) fetchHistory()
          } catch (e) { console.error(e) }
        }
      })
    } else {
      setConfirmModal({
        isOpen: true,
        title: '비공개 전환',
        message: `'${title}' 곡을 비공개로 전환하시겠습니까?`,
        confirmText: '비공개 전환',
        cancelText: '취소',
        isDestructive: false,
        onConfirm: async () => {
          try {
            const supabase = createClient()
            const { error } = await supabase.from('song_history').update({ is_published: false }).eq('id', historyId)
            if (!error) fetchHistory()
          } catch (e) { console.error(e) }
        }
      })
    }
  }

  const togglePublishPlaylist = async (id: string, currentStatus: boolean) => {
    const playlist = playlists.find(p => p.id === id)
    const title = playlist ? playlist.title : '이 앨범'
    
    if (!currentStatus) {
      setPublishGenre(playlist?.genre || '')
      setConfirmModal({
        isOpen: true,
        title: '앨범 전체 퍼블리싱',
        message: `'${title}' 앨범 전체를 내 채널에 공개하시겠습니까?\n퍼블리싱하려면 장르 카테고리를 필수로 선택해주셔야 합니다.`,
        confirmText: '앨범 퍼블리싱',
        cancelText: '취소',
        isDestructive: false,
        showGenreSelect: true,
        onConfirm: async (selectedGenre) => {
          if (!selectedGenre) {
            showToast('장르 카테고리를 선택해야 퍼블리싱할 수 있습니다.', 'error')
            return
          }
          try {
            const res = await fetch(`/api/playlists/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_published: true, genre: selectedGenre })
            })
            if (res.ok) {
              fetchPlaylists()
              showToast('앨범이 퍼블리싱되었습니다.', 'success')
              if (selectedPlaylist && selectedPlaylist.id === id) {
                setSelectedPlaylist(await res.json())
              }
            }
          } catch (e) { console.error(e) }
        }
      })
    } else {
      setConfirmModal({
        isOpen: true,
        title: '앨범 비공개 전환',
        message: `'${title}' 앨범을 비공개로 전환하시겠습니까?`,
        confirmText: '비공개 전환',
        cancelText: '취소',
        isDestructive: false,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/playlists/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_published: false })
            })
            if (res.ok) {
              fetchPlaylists()
              showToast('앨범이 비공개로 전환되었습니다.', 'info')
              if (selectedPlaylist && selectedPlaylist.id === id) {
                setSelectedPlaylist(await res.json())
              }
            }
          } catch (e) { console.error(e) }
        }
      })
    }
  }

  const addMusicToPlaylist = async (historyId: string, playlistId: string | null) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('song_history').update({ playlist_id: playlistId }).eq('id', historyId)
      if (error) {
        showToast('이동 실패: 권한이 필요합니다.', 'error')
        console.error(error)
      } else {
        fetchHistory()
        showToast('음원이 이동되었습니다.', 'success')
      }
    } catch (e) { console.error(e) }
  }

  const updateSongExposureOrder = async (historyId: string, order: number | null) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('song_history').update({ exposure_order: order }).eq('id', historyId)
      if (error) {
        showToast('노출 순위 변경 실패: 권한이 필요합니다.', 'error')
        console.error(error)
      } else {
        fetchHistory()
        showToast('음원 노출 순위가 수정되었습니다.', 'success')
      }
    } catch (e) { console.error(e) }
  }

  const assignSongToChannel = async (historyId: string, channelId: string | null) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('song_history').update({ channel_id: channelId }).eq('id', historyId)
      if (error) {
        showToast(uiLanguage === 'KO' ? '채널 연결 변경 실패' : uiLanguage === 'JA' ? 'チャンネルの変更に失敗しました' : 'Failed to change channel link', 'error')
        console.error(error)
      } else {
        fetchHistory()
        showToast(channelId 
          ? (uiLanguage === 'KO' ? '음원이 채널에 연결되었습니다.' : uiLanguage === 'JA' ? '曲がチャンネルに割り当てられました。' : 'Song assigned to channel.')
          : (uiLanguage === 'KO' ? '채널 연결이 해제되었습니다.' : uiLanguage === 'JA' ? 'チャンネルの接続が解除されました。' : 'Channel unlinked.'), 'success')
      }
    } catch (e) { console.error(e) }
  }

  const assignPlaylistToChannel = async (playlistId: string, channelId: string | null) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId })
      })
      if (res.ok) {
        fetchPlaylists()
        if (selectedPlaylist && selectedPlaylist.id === playlistId) {
          setSelectedPlaylist(await res.json())
        }
        showToast(channelId 
          ? (uiLanguage === 'KO' ? '앨범이 채널에 연결되었습니다.' : uiLanguage === 'JA' ? 'アルバムがチャンネルに割り当てられました。' : 'Album assigned to channel.')
          : (uiLanguage === 'KO' ? '채널 연결이 해제되었습니다.' : uiLanguage === 'JA' ? 'チャンネルの接続が解除されました。' : 'Channel unlinked.'), 'success')
      } else {
        throw new Error('Failed to change channel link')
      }
    } catch (e) {
      console.error(e)
      showToast(uiLanguage === 'KO' ? '채널 연결 변경 실패' : uiLanguage === 'JA' ? 'チャンネルの変更に失敗しました' : 'Failed to change channel link', 'error')
    }
  }

  const toggleLikeSong = (song: any) => {
    try {
      const savedIdsStr = localStorage.getItem('profile-liked-song-ids') || '[]'
      const savedSongsStr = localStorage.getItem('profile-liked-songs') || '[]'
      
      let savedIds = JSON.parse(savedIdsStr) as string[]
      let savedSongs = JSON.parse(savedSongsStr) as any[]
      
      const isLiked = savedIds.includes(song.id)
      
      if (isLiked) {
        savedIds = savedIds.filter(id => id !== song.id)
        savedSongs = savedSongs.filter(s => s.id !== song.id)
        showToast('좋아요를 취소했습니다.', 'info')
      } else {
        savedIds.push(song.id)
        
        // Map song history item to standard Track structure
        const mappedTrack = {
          id: song.id,
          album_id: song.playlist_id || 'loose',
          track_number: 1,
          title: song.title,
          duration_sec: song.duration_sec || 180,
          file_url: song.audio_url,
          file_size: null,
          waveform_data: null,
          lyrics: null,
          style_prompt: song.style_desc || null,
          bpm: null,
          song_key: null,
          prompt_meta: null,
          lyricist: song.form?.lyricist || '',
          composer: song.form?.composer || '',
          arranger: song.form?.arranger || '',
          play_count: Number(song.form?.play_count || (song.title?.length * 450 + 1000) || 0),
          like_count: Number(song.form?.like_count || (song.title?.length * 25 + 15) || 0) + 1,
          status: 'published',
          created_at: song.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          album: {
            id: song.playlist_id || 'loose',
            title: song.playlist_title || 'Single Track',
            cover_url: song.image_url || '/default-album.png',
            artist: {
              name: song.channel_id && channels ? (channels.find((c: any) => c.id === song.channel_id)?.name || profile?.display_name || user?.email?.split('@')[0] || 'AI Artist') : (profile?.display_name || user?.email?.split('@')[0] || 'AI Artist'),
              slug: song.channel_id && channels ? (channels.find((c: any) => c.id === song.channel_id)?.slug || user?.email?.split('@')[0] || 'user') : (user?.email?.split('@')[0] || 'user'),
              avatar_url: song.channel_id && channels ? (channels.find((c: any) => c.id === song.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
            }
          }
        }
        
        savedSongs.push(mappedTrack)
        showToast('플레이리스트 좋아요에 등록되었습니다.', 'success')
      }
      
      localStorage.setItem('profile-liked-song-ids', JSON.stringify(savedIds))
      localStorage.setItem('profile-liked-songs', JSON.stringify(savedSongs))
      setLikedSongIds(savedIds)
      
      // Update the local history list likes count dynamically if it's there
      setHistory(prev => prev.map(h => {
        if (h.id === song.id) {
          const currentLikes = Number(h.form?.like_count || (h.title?.length * 25 + 15) || 0)
          return {
            ...h,
            form: {
              ...(h.form || {}),
              like_count: isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
            }
          }
        }
        return h
      }))
    } catch (e) {
      console.error(e)
    }
  }

  const isSongLiked = (songId: string) => {
    return likedSongIds.includes(songId)
  }

  const isPublicView = activeTab === 'public'
  const isPrivateView = activeTab === 'private'
  const isAlbumsView = activeTab === 'albums'
  
  const dbPublicLooseTracks = history.filter(h => {
    return !!(h.is_published && (h.audio_url || h.file_url) && !h.channel_id)
  })

  const totalProfilePlays = useMemo(() => {
    const trackPlays = dbPublicLooseTracks.reduce((sum, song) => {
      const plays = song.form?.play_count || (song.title?.length ? song.title.length * 450 + 1000 : 0) || 0
      return sum + Number(plays)
    }, 0)
    return trackPlays + Number(profilePlays || 0)
  }, [dbPublicLooseTracks, profilePlays])

  const totalProfileLikes = useMemo(() => {
    const trackLikes = dbPublicLooseTracks.reduce((sum, song) => {
      const likes = song.form?.like_count || (song.title?.length ? song.title.length * 25 + 15 : 0) || 0
      return sum + Number(likes)
    }, 0)
    return trackLikes + Number(profileLikes || 0)
  }, [dbPublicLooseTracks, profileLikes])
  const visibleLooseTracksRaw = isPublicView
    ? dbPublicLooseTracks
    : history

  
  let visibleLooseTracks = trackSearchQuery
    ? visibleLooseTracksRaw.filter(h => 
        h.title?.toLowerCase().includes(trackSearchQuery.toLowerCase()) || 
        h.genre?.toLowerCase().includes(trackSearchQuery.toLowerCase())
      )
    : visibleLooseTracksRaw

  if (selectedPlaylistFilter === 'liked') {
    visibleLooseTracks = visibleLooseTracks.filter(h => isSongLiked(h.id))
  } else if (selectedPlaylistFilter === 'uploaded') {
    visibleLooseTracks = visibleLooseTracks.filter(h => h.source === 'upload' || h.type === 'upload')
  } else if (selectedPlaylistFilter === 'default' || selectedPlaylistFilter === 'all') {
    visibleLooseTracks = visibleLooseTracks.filter(h => {
      if (isPublicView) return true;
      if (!h.playlist_id) return true;
      const parentPlaylist = playlists.find(p => p.id === h.playlist_id);
      if (!parentPlaylist) return true;
      const type = parsePlaylistDescription(parentPlaylist.description).type;
      return type === 'album'; // Only show if it's an album. If it's a playlist (folder), hide it.
    })
  } else {
    visibleLooseTracks = visibleLooseTracks.filter(h => h.playlist_id === selectedPlaylistFilter)
  }

  // Apply sorting
  if (trackSortOrder === 'newest') {
    visibleLooseTracks = [...visibleLooseTracks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (trackSortOrder === 'oldest') {
    visibleLooseTracks = [...visibleLooseTracks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }



  const folderTrackCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    history.forEach(h => {
      if (h.playlist_id) {
        counts[h.playlist_id] = (counts[h.playlist_id] || 0) + 1
      }
    })
    return counts
  }, [history])

  const userAlbums = playlists.filter(p => parsePlaylistDescription(p.description).type === 'album')
  const userPlaylists = playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist')

  const dbPublicAlbums = userAlbums.filter(p => p.is_published)
  const dbPublicPlaylists = userPlaylists.filter(p => p.is_published)

  const visibleAlbums = isPublicView
    ? dbPublicAlbums
    : userAlbums

  const visiblePlaylists = isPublicView
    ? dbPublicPlaylists
    : userPlaylists

  const allPublicAlbums = [
    ...dbPublicAlbums,
    ...defaultHooks.map(h => ({
      id: h.id,
      title: h.title,
      cover_url: h.image,
      plays: h.plays,
      likes: h.likes,
      description: `AI Artist • ${mockAlbumTracks[h.id]?.length || 0}곡`,
      is_published: true,
      is_mock: true,
      tracks: mockAlbumTracks[h.id] || []
    }))
  ]
  const sortedPublicAlbums = [...allPublicAlbums].sort((a: any, b: any) => {
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
  });

  const renderAlbumShowcaseCard = (playlist: any) => {
    const isMock = playlist.is_mock
    const tracksCount = isMock 
      ? playlist.tracks?.length || 0 
      : history.filter(h => h.playlist_id === playlist.id).length
    
    const isLiked = likedAlbums.includes(playlist.id)
    const baseLikes = playlist.likes || 0
    const finalLikes = isLiked ? Number(baseLikes) + 1 : Number(baseLikes)

    const playsLikes = isMock 
      ? `▶ ${playlist.plays} • ❤ ${finalLikes}`
      : `▶ ${tracksCount} 곡 • ❤ ${isLiked ? 1 : 0}`

    return (
      <div 
        key={playlist.id} 
        className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-outline-variant/10 shadow-lg group cursor-pointer"
        onClick={() => handleSelectPlaylist(playlist)}
      >
        <img 
          src={playlist.cover_url || "/default-album.png"} 
          alt={playlist.title} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-album.png";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-white tracking-tight line-clamp-1">{playlist.title}</span>
            <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
              {playsLikes}
            </span>
          </div>
        </div>

        {/* Floating Circular Heart Button on Hover */}
        <div className={`absolute top-2.5 right-2.5 z-20 transition-all duration-300 ${isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleAlbumLikeToggle(playlist.id)
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
              isLiked
                ? 'bg-[#e3fe06] text-black font-extrabold'
                : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
            }`}
            title="좋아요"
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    )
  }
  const selectedPlaylistTracks = selectedPlaylist 
    ? (selectedPlaylist.is_mock 
        ? (selectedPlaylist.tracks || []) 
        : history.filter(h => h.playlist_id === selectedPlaylist.id)) 
    : []

  const handlePlayMusic = (item: any) => {
    const trackToPlay = {
      id: item.id,
      title: item.title,
      file_url: item.audio_url,
      duration_sec: item.duration_sec || item.form?.duration_sec || 180,
      album_id: item.playlist_id || 'loose',
      lyricist: item.form?.lyricist || item.lyricist || '',
      composer: item.form?.composer || item.composer || '',
      arranger: item.form?.arranger || item.arranger || '',
      lyrics: item.lyrics || '',
      style_prompt: item.prompt || item.style_prompt || '',
      album: {
        id: item.playlist_id || 'loose',
        title: item.playlist_title || 'Single Track',
        cover_url: item.image_url || '/default-album.png',
        artist: {
          name: item.channel_id && channels ? (channels.find((c: any) => c.id === item.channel_id)?.name || profile?.display_name || user.email.split('@')[0]) : (profile?.display_name || user.email.split('@')[0]),
          slug: item.channel_id && channels ? (channels.find((c: any) => c.id === item.channel_id)?.slug || user.email.split('@')[0]) : (user.email.split('@')[0]),
          avatar_url: item.channel_id && channels ? (channels.find((c: any) => c.id === item.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
        }
      }
    };

    if (currentTrack?.id === item.id) {
      togglePlay();
      if (!isPlaying) {
        setNowPlayingOpen(true);
      }
    } else {
      const queueList = history.map(h => ({
        id: h.id,
        title: h.title,
        file_url: h.audio_url,
        duration_sec: h.duration_sec || h.form?.duration_sec || 180,
        album_id: h.playlist_id || 'loose',
        lyricist: h.form?.lyricist || h.lyricist || '',
        composer: h.form?.composer || h.composer || '',
        arranger: h.form?.arranger || h.arranger || '',
        lyrics: h.lyrics || '',
        style_prompt: h.prompt || h.style_prompt || '',
        album: {
          id: h.playlist_id || 'loose',
          title: h.playlist_title || 'Single Track',
          cover_url: h.image_url || '/default-album.png',
          artist: {
            name: h.channel_id && channels ? (channels.find((c: any) => c.id === h.channel_id)?.name || profile?.display_name || user.email.split('@')[0]) : (profile?.display_name || user.email.split('@')[0]),
            slug: h.channel_id && channels ? (channels.find((c: any) => c.id === h.channel_id)?.slug || user.email.split('@')[0]) : (user.email.split('@')[0]),
            avatar_url: h.channel_id && channels ? (channels.find((c: any) => c.id === h.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
          }
        }
      }));
      playTrack(trackToPlay as any, queueList as any[]);
      setNowPlayingOpen(true);
    }
  };

  const renderTrackCard = (item: any) => {
    const isPlayingThis = currentTrack?.id === item.id && isPlaying;
    
    return (
      <div key={item.id} className="bg-surface-container p-3 rounded-xl border border-outline-variant/10 shadow-sm flex flex-col gap-3 transition-all hover:bg-surface-container-high group hover:scale-[1.02]">
        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black/20">
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt="Cover" 
              className="w-full h-full object-cover" 
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-album.png";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant">No Image</div>
          )}
          {!isPublicView && item.exposure_order && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-extrabold border border-primary bg-primary text-[#0b0c0b] shadow-sm z-10">
              {item.exposure_order}순위
            </span>
          )}
          {item.is_published && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-extrabold border border-primary/30 bg-primary/10 text-primary backdrop-blur-sm shadow-sm z-20 transition-opacity group-hover:opacity-0">
              공개됨
            </span>
          )}

          {!isPublicView && (
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePublishMusic(item.id, item.is_published); }} 
                className={`w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-sm cursor-pointer ${
                  item.is_published ? 'text-primary hover:text-white' : 'text-white'
                }`}
                title={item.is_published ? '비공개 전환' : '퍼블리싱 공개'}
              >
                <Globe className="w-4 h-4" />
              </button>
              
              <div className="relative" title="플레이리스트 이동">
                <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-primary transition-colors backdrop-blur-sm pointer-events-none">
                  <Folder className="w-4 h-4" />
                </button>
                <select 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value={item.playlist_id || ''}
                  onChange={(e) => addMusicToPlaylist(item.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">단일 곡 (지정 안 함)</option>
                  {userAlbums.length > 0 && (
                    <optgroup label="내 앨범">
                      {userAlbums.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </optgroup>
                  )}
                  {userPlaylists.length > 0 && (
                    <optgroup label="나만의 플레이리스트">
                      {userPlaylists.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="relative" title={uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順位設定' : 'Exposure Order Settings'}>
                <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-primary transition-colors backdrop-blur-sm pointer-events-none">
                  <Sliders className="w-4 h-4" />
                </button>
                <select 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value={item.exposure_order || ''}
                  onChange={(e) => updateSongExposureOrder(item.id, e.target.value ? Number(e.target.value) : null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">기본</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}순위</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={(e) => { e.stopPropagation(); if(window.confirm('이 음원을 정말 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.')) handleDeleteTrack(item.id); }}
                className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500 transition-colors backdrop-blur-sm cursor-pointer"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <button 
            onClick={() => handlePlayMusic(item)}
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity z-10 cursor-pointer ${isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            {isPlayingThis ? (
              <div className="flex items-end justify-center gap-[3px] h-6 w-6">
                <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background pl-1">
                <Play className="w-5 h-5" />
              </div>
            )}
          </button>
        </div>
      
      <div className="mt-1 flex flex-col gap-1">
        <h3 className="text-sm font-bold text-on-surface truncate">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <p className="text-[10px] text-on-surface-variant shrink-0 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString()}</p>
          {item.playlist_id ? (() => {
            const folder = playlists.find(p => p.id === item.playlist_id);
            if (!folder) return <span className="text-[9px] font-bold text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded shrink-0">{uiLanguage === 'KO' ? '단일 곡' : uiLanguage === 'JA' ? 'シングル' : 'Single'}</span>;
            const { type } = parsePlaylistDescription(folder.description);
            const isAlbum = type === 'album';
            return (
              <span className={`text-[9px] font-bold truncate max-w-[120px] px-1.5 py-0.5 rounded shrink-0 ${
                isAlbum ? 'text-primary bg-primary/10 border border-primary/20' : 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30'
              }`}>
                {isAlbum ? `앨범: ${folder.title}` : `플레이리스트: ${folder.title}`}
              </span>
            );
          })() : (
            <span className="text-[9px] font-bold text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded shrink-0">{uiLanguage === 'KO' ? '단일 곡' : uiLanguage === 'JA' ? 'シングル' : 'Single'}</span>
          )}
        </div>
      </div>
    </div>
  );
}

  const renderPlaylistCard = (playlist: any) => {
    const tracksCount = playlist.is_mock 
      ? playlist.tracks?.length || 0 
      : history.filter(h => h.playlist_id === playlist.id).length;
    const isLiked = likedAlbums.includes(playlist.id);

    return (
      <div key={playlist.id} className="bg-surface-container p-3 rounded-xl border border-outline-variant/10 shadow-sm flex flex-col gap-3 transition-all hover:bg-surface-container-high group hover:scale-[1.02] cursor-pointer relative" onClick={() => handleSelectPlaylist(playlist)}>
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
          {!isPublicView && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-extrabold border backdrop-blur-md shadow-sm ${
              playlist.is_published 
                ? 'bg-primary/20 text-primary border-primary/30' 
                : 'bg-black/60 text-zinc-400 border-white/10'
            }`}>
              {playlist.is_published ? '공개됨' : '비공개'}
            </span>
          )}
          {!isPublicView && playlist.exposure_order && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-extrabold border border-primary bg-primary text-[#0b0c0b] shadow-sm">
              {playlist.exposure_order}순위
            </span>
          )}

          {/* Floating Heart Button */}
          <div className={`absolute bottom-2 right-2 z-20 transition-all duration-300 ${isLiked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAlbumLikeToggle(playlist.id)
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                isLiked
                  ? 'bg-[#e3fe06] text-black font-extrabold'
                  : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
              }`}
              title="좋아요"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Edit, Publish and Delete buttons on Hover */}
        {!isPublicView && (
          <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div 
              className="relative w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-primary hover:text-black transition-colors backdrop-blur-sm cursor-pointer group/btn"
              title="공개 범위 설정"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const parsedDesc = parsePlaylistDescription(playlist.description);
                const plChannelId = parsedDesc.channelId;
                return (
                  <>
                    {playlist.is_published ? (plChannelId ? <Users className="w-4 h-4 text-primary group-hover/btn:text-black" /> : <Globe className="w-4 h-4 text-primary group-hover/btn:text-black" />) : <Lock className="w-4 h-4 text-white group-hover/btn:text-black" />}
                    <select 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      value={playlist.is_published ? (plChannelId || 'public') : 'private'}
                      onChange={(e) => {
                        e.stopPropagation();
                        const val = e.target.value;
                        if (val === 'private') {
                          if (playlist.is_published) togglePublishPlaylist(playlist.id, true);
                        } else if (val === 'public') {
                          if (!playlist.is_published) togglePublishPlaylist(playlist.id, false);
                          if (plChannelId) assignPlaylistToChannel(playlist.id, null);
                        } else {
                          if (!playlist.is_published) togglePublishPlaylist(playlist.id, false);
                          if (plChannelId !== val) assignPlaylistToChannel(playlist.id, val);
                        }
                      }}
                    >
                      <option value="private">나만 보기 (비공개)</option>
                      <option value="public">전체 공개 (기본 채널)</option>
                      {channels && channels.map((ch: any) => (
                        <option key={ch.id} value={ch.id}>채널 공개 ({ch.name})</option>
                      ))}
                    </select>
                  </>
                );
              })()}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); openEditModal(playlist); }} 
              className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-primary transition-colors backdrop-blur-sm"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }} 
              className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500 transition-colors backdrop-blur-sm"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-on-surface truncate pr-2">{playlist.title}</h3>
          <p className="text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-1.5">
            <span>{tracksCount} {uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : 'songs'}</span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center gap-1">
              <Heart className={`w-2.5 h-2.5 ${isLiked ? 'fill-current text-[#e3fe06]' : 'text-zinc-500'}`} />
              <span>{isLiked ? 1 : 0}</span>
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-[32px] pt-0 md:pt-0">
        {/* --- Conditionally Render Headers --- */}
        {selectedPlaylist || activeTab === 'private' || activeTab === 'channels' || activeTab === 'albums' ? (
          /* Standard Header for Private view / Playlist Detail */
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center border-2 border-primary overflow-hidden shrink-0">
                {(profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture) ? (
                  <img src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-on-background">{profile?.display_name || '내 채널'}</h1>
                <p className="text-sm text-on-surface-variant">{user?.email}</p>
              </div>
            </div>
            <div>
              <button onClick={startEditingProfile} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-surface-container-high text-on-surface rounded-lg transition-colors border border-outline-variant/10 hover:bg-surface-container-highest">
                <Edit2 className="w-3.5 h-3.5" /> 프로필 수정
              </button>
            </div>
          </div>
        ) : (
          /* Premium Cover Banner Header for Public Channel View */
          <div className="relative w-full h-[260px] md:h-[350px] rounded-3xl overflow-hidden mb-6 border border-outline-variant/10 shadow-2xl">
            {/* Banner Image Background */}
            {!profile ? (
              <div className="w-full h-full bg-[#18181b] animate-pulse" />
            ) : (
              <img 
                src={profileBanner || "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1200&auto=format&fit=crop&q=80"} 
                alt="Banner" 
                className="w-full h-full object-cover animate-fade-in" 
              />
            )}
            {/* Glassmorphic dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0b] via-[#0b0c0b]/40 to-transparent flex flex-col justify-end p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-primary/50 overflow-hidden shrink-0">
                    {(profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture) ? (
                      <img src={profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#18181b] flex items-center justify-center">
                        <User className="w-10 h-10 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 md:space-y-2">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{profile?.display_name || 'The Lost Dreamer'}</h1>
                    </div>
                    <p className="text-xs text-zinc-400 font-mono">@{profileHandle || (profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer')}</p>
                    <div className="flex gap-4 text-xs font-bold text-zinc-300 pt-1">
                      <span className="flex items-center gap-1"><Play className="w-3.5 h-3.5 fill-current text-primary" /> {totalProfilePlays.toLocaleString()} Plays</span>
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 fill-current text-primary" /> {totalProfileLikes.toLocaleString()} Likes</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 fill-current text-primary" /> {profileFollowers.toLocaleString()} Followers</span>
                    </div>
                    {/* Bio and Hashtags moved to banner */}
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
                            onClick={() => showToast(`장르 검색: ${tag}`, 'info')}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        )}

        {/* --- Main View --- */}
        {selectedPlaylist ? (
          <div className="flex flex-col gap-6">
            {/* Back Button */}
            <button 
              onClick={handleBackFromDetail} 
              className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start"
            >
              <ArrowLeft className="w-4 h-4" /> {uiLanguage === 'KO' ? '목록으로' : uiLanguage === 'JA' ? 'リストへ戻る' : 'Back to list'}
            </button>

            {/* Hero Header Banner */}
            <div className="relative w-full bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950/40 rounded-3xl p-6 md:p-8 border border-zinc-800/60 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none"></div>
              
              {/* Cover Art */}
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/5 bg-zinc-900">
                <img 
                  src={selectedPlaylist.cover_url || '/default-album.png'} 
                  alt="Album Cover" 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/default-album.png";
                  }}
                />
              </div>

              {/* Album Details Info */}
              <div className="flex-1 flex flex-col gap-2 w-full md:w-auto">
                <span className="text-[10px] font-extrabold text-primary border border-primary/30 bg-primary/5 px-2.5 py-0.5 rounded-full tracking-wider uppercase inline-block self-start">
                  {selectedPlaylist.is_mock || (selectedPlaylist.description && selectedPlaylist.description.includes('"type":"album"')) || (!selectedPlaylist.description?.includes('{"') && selectedPlaylist.description?.includes('album')) || parsePlaylistDescription(selectedPlaylist.description).type === 'album' ? 'ALBUM' : 'PLAYLIST'}
                </span>
                <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mt-1">{selectedPlaylist.title}</h1>
                <p className="text-xs text-zinc-400 font-semibold tracking-wide mt-1">
                  {selectedPlaylist.is_mock ? 'AI Artist' : (uiLanguage === 'KO' ? '보관함 폴더' : uiLanguage === 'JA' ? 'ライブラリフォルダ' : 'Library Folder')} • {selectedPlaylistTracks.length}{uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : ' songs'}
                </p>

                {/* Actions Button Row */}
                <div className="flex items-center flex-wrap gap-3 mt-4">
                  <button 
                    onClick={() => {
                      if (selectedPlaylistTracks.length > 0) {
                        const tracksToQueue = selectedPlaylistTracks.map((t: any) => ({
                          id: t.id,
                          title: t.title,
                          file_url: t.audio_url || t.file_url,
                          duration_sec: t.duration_sec || 30,
                          album_id: selectedPlaylist.id,
                          lyricist: t.form?.lyricist || t.lyricist || '',
                          composer: t.form?.composer || t.composer || '',
                          arranger: t.form?.arranger || t.arranger || '',
                          lyrics: t.lyrics || '',
                          style_prompt: t.prompt || t.style_prompt || '',
                          album: {
                            id: selectedPlaylist.id,
                            title: selectedPlaylist.title,
                            cover_url: selectedPlaylist.cover_url || '/default-album.png',
                            artist: {
                              name: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.name || profile?.display_name || 'AI Artist') : (profile?.display_name || 'AI Artist'),
                              slug: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.slug || user?.email?.split('@')[0] || 'user') : (user?.email?.split('@')[0] || 'user'),
                              avatar_url: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
                            }
                          }
                        }));
                        playTrack(tracksToQueue[0] as any, tracksToQueue as any[]);
                        setNowPlayingOpen(true);
                      }
                    }}
                    disabled={selectedPlaylistTracks.length === 0}
                    className="px-6 py-2.5 rounded-full bg-primary hover:bg-[#e3fe06] text-[#0b0c0b] text-xs font-extrabold flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-primary shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> PLAY ALL
                  </button>

                  <button 
                    onClick={() => handleAlbumLikeToggle(selectedPlaylist.id)}
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                      likedAlbums.includes(selectedPlaylist.id)
                        ? 'border-[#e3fe06] bg-[#e3fe06]/10 text-[#e3fe06] hover:bg-[#e3fe06]/25'
                        : 'border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                    title="좋아요"
                  >
                    <Heart className={`w-4 h-4 ${likedAlbums.includes(selectedPlaylist.id) ? 'fill-current' : ''}`} />
                  </button>

                  <button className="w-9 h-9 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {!isPublicView && !selectedPlaylist.is_mock && (
                    <div className="flex gap-2 ml-auto">
                      <div className="relative">
                        {(() => {
                          const parsedDesc = parsePlaylistDescription(selectedPlaylist.description);
                          const plChannelId = parsedDesc.channelId;
                          return (
                            <>
                              <div className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                                selectedPlaylist.is_published 
                                  ? plChannelId ? 'border-primary bg-primary text-black' : 'border-primary/30 bg-primary/10 text-primary' 
                                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                              }`}>
                                {selectedPlaylist.is_published ? (plChannelId ? <Users className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />) : <Lock className="w-3.5 h-3.5" />}
                                {selectedPlaylist.is_published ? (plChannelId ? '채널 공개' : '전체 공개') : '비공개'}
                              </div>
                              <select 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                value={selectedPlaylist.is_published ? (plChannelId || 'public') : 'private'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'private') {
                                    if (selectedPlaylist.is_published) togglePublishPlaylist(selectedPlaylist.id, true);
                                  } else if (val === 'public') {
                                    if (!selectedPlaylist.is_published) togglePublishPlaylist(selectedPlaylist.id, false);
                                    if (plChannelId) assignPlaylistToChannel(selectedPlaylist.id, null);
                                  } else {
                                    if (!selectedPlaylist.is_published) togglePublishPlaylist(selectedPlaylist.id, false);
                                    if (plChannelId !== val) assignPlaylistToChannel(selectedPlaylist.id, val);
                                  }
                                }}
                              >
                                <option value="private">나만 보기 (비공개)</option>
                                <option value="public">전체 공개 (기본 채널)</option>
                                {channels && channels.map((ch: any) => (
                                  <option key={ch.id} value={ch.id}>채널 공개 ({ch.name})</option>
                                ))}
                              </select>
                            </>
                          );
                        })()}
                      </div>
                      <button 
                        onClick={() => openEditModal(selectedPlaylist)} 
                        className="px-4 py-1.5 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-colors"
                      >
                        편집
                      </button>
                      <button 
                        onClick={() => deletePlaylist(selectedPlaylist.id)} 
                        className="px-4 py-1.5 rounded-full border border-red-950/40 hover:border-red-900/60 text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tracks Table */}
            <div className="w-full mt-4 flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[50px_2fr_1.5fr_1.5fr_100px] gap-4 px-4 py-2 border-b border-zinc-800/40 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <div>#</div>
                <div>제목</div>
                <div>{uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'}</div>
                <div>추가된 날짜</div>
                <div className="text-right flex justify-end items-center"><Clock className="w-4 h-4 text-zinc-500" /></div>
              </div>

              {/* Table Rows */}
              <div className="flex flex-col gap-1 mt-3">
                {selectedPlaylistTracks.map((track: any, idx: number) => {
                  const isPlayingThis = currentTrack?.id === track.id && isPlaying;
                  const displayPlays = track.form?.play_count || (track.title?.length * 450 + 1000) || 0;
                  const displayLikes = track.form?.like_count || (track.title?.length * 25 + 15) || 0;
                  const displayGenre = track.genre || selectedPlaylist.title || 'Pop';
                  const displayDuration = track.duration_sec 
                    ? `${Math.floor(track.duration_sec / 60)}:${String(track.duration_sec % 60).padStart(2, '0')}` 
                    : '0:30';

                  const trackToPlay = {
                    id: track.id,
                    title: track.title,
                    file_url: track.audio_url || track.file_url,
                    duration_sec: track.duration_sec || 30,
                    album_id: selectedPlaylist.id,
                    lyricist: track.form?.lyricist || track.lyricist || '',
                    composer: track.form?.composer || track.composer || '',
                    arranger: track.form?.arranger || track.arranger || '',
                    lyrics: track.lyrics || '',
                    style_prompt: track.prompt || track.style_prompt || '',
                    image_url: track.image_url || selectedPlaylist.cover_url || '/default-album.png',
                    album: {
                      id: selectedPlaylist.id,
                      title: selectedPlaylist.title,
                      cover_url: selectedPlaylist.cover_url || '/default-album.png',
                      artist: {
                        name: track.channel_id && channels ? (channels.find((c: any) => c.id === track.channel_id)?.name || profile?.display_name || 'AI Artist') : (profile?.display_name || 'AI Artist'),
                        slug: track.channel_id && channels ? (channels.find((c: any) => c.id === track.channel_id)?.slug || user?.email?.split('@')[0] || 'user') : (user?.email?.split('@')[0] || 'user'),
                        avatar_url: track.channel_id && channels ? (channels.find((c: any) => c.id === track.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
                      }
                    }
                  };

                  return (
                    <div 
                      key={track.id} 
                      className="grid grid-cols-[50px_2fr_1.5fr_1.5fr_100px] gap-4 px-4 py-3 items-center rounded-xl hover:bg-white/5 transition-all group"
                    >
                      {/* Index */}
                      <div className="text-sm font-semibold font-mono text-zinc-500">
                        <span className={isPlayingThis ? 'text-primary font-bold' : ''}>{idx + 1}</span>
                      </div>

                      {/* Title & Cover info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5 bg-zinc-900 cursor-pointer"
                          onClick={() => {
                            if (isPlayingThis) {
                              togglePlay();
                              if (!isPlaying) {
                                setNowPlayingOpen(true);
                              }
                            } else {
                              playTrack(trackToPlay as any, selectedPlaylistTracks.map((t: any) => ({
                                id: t.id,
                                title: t.title,
                                file_url: t.audio_url || t.file_url,
                                duration_sec: t.duration_sec || 30,
                                album_id: selectedPlaylist.id,
                                lyrics: t.lyrics || '',
                                style_prompt: t.prompt || t.style_prompt || '',
                                image_url: t.image_url || selectedPlaylist.cover_url || '/default-album.png',
                                album: {
                                  id: selectedPlaylist.id,
                                  title: selectedPlaylist.title,
                                  cover_url: selectedPlaylist.cover_url || '/default-album.png',
                                  artist: {
                                    name: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.name || profile?.display_name || 'AI Artist') : (profile?.display_name || 'AI Artist'),
                                    slug: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.slug || user?.email?.split('@')[0] || 'user') : (user?.email?.split('@')[0] || 'user'),
                                    avatar_url: t.channel_id && channels ? (channels.find((c: any) => c.id === t.channel_id)?.avatar_url || profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png') : (profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-album.png')
                                  }
                                }
                              })));
                              setNowPlayingOpen(true);
                            }
                          }}
                        >
                          <img 
                            src={track.image_url || selectedPlaylist.cover_url || '/default-album.png'} 
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
                          <span className={`text-sm font-bold truncate ${isPlayingThis ? 'text-primary' : 'text-white'}`}>{track.title}</span>
                          <span className="text-xs text-zinc-400 font-semibold truncate">{profile?.display_name || 'AI Artist'}</span>
                        </div>
                      </div>

                      {/* Album Title */}
                      <div className="text-sm text-zinc-400 font-medium truncate">
                        {selectedPlaylist.title}
                      </div>

                      {/* Date Added */}
                      <div className="text-sm text-zinc-400 font-medium truncate">
                        최근 추가됨
                      </div>

                      {/* Duration & Heart & More */}
                      <div className="text-right flex items-center justify-end gap-3 text-sm text-zinc-500 font-mono relative">
                        <span>{displayDuration}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleLikeSong(track); }}
                          className={`hover:scale-105 transition-all cursor-pointer ${
                            isSongLiked(track.id) ? 'text-primary opacity-100' : 'text-zinc-500 hover:text-primary opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isSongLiked(track.id) ? 'fill-current' : ''}`} />
                        </button>

                        {!isPublicView && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadTrack(track.audio_url || track.file_url, track.title, track.image_url || track.album?.cover_url); }}
                            className="hover:scale-105 transition-all cursor-pointer text-zinc-500 hover:text-primary opacity-0 group-hover:opacity-100 p-1"
                            title="다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}

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
                            className="absolute right-0 top-8 w-48 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-xl py-1 z-50 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleMoveTrack(track.id, null)}
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-red-400 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
                            >
                              <X className="w-3.5 h-3.5" /> 이 앨범에서 빼기
                            </button>
                            <div className="h-px bg-outline-variant/10 my-1 mx-2"></div>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase">다른 플레이리스트로 이동</div>
                            <div className="max-h-40 overflow-y-auto scrollbar-none">
                              {playlists.filter(p => p.id !== selectedPlaylist.id).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => handleMoveTrack(track.id, p.id)}
                                  className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-white/5 transition-colors cursor-pointer truncate"
                                >
                                  {p.title}
                                </button>
                              ))}
                              {playlists.filter(p => p.id !== selectedPlaylist.id).length === 0 && (
                                <div className="px-4 py-2 text-xs text-zinc-500">다른 플레이리스트가 없습니다</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPlaylistTracks.length === 0 && (
                <div className="py-16 text-center text-sm text-zinc-400 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800 mt-3">
                  앨범에 들어있는 곡이 없습니다.
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'albums' ? (
          <div className="flex flex-col w-full">
            <div className="flex gap-4 mb-6 border-b border-outline-variant/20 pb-4">
              <button 
                onClick={() => {
                  setActiveTab('private');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'private');
                  window.history.pushState({ tab: 'private' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Lock className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 음원 관리' : uiLanguage === 'JA' ? 'ライブラリ (非公開)' : 'Private Library'}
              </button>
              <button 
                onClick={() => {
                  setActiveTab('albums');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'albums');
                  window.history.pushState({ tab: 'albums' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer bg-surface-container-high text-on-surface`}
              >
                <Folder className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 앨범 관리' : uiLanguage === 'JA' ? 'アルバム管理' : 'My Albums'}
              </button>
              <button 
                onClick={() => {
                  if (isAdmin) {
                    setActiveTab('channels');
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', 'channels');
                    window.history.pushState({ tab: 'channels' }, '', url.toString());
                  } else {
                    setShowComingSoon(true);
                  }
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Users className="w-4 h-4" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Channel Mgt'}
              </button>
              <button 
                onClick={() => { 
                  setActiveTab('public'); 
                  handleSetPublicSubView('main'); 
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'public');
                  window.history.pushState({ tab: 'public' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Globe className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 채널 (퍼블리싱됨)' : uiLanguage === 'JA' ? 'マイチャンネル (公開済み)' : 'My Channel (Published)'}
              </button>
            </div>
            
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2"><Folder className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '내 앨범' : uiLanguage === 'JA' ? 'マイアルバム' : 'My Albums'}</h2>
              </div>
              
              {(() => {
                const albumItems = [
                  ...(!isPublicView ? [{ isCreateButton: true }] : []),
                  ...visibleAlbums
                ]
                const totalAlbumPages = Math.ceil(albumItems.length / albumsPerPage)
                const paginatedAlbumItems = albumItems.slice(
                  (currentAlbumPage - 1) * albumsPerPage,
                  currentAlbumPage * albumsPerPage
                )

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {paginatedAlbumItems.map((item: any, idx: number) => {
                        if (item.isCreateButton) {
                          return (
                            <button 
                              key="create-album-btn"
                              onClick={() => openCreateModal('album')} 
                              className="bg-surface-container-low hover:bg-surface-container border border-dashed border-outline-variant/30 p-3 rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] transition-colors group cursor-pointer"
                            >
                              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <Plus className="w-6 h-6" />
                              </div>
                              <span className="text-sm font-bold text-on-surface-variant group-hover:text-primary">{uiLanguage === 'KO' ? '새 앨범 만들기' : uiLanguage === 'JA' ? '新しいアルバムを作成' : 'Create New Album'}</span>
                            </button>
                          )
                        }
                        return renderPlaylistCard(item)
                      })}
                    </div>

                    {totalAlbumPages > 1 && (
                      <div className="flex items-center justify-end gap-1 mt-4">
                        <button 
                          onClick={() => setCurrentAlbumPage(prev => Math.max(1, prev - 1))}
                          disabled={currentAlbumPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-outline-variant/15 text-[11px] font-bold text-on-surface-variant hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          이전
                        </button>
                        {Array.from({ length: totalAlbumPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentAlbumPage(page)}
                            className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              currentAlbumPage === page 
                                ? 'bg-primary text-black font-black' 
                                : 'border border-outline-variant/15 text-on-surface-variant hover:text-white'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button 
                          onClick={() => setCurrentAlbumPage(prev => Math.min(totalAlbumPages, prev + 1))}
                          disabled={currentAlbumPage === totalAlbumPages}
                          className="px-3 py-1.5 rounded-lg border border-outline-variant/15 text-[11px] font-bold text-on-surface-variant hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          다음
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
              {visibleAlbums.length === 0 && <p className="text-sm text-on-surface-variant mt-4">앨범을 만들어 음악을 폴더처럼 관리해보세요.</p>}
            </div>
          </div>
        ) : activeTab === 'private' ? (
          /* Private Tab View (Management Dashboard) */
          <div className="flex flex-col w-full">
            <div className="flex gap-4 mb-6 border-b border-outline-variant/20 pb-4">
              <button 
                onClick={() => {
                  setActiveTab('private');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'private');
                  window.history.pushState({ tab: 'private' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${isPrivateView ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Lock className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 음원 관리' : uiLanguage === 'JA' ? 'ライブラリ (非公開)' : 'Private Library'}
              </button>
              <button 
                onClick={() => {
                  setActiveTab('albums');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'albums');
                  window.history.pushState({ tab: 'albums' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${isAlbumsView ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Folder className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 앨범 관리' : uiLanguage === 'JA' ? 'アルバム管理' : 'My Albums'}
              </button>
              <button 
                onClick={() => {
                  if (isAdmin) {
                    setActiveTab('channels');
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', 'channels');
                    window.history.pushState({ tab: 'channels' }, '', url.toString());
                  } else {
                    setShowComingSoon(true);
                  }
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Users className="w-4 h-4" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Channel Mgt'}
              </button>
              <button 
                onClick={() => { 
                  setActiveTab('public'); 
                  handleSetPublicSubView('main'); 
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'public');
                  window.history.pushState({ tab: 'public' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${isPublicView ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Globe className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 채널 (퍼블리싱됨)' : uiLanguage === 'JA' ? 'マイチャンネル (公開済み)' : 'My Channel (Published)'}
              </button>
            </div>
            


            <div className="flex gap-6 min-h-[80vh]">
              {/* --- SIDEBAR --- */}
              <div className="w-64 shrink-0 flex flex-col border-r border-outline-variant/10 pr-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => setSelectedPlaylistFilter('all')}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedPlaylistFilter === 'all' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                        <span>모든 폴더</span>
                      </div>
                      <span className="text-xs opacity-50 font-mono">
                        {history.filter(h => {
                          if (!h.playlist_id) return true;
                          const parentPlaylist = playlists.find(p => p.id === h.playlist_id);
                          if (!parentPlaylist) return true;
                          return parsePlaylistDescription(parentPlaylist.description).type === 'album';
                        }).length || 0}
                      </span>
                    </button>

                    <button 
                      onClick={() => setSelectedPlaylistFilter('uploaded')}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedPlaylistFilter === 'uploaded' ? 'bg-primary text-black' : 'text-zinc-300 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                        <span>업로드</span>
                      </div>
                      <span className="text-xs opacity-50 font-mono">
                        {history.filter(h => h.source === 'upload' || h.type === 'upload').length || 0}
                      </span>
                    </button>
                  </div>

                  <div className="h-px bg-white/10 mx-2"></div>

                  {/* Custom Folder Tree */}
                  <div className="flex flex-col gap-1 overflow-y-auto pb-2 scrollbar-thin">
                    {folderTree.map(node => (
                      <FolderTreeNode 
                        key={node.id} 
                        node={node} 
                        selectedPlaylist={selectedPlaylistFilter}
                        setSelectedPlaylist={setSelectedPlaylistFilter}
                        expandedFolders={expandedFolders}
                        handleToggleFolder={handleToggleFolder}
                        handleCreateSubfolder={handleCreateSubfolder}
                        handleRenameFolder={handleRenameFolder}
                        deletePlaylist={deletePlaylist}
                        handleMoveTrack={handleMoveTrack}
                        showToast={showToast}
                        folderTrackCounts={folderTrackCounts}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* --- MAIN CONTENT --- */}
              <div className="flex-1 min-w-0">



            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  {(() => {
                    if (selectedPlaylistFilter === 'all') return <><Music className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '모든 폴더 (전체 음원)' : 'All Songs'}</>
                    if (selectedPlaylistFilter === 'liked') return <><Heart className="w-5 h-5 text-primary fill-current" /> {uiLanguage === 'KO' ? '좋아요 표시한 음악' : 'Liked Songs'}</>
                    if (selectedPlaylistFilter === 'uploaded') return <><Upload className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '업로드' : 'Uploads'}</>
                    const folder = playlists.find(p => p.id === selectedPlaylistFilter)
                    if (folder) return <><Folder className="w-5 h-5 text-primary fill-current" /> {folder.title}</>
                    return <><Music className="w-5 h-5 text-primary" /> {uiLanguage === 'KO' ? '음원 목록' : 'Songs'}</>
                  })()}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
                    <input
                      type="text"
                      placeholder={uiLanguage === 'KO' ? '음원 검색...' : uiLanguage === 'JA' ? '曲を検索...' : 'Search tracks...'}
                      value={trackSearchQuery}
                      onChange={(e) => {
                        setTrackSearchQuery(e.target.value)
                        setCurrentPage(1) // Reset pagination on search
                      }}
                      className="w-48 pl-8 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/20 rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <select
                    value={trackSortOrder}
                    onChange={(e) => {
                      setTrackSortOrder(e.target.value as 'newest' | 'oldest')
                      setCurrentPage(1)
                    }}
                    className="pl-3 pr-8 py-1.5 bg-surface-container-low border border-outline-variant/20 hover:bg-white/5 rounded-lg text-xs font-bold text-zinc-300 focus:outline-none focus:border-primary/50 transition-colors shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.65em_auto] bg-no-repeat bg-[position:right_0.5rem_center]"
                  >
                    <option value="newest">{uiLanguage === 'KO' ? '최신순' : 'Newest'}</option>
                    <option value="oldest">{uiLanguage === 'KO' ? '오래된순' : 'Oldest'}</option>
                  </select>
                  <button 
                    onClick={() => setIsFolderManageModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border border-outline-variant/20 hover:bg-white/5 rounded-lg text-xs font-bold text-zinc-300 transition-colors shadow-sm cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '폴더 관리' : 'Manage Folders'}
                  </button>
                  {selectedPlaylistFilter === 'uploaded' && isAdmin && (
                    <button 
                      onClick={openUploadModal}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uiLanguage === 'KO' ? '음원 파일 업로드' : uiLanguage === 'JA' ? '音声ファイルをアップロード' : 'Upload Audio File'}
                    </button>
                  )}
                </div>
              </div>
              {visibleLooseTracks.length === 0 ? (
                <p className="text-sm text-on-surface-variant">표시할 단일 곡이 없습니다.</p>
              ) : (() => {
                const totalPages = Math.ceil(visibleLooseTracks.length / itemsPerPage)
                const paginatedTracks = visibleLooseTracks.slice(
                  (currentPage - 1) * itemsPerPage,
                  currentPage * itemsPerPage
                )

                return (
                  <div className="space-y-4">
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden shadow-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-outline-variant/10 bg-surface-container-lowest/80 text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                            <th className="py-3 px-4 w-14 text-center">{uiLanguage === 'KO' ? '번호' : uiLanguage === 'JA' ? '番号' : 'No.'}</th>
                            <th className="py-3 px-4">{uiLanguage === 'KO' ? '곡 정보' : uiLanguage === 'JA' ? 'トラック情報' : 'Track Info'}</th>
                            <th className="py-3 px-4 w-40">{uiLanguage === 'KO' ? '채널 / 소속 폴더' : uiLanguage === 'JA' ? 'チャンネル / フォルダ' : 'Channel / Folder'}</th>
                            <th className="py-3 px-4 w-28 text-center whitespace-nowrap">{uiLanguage === 'KO' ? '등록일' : uiLanguage === 'JA' ? '追加日' : 'Date Added'}</th>
                            {!isPublicView && <th className="py-3 px-4 w-44 text-right">관리</th>}
                            {isPublicView && <th className="py-3 px-4 w-16 text-center">좋아요</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03] text-xs">
                          {paginatedTracks.map((song: any, index: number) => {
                            const globalIdx = (currentPage - 1) * itemsPerPage + index + 1
                            const isPlayingThis = currentTrack?.id === song.id && isPlaying

                            // Fetch parent folder info
                            const folder = song.playlist_id ? playlists.find(p => p.id === song.playlist_id) : null
                            const songChannel = song.channel_id ? channels.find(c => c.id === song.channel_id) : null
                            const channelLabel = songChannel ? songChannel.name : '메인 채널'
                            let folderTypeLabel = '단일 곡'
                            let folderBgClass = 'text-zinc-500 bg-zinc-800/40 border border-zinc-700/30'
                            if (folder) {
                              const { type } = parsePlaylistDescription(folder.description)
                              const isAlbum = type === 'album'
                              folderTypeLabel = isAlbum ? `앨범: ${folder.title}` : `폴더: ${folder.title}`
                              folderBgClass = isAlbum 
                                ? 'text-primary bg-primary/10 border border-primary/20' 
                                : 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30'
                            }

                            return (
                              <tr 
                                key={song.id} 
                                className={`hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 transition-all duration-200 group ${isPlayingThis ? 'bg-primary/5' : ''}`}>
                                {/* Number */}
                                <td className="py-4 px-4 font-mono text-on-surface-variant/60 text-center w-14">
                                  <span>{globalIdx}</span>
                                </td>
                                {/* Song Info */}
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      draggable={true}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData('track-id', song.id)
                                        e.dataTransfer.effectAllowed = 'move'
                                      }}
                                      className="w-10 h-10 rounded-lg overflow-hidden bg-black/20 border border-outline-variant/10 shrink-0 shadow-sm relative cursor-pointer group/thumb cursor-grab active:cursor-grabbing select-none"
                                      onClick={() => handlePlayMusic(song)}
                                    >
                                      <img 
                                        draggable={false}
                                        src={song.image_url || "/default-album.png"} 
                                        alt="Cover" 
                                        className={`w-full h-full object-cover transition-opacity ${isPlayingThis ? 'opacity-40' : 'group-hover/thumb:opacity-50'}`}
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.src = "/default-album.png";
                                        }}
                                      />
                                      {!isPlayingThis && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                          <Play className="w-4 h-4 fill-white ml-0.5" />
                                        </div>
                                      )}
                                      {isPlayingThis && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                          <div className="flex items-end justify-center gap-[2px] h-3.5 w-3.5">
                                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(227,254,6,0.5)]"></div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`font-bold block truncate max-w-[200px] ${isPlayingThis ? 'text-primary' : 'text-on-surface'}`}>
                                          {song.title}
                                        </span>
                                        {!isPublicView && song.exposure_order && (
                                          <span className="text-[8px] font-black px-1 py-0.5 rounded bg-primary text-black shrink-0">
                                            {song.exposure_order}순위
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-on-surface-variant/60 mt-0.5 block font-medium">
                                        {song.genre || 'K-Pop'} • ▶ {song.form?.play_count || (song.title?.length * 450 + 1000) || 0} plays
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Folder Association */}
                                <td className="py-4 px-4 align-middle">
                                  <div className="flex flex-col items-start gap-1.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface bg-surface-container/50 px-2 py-1 rounded-md border border-white/5 w-fit">
                                      <Users className="w-3.5 h-3.5 text-primary opacity-90" />
                                      <span className="truncate max-w-[120px]" title={channelLabel}>{channelLabel}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block truncate max-w-[150px] ${folderBgClass}`}>
                                      {folderTypeLabel}
                                    </span>
                                  </div>
                                </td>

                                {/* Registration Date */}
                                <td className="py-4 px-4 text-center text-on-surface-variant/60 font-mono whitespace-nowrap">
                                  {new Date(song.created_at).toLocaleDateString()}
                                </td>

                                {/* Administration Actions (Private View only) */}
                                {!isPublicView && (
                                  <td className="py-4 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="relative p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer group/btn" title="공개 범위 설정">
                                        {song.is_published ? (song.channel_id ? <Users className="w-3.5 h-3.5 text-primary" /> : <Globe className="w-3.5 h-3.5 text-primary" />) : <Lock className="w-3.5 h-3.5 text-zinc-500" />}
                                        <select 
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          value={song.is_published ? (song.channel_id || 'public') : 'private'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'private') {
                                              if (song.is_published) togglePublishMusic(song.id, true);
                                            } else if (val === 'public') {
                                              if (!song.is_published) togglePublishMusic(song.id, false);
                                              if (song.channel_id) assignSongToChannel(song.id, null);
                                            } else {
                                              if (!song.is_published) togglePublishMusic(song.id, false);
                                              if (song.channel_id !== val) assignSongToChannel(song.id, val);
                                            }
                                          }}
                                        >
                                          <option value="private">나만 보기 (비공개)</option>
                                          <option value="public">전체 공개 (기본 채널)</option>
                                          {channels.map(ch => (
                                            <option key={ch.id} value={ch.id}>채널 공개 ({ch.name})</option>
                                          ))}
                                        </select>
                                      </div>

                                      <button 
                                        onClick={() => setMoveTrackModalData(song)}
                                        className="p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer text-zinc-500" 
                                        title="폴더 이동"
                                      >
                                        <Folder className="w-3.5 h-3.5" />
                                      </button>

                                      <div className="relative p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer text-zinc-500 hover:text-black" title="앨범/플레이리스트에 등록">
                                        <ListMusic className="w-3.5 h-3.5" />
                                        <select 
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          value={(userAlbums.some(a => a.id === song.playlist_id) || userPlaylists.some(p => p.id === song.playlist_id)) ? song.playlist_id : 'default'}
                                          onChange={(e) => {
                                            if (e.target.value !== 'default') {
                                              handleMoveTrack(song.id, e.target.value === 'none' ? null : e.target.value);
                                            }
                                          }}
                                        >
                                          <option value="default" disabled>등록...</option>
                                          {userAlbums.length > 0 && (
                                            <optgroup label={uiLanguage === 'KO' ? '앨범' : 'Albums'}>
                                              {userAlbums.map(album => (
                                                <option key={album.id} value={album.id}>{album.title}</option>
                                              ))}
                                            </optgroup>
                                          )}
                                          {userPlaylists.length > 0 && (
                                            <optgroup label={uiLanguage === 'KO' ? '플레이리스트' : 'Playlists'}>
                                              {userPlaylists.map(pl => (
                                                <option key={pl.id} value={pl.id}>{pl.title}</option>
                                              ))}
                                            </optgroup>
                                          )}
                                          {(userAlbums.some(a => a.id === song.playlist_id) || userPlaylists.some(p => p.id === song.playlist_id)) && (
                                            <option value="none">{uiLanguage === 'KO' ? '제외 (기본 폴더로)' : 'Remove (to Default)'}</option>
                                          )}
                                        </select>
                                      </div>

                                      <div className="relative p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors cursor-pointer text-zinc-500 hover:text-black" title="노출 순위">
                                        <Sliders className="w-3.5 h-3.5" />
                                        <select 
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          value={song.exposure_order || ''}
                                          onChange={(e) => updateSongExposureOrder(song.id, e.target.value ? Number(e.target.value) : null)}
                                        >
                                          <option value="">기본 순서</option>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                            <option key={num} value={num}>{num}순위</option>
                                          ))}
                                        </select>
                                      </div>

                                      <button
                                        onClick={() => setSelectedSong(song)}
                                        className="p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors text-zinc-500 cursor-pointer"
                                        title={uiLanguage === 'KO' ? '썸네일 및 동영상 편집' : 'Edit Media'}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => handleDownloadTrack(song.audio_url || song.file_url, song.title, song.image_url || song.album?.cover_url)}
                                        className="p-1.5 rounded-full bg-surface-container hover:bg-primary hover:text-black transition-colors text-zinc-500 cursor-pointer"
                                        title="다운로드"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>

                                      <button 
                                        onClick={() => { if(window.confirm('이 음원을 정말 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.')) handleDeleteTrack(song.id); }}
                                        className="p-1.5 rounded-full bg-surface-container hover:bg-red-500 hover:text-white transition-colors text-zinc-500 cursor-pointer"
                                        title="삭제"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}

                                {/* Likes (Public View only) */}
                                {isPublicView && (
                                  <td className="py-4 px-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => toggleLikeSong(song)}
                                        className={`p-1.5 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                                          isSongLiked(song.id) ? 'text-primary' : 'text-zinc-500 hover:text-primary'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isSongLiked(song.id) ? 'fill-current' : ''}`} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/10">
                        <div className="text-[11px] text-on-surface-variant font-medium">
                          총 {visibleLooseTracks.length}곡 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, visibleLooseTracks.length)}번째 곡 표시
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded-lg border border-outline-variant/15 text-[11px] font-bold text-on-surface-variant hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            이전
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                currentPage === page 
                                  ? 'bg-primary text-black font-black' 
                                  : 'border border-outline-variant/15 text-on-surface-variant hover:text-white'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded-lg border border-outline-variant/15 text-[11px] font-bold text-on-surface-variant hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            다음
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>


          </div>
            </div>
          </div>
        ) : activeTab === 'channels' ? (
          /* Channels Tab View (Channel Management) */
          <>
            <div className="flex gap-4 mb-6 border-b border-outline-variant/20 pb-4">
              <button 
                onClick={() => {
                  setActiveTab('private');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'private');
                  window.history.pushState({ tab: 'private' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Lock className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 음원 관리' : uiLanguage === 'JA' ? 'ライブラリ (非公開)' : 'Private Library'}
              </button>
              <button 
                onClick={() => {
                  setActiveTab('albums');
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'albums');
                  window.history.pushState({ tab: 'albums' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Folder className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 앨범 관리' : uiLanguage === 'JA' ? 'アルバム管理' : 'My Albums'}
              </button>
              <button 
                onClick={() => {
                  if (isAdmin) {
                    setActiveTab('channels');
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', 'channels');
                    window.history.pushState({ tab: 'channels' }, '', url.toString());
                  } else {
                    setShowComingSoon(true);
                  }
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${activeTab === 'channels' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <Users className="w-4 h-4" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Channel Mgt'}
              </button>
              <button 
                onClick={() => { 
                  setActiveTab('public'); 
                  handleSetPublicSubView('main'); 
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'public');
                  window.history.pushState({ tab: 'public' }, '', url.toString());
                }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer text-on-surface-variant hover:bg-surface-container-low`}
              >
                <Globe className="w-4 h-4" /> {uiLanguage === 'KO' ? '내 채널 (퍼블리싱됨)' : uiLanguage === 'JA' ? 'マイチャンネル (公開済み)' : 'My Channel (Published)'}
              </button>
            </div>

            <div className="mb-10 flex flex-col gap-6 text-left">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '추가 채널 관리' : uiLanguage === 'JA' ? '追加チャンネル' : 'Additional Channels'}</h3>
                  <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '새로운 아티스트 페르소나(채널)를 추가하고 관리합니다.' : uiLanguage === 'JA' ? '追加のアーティストペルソナを作成および管理します。' : 'Create and manage additional artist personas.'}</p>
                </div>
                <button
                  onClick={() => setShowChannelModal(true)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> {uiLanguage === 'KO' ? '채널 추가' : uiLanguage === 'JA' ? 'チャンネルを追加' : '채널 추가'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default Profile Channel */}
                <div 
                  className="p-4 bg-surface-container border border-outline-variant/30 rounded-2xl flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer" 
                  onClick={() => router.push(`/profile?tab=public`)}
                >
                  <div className="flex items-center gap-4">
                    {editAvatar ? (
                      <img src={editAvatar} alt={editName} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-zinc-500">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{editName || (uiLanguage === 'KO' ? '이름 없음' : uiLanguage === 'JA' ? '名前なし' : 'No Name')}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                          {uiLanguage === 'KO' ? '기본 채널' : uiLanguage === 'JA' ? 'デフォルト' : '기본 채널'}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">@{editHandle || 'handle'}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Channels */}
                {channels.map((ch: any) => (
                  <div key={ch.id} className="p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl flex items-center justify-between hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push(`/artists/${ch.slug}`)}>
                    <div className="flex items-center gap-4">
                      {ch.avatar_url ? (
                        <img src={ch.avatar_url} alt={ch.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-zinc-500">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{ch.name}</span>
                        <span className="text-xs text-zinc-500 font-mono">@{ch.slug}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch.id); }}
                      className="p-2 rounded-full hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-colors"
                      title={uiLanguage === 'KO' ? '채널 삭제' : uiLanguage === 'JA' ? 'チャンネルを削除' : '채널 삭제'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Channel Modal */}
            {mounted && typeof window !== 'undefined' && document.body && showChannelModal && createPortal(
              <div className="fixed inset-0 bg-black/70 backdrop-blur-md grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
                <div className="bg-[#121214] border border-zinc-800/80 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="relative py-5 flex items-center justify-center border-b border-zinc-850/40">
                    <h2 className="text-base font-extrabold text-white">
                      {uiLanguage === 'KO' ? '새 채널 추가' : uiLanguage === 'JA' ? '新しいチャンネルを作成' : 'Create New Channel'}
                    </h2>
                    <button 
                      onClick={resetChannelModal} 
                      className="absolute right-4 w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Body */}
                  <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
                    {/* Background Image Upload Area */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                        {uiLanguage === 'KO' ? '배너 이미지 (Background image)' : uiLanguage === 'JA' ? '背景画像' : 'Banner Image (Background image)'} <Info className="w-3.5 h-3.5 text-zinc-500" />
                      </label>
                      <div 
                        className="relative w-full h-44 bg-zinc-900/60 hover:bg-zinc-900 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer group overflow-hidden transition-colors"
                        onClick={() => document.getElementById('channel-banner-file-input')?.click()}
                      >
                        {newChannelBanner ? (
                          <img src={newChannelBanner} alt="Banner Preview" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-zinc-500 group-hover:text-primary transition-colors" />
                            <span className="text-xs text-zinc-400 font-medium">{uiLanguage === 'KO' ? '이미지 업로드' : uiLanguage === 'JA' ? '写真をアップロード' : 'Upload Image'}</span>
                          </>
                        )}
                        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </div>
                        <input 
                          id="channel-banner-file-input" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleChannelBannerUpload} 
                        />
                      </div>
                    </div>

                    {/* Profile Picture Upload Area */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                        {uiLanguage === 'KO' ? '프로필 사진 (Profile picture)' : uiLanguage === 'JA' ? 'プロフィール写真' : 'Profile Picture (Profile picture)'} <Info className="w-3.5 h-3.5 text-zinc-500" />
                      </label>
                      <div 
                        className="relative w-24 h-24 rounded-full cursor-pointer group overflow-visible shrink-0 self-start"
                        onClick={() => document.getElementById('channel-avatar-file-input')?.click()}
                      >
                        {newChannelAvatar ? (
                          <img src={newChannelAvatar} alt="Avatar Preview" className="w-24 h-24 rounded-full object-cover border border-zinc-800 shadow-lg" />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                            <User className="w-10 h-10" />
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </div>
                        <input 
                          id="channel-avatar-file-input" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleChannelAvatarUpload} 
                        />
                      </div>
                    </div>

                    {/* Display Name */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '채널명 (Display Name)' : uiLanguage === 'JA' ? '表示名' : 'Channel Name (Display Name)'}</label>
                      <input 
                        type="text" 
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder={uiLanguage === 'KO' ? '새 아티스트 이름' : uiLanguage === 'JA' ? 'マイニューアーティスト' : 'New Artist Name'}
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600"
                      />
                    </div>

                    {/* Add a bio */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '소개글 (Bio)' : uiLanguage === 'JA' ? '自己紹介を追加' : 'Bio (Bio)'}</label>
                        <span className="text-[10px] font-medium text-zinc-500">{newChannelBio.length}/1200</span>
                      </div>
                      <textarea 
                        value={newChannelBio}
                        onChange={(e) => setNewChannelBio(e.target.value.slice(0, 1200))}
                        placeholder={uiLanguage === 'KO' ? '채널에 대해 소개해주세요...' : uiLanguage === 'JA' ? 'このチャンネルについて教えてください...' : 'Introduce your channel...'}
                        maxLength={1200}
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors h-28 resize-none placeholder-zinc-600"
                      />
                    </div>

                    {/* Handle */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-zinc-400">
                        {uiLanguage === 'KO' ? '핸들 네임 (고유 URL)*' : uiLanguage === 'JA' ? 'ハンドルネーム*' : 'Handle (Unique URL)*'}
                        <span className="text-[10px] font-normal text-zinc-500 ml-2">(영문소문자, 숫자, _, - 만 가능)</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm font-medium text-zinc-500 font-mono">@</span>
                        <input 
                          type="text" 
                          value={newChannelSlug}
                          onChange={(e) => setNewChannelSlug(e.target.value)}
                          placeholder="artist_handle"
                          className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 pl-7 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600 font-mono"
                        />
                      </div>
                    </div>

                    {/* Genres Override */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '장르 설정 (Genres Override)' : uiLanguage === 'JA' ? 'ジャンル（オーバーライド）' : 'Genres Override'}</label>
                      <p className="text-[11px] text-zinc-500 leading-normal">
                        {uiLanguage === 'KO' ? '최대 5개의 음악 장르를 추가할 수 있습니다. 비워둘 경우 가장 인기 있는 곡의 장르가 표시됩니다.' : uiLanguage === 'JA' ? '音楽スタイルを説明するジャンルを最大5つ追加できます。空の場合、最も人気のある曲から推測されます。' : 'Add up to 5 genres. If left blank, the most popular genre will be shown.'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative flex-1 flex items-center">
                          <input 
                            type="text" 
                            value={newChannelGenreInput}
                            onChange={(e) => setNewChannelGenreInput(e.target.value.slice(0, 20))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newChannelGenreInput.trim() && newChannelTags.length < 5 && !newChannelTags.includes(newChannelGenreInput.trim())) {
                                  setNewChannelTags([...newChannelTags, newChannelGenreInput.trim()]);
                                  setNewChannelGenreInput('');
                                }
                              }
                            }}
                            placeholder={uiLanguage === 'KO' ? '장르 입력...' : uiLanguage === 'JA' ? 'ジャンルを入力...' : 'Enter genre...'}
                            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600"
                          />
                          <span className="absolute right-3 text-[10px] text-zinc-500 font-medium">{newChannelGenreInput.length}/20</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            if (newChannelGenreInput.trim() && newChannelTags.length < 5 && !newChannelTags.includes(newChannelGenreInput.trim())) {
                              setNewChannelTags([...newChannelTags, newChannelGenreInput.trim()]);
                              setNewChannelGenreInput('');
                            }
                          }}
                          disabled={!newChannelGenreInput.trim() || newChannelTags.length >= 5}
                          className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-sm font-bold text-white transition-all shrink-0"
                        >
                          {uiLanguage === 'KO' ? '추가' : uiLanguage === 'JA' ? '追加' : '추가'}
                        </button>
                      </div>
                      
                      {newChannelTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {newChannelTags.map((tag) => (
                            <span 
                              key={tag} 
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300"
                            >
                              {tag}
                              <button 
                                type="button" 
                                onClick={() => setNewChannelTags(newChannelTags.filter(t => t !== tag))}
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all text-[10px] font-bold"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Statistical Metrics Grid */}
                    <div className="border-t border-zinc-800/40 pt-4 mt-2">
                      <details className="group">
                        <summary className="text-xs font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer list-none flex items-center justify-between select-none">
                          <span>{uiLanguage === 'KO' ? '고급 통계 설정 (Advanced Statistics)' : uiLanguage === 'JA' ? '詳細な統計情報 (手動設定)' : 'Advanced Statistics'}</span>
                          <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
                        </summary>
                        <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-zinc-400">조회수 (Plays)</label>
                            <input 
                              type="text" 
                              value={newChannelPlays}
                              onChange={(e) => setNewChannelPlays(e.target.value)}
                              placeholder="예: 62K"
                              className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-zinc-400">좋아요수 (Likes)</label>
                            <input 
                              type="text" 
                              value={newChannelLikes}
                              onChange={(e) => setNewChannelLikes(e.target.value)}
                              placeholder="예: 3.5K"
                              className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-zinc-400">팔로워 수 (Followers)</label>
                            <input 
                              type="number" 
                              value={newChannelFollowers}
                              onChange={(e) => setNewChannelFollowers(Number(e.target.value))}
                              placeholder="예: 825"
                              className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-zinc-400">팔로잉 수 (Following)</label>
                            <input 
                              type="number" 
                              value={newChannelFollowing}
                              onChange={(e) => setNewChannelFollowing(Number(e.target.value))}
                              placeholder="예: 532"
                              className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-5 bg-[#141415]/40 border-t border-zinc-850/40 flex justify-end gap-3 rounded-b-3xl">
                    <button 
                      type="button"
                      onClick={resetChannelModal}
                      className="px-5 py-2.5 text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
                    >
                      {uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleAddChannel}
                      className="px-5 py-2.5 text-sm font-bold bg-[#e3fe06] text-black hover:bg-[#d0ea04] rounded-xl transition-all"
                    >
                      {uiLanguage === 'KO' ? '생성하기' : uiLanguage === 'JA' ? '保存' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </>
        ) : (
          /* Premium Public Artist Channel View */
          <>
            {publicSubView === 'all_songs' ? (
              <div className="flex flex-col gap-6">
                {/* Back Button */}
                <button 
                  onClick={handleBackFromSubview} 
                  className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start"
                >
                  <ArrowLeft className="w-4 h-4" />{uiLanguage === 'KO' ? '채널로 돌아가기' : uiLanguage === 'JA' ? 'チャンネルに戻る' : 'Back to Channel'}</button>

                <div className="mb-10">
                  <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2 tracking-tight font-sans">
                    {uiLanguage === 'KO' ? '전체 음원' : uiLanguage === 'JA' ? 'すべての曲' : 'All Songs'} <span className="text-xs text-on-surface-variant font-normal font-mono">({visibleLooseTracks.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {visibleLooseTracks.map((song: any, idx: number) => {
                      const isPlayingThis = currentTrack?.id === song.id && isPlaying;
                      return (
                        <div key={song.id} className="bg-surface-container/40 hover:bg-surface-container-high/60 border border-outline-variant/10 p-3 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01] group shadow-sm">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-md">
                              <img 
                                src={song.image_url || "/default-album.png"} 
                                alt="Cover" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/default-album.png";
                                }}
                              />
                              <button 
                                onClick={() => handlePlayMusic(song)}
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
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-bold text-on-surface truncate">{song.title}</span>
                                {!isPublicView && song.exposure_order && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-black shrink-0">
                                    {song.exposure_order}순위
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <span className="text-zinc-500 font-mono">▶</span> {song.form?.play_count || (song.title?.length * 450 + 1000) || 0}
                                </span>
                                <span>•</span>
                                <span>{song.genre || 'K-Pop'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleLikeSong(song); }}
                              className={`p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                                isSongLiked(song.id) ? 'text-primary' : 'text-zinc-500 hover:text-primary'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isSongLiked(song.id) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : publicSubView === 'all_albums' ? (
              <div className="flex flex-col gap-6">
                {/* Back Button */}
                <button 
                  onClick={handleBackFromSubview} 
                  className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start"
                >
                  <ArrowLeft className="w-4 h-4" />{uiLanguage === 'KO' ? '채널로 돌아가기' : uiLanguage === 'JA' ? 'チャンネルに戻る' : 'Back to Channel'}</button>

                <div className="mb-10">
                  <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2 tracking-tight font-sans">
                    {uiLanguage === 'KO' ? '전체 앨범' : uiLanguage === 'JA' ? 'すべてのアルバム' : 'All Albums'} <span className="text-xs text-on-surface-variant font-normal font-mono">({sortedPublicAlbums.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {sortedPublicAlbums.map(renderAlbumShowcaseCard)}
                  </div>
                </div>
              </div>
            ) : publicSubView === 'all_playlists' ? (
              <div className="flex flex-col gap-6">
                {/* Back Button */}
                <button 
                  onClick={handleBackFromSubview} 
                  className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start"
                >
                  <ArrowLeft className="w-4 h-4" />{uiLanguage === 'KO' ? '채널로 돌아가기' : uiLanguage === 'JA' ? 'チャンネルに戻る' : 'Back to Channel'}</button>

                <div className="mb-10">
                  <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2 tracking-tight font-sans">
                    {uiLanguage === 'KO' ? '전체 플레이리스트' : uiLanguage === 'JA' ? 'すべてのプレイリスト' : 'All Playlists'} <span className="text-xs text-on-surface-variant font-normal font-mono">({visiblePlaylists.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {visiblePlaylists.map(renderPlaylistCard)}
                  </div>
                </div>
              </div>
            ) : publicSubView === 'following' ? (
              <div className="flex flex-col gap-6">
                {/* Back Button */}
                <button 
                  onClick={handleBackFromSubview} 
                  className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-2 self-start cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />{uiLanguage === 'KO' ? '채널로 돌아가기' : uiLanguage === 'JA' ? 'チャンネルに戻る' : 'Back to Channel'}</button>

                <div className="mb-10">
                  <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2 tracking-tight font-sans">
                    {uiLanguage === 'KO' ? '내가 팔로우한 사용자' : uiLanguage === 'JA' ? 'フォロー中のユーザー' : 'Following'} <span className="text-xs text-on-surface-variant font-normal font-mono">({followedArtists.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {followedArtists.map((artist) => (
                      <div
                        key={artist.id}
                        onClick={() => router.push(`/artists/${artist.slug || artist.name.toLowerCase().replace(/\s+/g, '')}`)}
                        className="bg-surface-container-low border border-outline-variant/15 hover:border-primary/30 hover:bg-white/[0.01] p-5 rounded-2xl flex flex-col items-center justify-between group shadow-lg transition-all duration-300 cursor-pointer text-center relative"
                      >
                        <div className="w-20 h-20 rounded-full border-2 border-outline-variant/20 overflow-hidden shrink-0 bg-surface-container-lowest flex items-center justify-center mb-4 group-hover:border-primary/50 transition-colors shadow-inner">
                          {artist.avatar_url ? (
                            <img src={artist.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-8 h-8 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0 w-full mb-4">
                          <p className="font-bold text-sm truncate text-on-surface group-hover:text-primary transition-colors">{artist.name}</p>
                          {artist.slug && (
                            <p className="text-[10px] text-on-surface-variant/80 truncate mt-0.5 font-mono">@{artist.slug}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`${artist.name} 님의 팔로우를 취소하시겠습니까?`)) {
                              handleUnfollowArtist(artist.id);
                            }
                          }}
                          className="px-3 py-1 rounded-full border border-outline-variant hover:border-red-500 hover:text-red-500 text-[10px] font-bold text-on-surface-variant transition-colors cursor-pointer"
                        >{uiLanguage === 'KO' ? '팔로우 취소' : uiLanguage === 'JA' ? 'フォロー解除' : 'Unfollow'}</button>
                      </div>
                    ))}
                  </div>

                  {followedArtists.length === 0 && (
                    <div className="py-16 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                      {uiLanguage === 'KO' ? '팔로우한 사용자가 없습니다. 마음에 드는 아티스트를 팔로우해보세요.' : uiLanguage === 'JA' ? 'フォロー中のユーザーがいません。お気に入りのアーティストをフォローしてみましょう。' : 'You are not following anyone yet. Discover and follow your favorite artists.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Stats and Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-surface-container/30 border border-outline-variant/10 p-3 rounded-2xl backdrop-blur-sm">
                  <div className="flex flex-wrap gap-2">
                    <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm">
                      <span className="text-primary font-extrabold">{dbPublicLooseTracks.length}</span> songs
                    </div>
                    <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm">
                      <span className="text-primary font-extrabold">{profileFollowers}</span> followers
                    </div>
                    <button 
                      onClick={() => handleSetPublicSubView('following')}
                      className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 border border-outline-variant/10 shadow-sm transition-colors cursor-pointer"
                    >
                      <span className="text-primary font-extrabold">{Math.max(profileFollowing, followedArtists.length)}</span> following
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex gap-4 border-r border-outline-variant/20 pr-4 mr-2">
                      <button 
                        onClick={() => {
                          setActiveTab('private');
                          const url = new URL(window.location.href);
                          url.searchParams.set('tab', 'private');
                          window.history.pushState({ tab: 'private' }, '', url.toString());
                        }} 
                        className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${isPrivateView ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-white'}`}
                      >
                        <Lock className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '내 음원 관리' : uiLanguage === 'JA' ? '管理ダッシュボード' : 'Admin Dashboard'}
                      </button>
                      <button 
                        onClick={() => {
                          setActiveTab('albums');
                          const url = new URL(window.location.href);
                          url.searchParams.set('tab', 'albums');
                          window.history.pushState({ tab: 'albums' }, '', url.toString());
                        }} 
                        className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${isAlbumsView ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-white'}`}
                      >
                        <Folder className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '내 앨범 관리' : uiLanguage === 'JA' ? 'アルバム管理' : 'My Albums'}
                      </button>
                      <button 
                        onClick={() => {
                          if (isAdmin) {
                            setActiveTab('channels');
                            const url = new URL(window.location.href);
                            url.searchParams.set('tab', 'channels');
                            window.history.pushState({ tab: 'channels' }, '', url.toString());
                          } else {
                            setShowComingSoon(true);
                          }
                        }} 
                        className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-on-surface-variant hover:text-white`}
                      >
                        <Users className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Channel Mgt'}
                      </button>
                      <button 
                        onClick={() => { 
                          setActiveTab('public'); 
                          handleSetPublicSubView('main'); 
                          const url = new URL(window.location.href);
                          url.searchParams.set('tab', 'public');
                          window.history.pushState({ tab: 'public' }, '', url.toString());
                        }} 
                        className={`text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${isPublicView ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-white'}`}
                      >
                        <Globe className="w-3.5 h-3.5" /> {uiLanguage === 'KO' ? '아티스트 채널' : uiLanguage === 'JA' ? 'アーティストチャンネル' : 'Artist Channel'}
                      </button>
                    </div>
                    <button 
                      onClick={startEditingProfile}
                      className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/10 flex items-center gap-1.5 text-xs font-bold text-on-surface transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-primary" /> Edit Channel
                    </button>
                  </div>
                </div>

                {/* Featured Hero Showcase */}
                {visibleLooseTracks.length > 0 && (
                  <div className="mb-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {visibleLooseTracks.slice(0, 2).map((song: any, index: number) => {
                        const isPlayingThis = currentTrack?.id === song.id && isPlaying;
                        const isLiked = isSongLiked(song.id);
                        return (
                          <div key={song.id || index} className="relative rounded-3xl overflow-hidden border border-[#1b3a2a] shadow-2xl p-6 bg-gradient-to-r from-[#07140e] via-[#0b170f] to-[#050a06] flex flex-col sm:flex-row items-center gap-6 min-h-[180px]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none"></div>
                            
                            <div className="relative w-28 h-28 rounded-2xl overflow-hidden shrink-0 shadow-lg group">
                              <img 
                                src={song.image_url || "/default-album.png"} 
                                alt="Featured Cover" 
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
                                onClick={() => handlePlayMusic(song)}
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
                                {song.genre || 'K-Pop'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium pt-1 justify-center sm:justify-start">
                                <span className="flex items-center gap-1">
                                  <Play className="w-3.5 h-3.5 fill-current text-zinc-500" /> {song.form?.play_count || (song.title?.length * 450 + 1000) || '0'} Plays
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleLikeSong(song); }}
                                  className={`flex items-center gap-1 hover:text-primary transition-colors ${isLiked ? 'text-primary font-bold' : 'text-zinc-500'}`}
                                >
                                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current text-primary' : 'text-zinc-500'}`} /> {isSongLiked(song.id) ? Number(song.form?.like_count || (song.title?.length * 25 + 15) || 0) + 1 : Number(song.form?.like_count || (song.title?.length * 25 + 15) || 0)} Likes
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownloadTrack(song.audio_url || song.file_url, song.title, song.image_url || song.album?.cover_url); }}
                                  className="flex items-center gap-1 hover:text-primary transition-colors text-zinc-500 cursor-pointer"
                                  title="다운로드"
                                >
                                  <Download className="w-3.5 h-3.5" /> <span>Download</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Songs Grid (Show up to 9 songs) */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={() => handleSetPublicSubView('all_songs')}
                      className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight hover:text-primary transition-colors cursor-pointer group"
                    >
                      {uiLanguage === 'KO' ? '음원 목록' : uiLanguage === 'JA' ? '曲' : 'Songs'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                    </button>
                    {visibleLooseTracks.length > 9 && (
                      <button 
                        onClick={() => handleSetPublicSubView('all_songs')}
                        className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-350 hover:text-white transition-colors"
                      >{uiLanguage === 'KO' ? '더보기' : uiLanguage === 'JA' ? 'さらに表示' : 'More'}</button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {visibleLooseTracks.slice(0, 9).map((song: any, idx: number) => {
                      const isCurrent = currentTrack?.id === song.id;
                      const isPlayingThis = isCurrent && isPlaying;
                      return (
                        <div key={song.id} className={`bg-surface-container/40 hover:bg-surface-container-high/60 border border-outline-variant/10 p-3 rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01] group shadow-sm ${isCurrent ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-md">
                              <img 
                                src={song.image_url || "/default-album.png"} 
                                alt="Cover" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/default-album.png";
                                }}
                              />
                              <button 
                                onClick={() => handlePlayMusic(song)}
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
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-sm font-bold truncate ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{song.title}</span>
                                {!isPublicView && song.exposure_order && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-black shrink-0">
                                    {song.exposure_order}순위
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <span className="text-zinc-500 font-mono">▶</span> {song.form?.play_count || (song.title?.length * 450 + 1000) || 0}
                                </span>
                                <span>•</span>
                                <span>{song.genre || 'K-Pop'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleLikeSong(song); }}
                              className={`p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer ${
                                isSongLiked(song.id) ? 'text-primary' : 'text-zinc-500 hover:text-primary'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isSongLiked(song.id) ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadTrack(song.audio_url || song.file_url, song.title, song.image_url || song.album?.cover_url); }}
                              className="p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer text-zinc-500 hover:text-primary"
                              title="다운로드"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {visibleLooseTracks.length === 0 && (
                      <div className="col-span-full py-10 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                        {uiLanguage === 'KO' ? '퍼블리싱된 단일 곡이 없습니다.' : uiLanguage === 'JA' ? '公開された曲がありません。' : 'No published tracks.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Albums Grid (Show up to 10 albums) */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={() => handleSetPublicSubView('all_albums')}
                      className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight hover:text-primary transition-colors cursor-pointer group"
                    >
                      {uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                    </button>
                    {sortedPublicAlbums.length > 10 && (
                      <button 
                        onClick={() => handleSetPublicSubView('all_albums')}
                        className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-350 hover:text-white transition-colors"
                      >{uiLanguage === 'KO' ? '더보기' : uiLanguage === 'JA' ? 'さらに表示' : 'More'}</button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {sortedPublicAlbums.slice(0, 10).map(renderAlbumShowcaseCard)}
                    {sortedPublicAlbums.length === 0 && (
                      <div className="col-span-full py-10 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                        {uiLanguage === 'KO' ? '공개된 앨범이 없습니다.' : uiLanguage === 'JA' ? '公開されたアルバムがありません。' : 'No public albums.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Playlists Grid (Show up to 10 playlists) */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <button 
                      onClick={() => handleSetPublicSubView('all_playlists')}
                      className="text-lg font-bold text-on-surface flex items-center gap-1 tracking-tight hover:text-primary transition-colors cursor-pointer group"
                    >
                      {uiLanguage === 'KO' ? '플레이리스트' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlists'} <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                    </button>
                    {visiblePlaylists.length > 5 && (
                      <button 
                        onClick={() => handleSetPublicSubView('all_playlists')}
                        className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-zinc-350 hover:text-white transition-colors"
                      >{uiLanguage === 'KO' ? '더보기' : uiLanguage === 'JA' ? 'さらに表示' : 'More'}</button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {visiblePlaylists.slice(0, 5).map(renderPlaylistCard)}
                    {visiblePlaylists.length === 0 && (
                      <div className="col-span-full py-10 text-center text-sm text-zinc-400 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/10">
                        {uiLanguage === 'KO' ? '공개된 플레이리스트가 없습니다.' : uiLanguage === 'JA' ? '公開されたプレイリストがありません。' : 'No public playlists.'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* --- Audio Upload Modal --- */}
      {mounted && typeof window !== 'undefined' && document.body && isUploadModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
          <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 animate-duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                {uiLanguage === 'KO' ? '음원 파일 업로드' : uiLanguage === 'JA' ? '音声ファイルをアップロード' : '음원 파일 업로드'}
              </h2>
              <button 
                onClick={closeUploadModal} 
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors cursor-pointer"
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-5 pt-2 flex flex-col gap-4 flex-1 overflow-y-auto">
              
              {/* Audio File Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '오디오 파일 (필수)' : uiLanguage === 'JA' ? '音声ファイル (必須)' : '오디오 파일 (필수)'}
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#141415] border border-outline-variant/20 hover:border-primary/50 cursor-pointer transition-colors text-xs font-bold text-on-surface">
                    <Music className="w-4 h-4 text-primary" />
                    {uiLanguage === 'KO' ? '파일 선택' : uiLanguage === 'JA' ? 'ファイルを選択' : '파일 선택'}
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadFile(file)
                          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
                          const audioUrl = URL.createObjectURL(file)
                          const tempAudio = new Audio(audioUrl)
                          tempAudio.onloadedmetadata = () => {
                            setUploadDuration(Math.floor(tempAudio.duration))
                          }
                        }
                      }} 
                    />
                  </label>
                  <span className="text-xs text-zinc-400 truncate max-w-[200px]">
                    {uploadFile ? uploadFile.name : (uiLanguage === 'KO' ? '선택된 파일 없음' : uiLanguage === 'JA' ? 'ファイルが選択されていません' : 'No file selected')}
                  </span>
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '곡 제목 (필수)' : uiLanguage === 'JA' ? 'タイトル (必須)' : '곡 제목 (필수)'}
                </label>
                <input 
                  type="text" 
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={uiLanguage === 'KO' ? '제목을 입력하세요' : uiLanguage === 'JA' ? '曲のタイトルを入力' : '제목을 입력하세요'}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                />
              </div>

              {/* Channel Selection (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant flex items-center justify-between">
                  <span>{uiLanguage === 'KO' ? '채널 등록 (선택)' : uiLanguage === 'JA' ? 'チャンネルに公開 (任意)' : '채널 등록 (선택)'}</span>
                </label>
                <select
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
                  value={uploadChannelId}
                  onChange={(e) => setUploadChannelId(e.target.value)}
                >
                  <option value="">{uiLanguage === 'KO' ? '선택 안 함 (메인 채널에만 등록)' : uiLanguage === 'JA' ? 'なし (メインチャンネルのみ)' : '선택 안 함 (메인 채널에만 등록)'}</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>

              {/* Genre Category (Required) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリ (必須)' : 'Genre Category (Required)'}
                </label>
                <select
                  value={uploadGenre}
                  onChange={(e) => setUploadGenre(e.target.value)}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
                >
                  <option value="">{uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリを選択' : 'Select Genre Category'}</option>
                  {GENRES.map(g => (
                    <option key={g.name} value={g.name}>
                      {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cover Image Upload (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '커버 이미지 (선택)' : uiLanguage === 'JA' ? 'カバー画像 (任意)' : '커버 이미지 (선택)'}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#141415] border border-outline-variant/20 flex items-center justify-center shrink-0">
                    {uploadCoverUrl ? (
                      <img src={uploadCoverUrl} className="w-full h-full object-cover" alt="Cover Preview" />
                    ) : (
                      <Folder className="w-6 h-6 text-zinc-600" />
                    )}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141415] border border-outline-variant/20 hover:border-primary/50 cursor-pointer transition-colors text-xs font-bold text-on-surface">
                    <Upload className="w-3.5 h-3.5 text-zinc-400" />
                    {uiLanguage === 'KO' ? '이미지 선택' : uiLanguage === 'JA' ? '画像を選択' : '이미지 선택'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadCoverImage} />
                  </label>
                  {uploadCoverUrl && (
                    <button 
                      onClick={() => setUploadCoverUrl('')} 
                      className="p-1 rounded-md text-red-400 hover:bg-red-500/10 text-xs font-bold"
                    >
                      {uiLanguage === 'KO' ? '삭제' : uiLanguage === 'JA' ? '削除' : '삭제'}
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt Setting */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '프롬프트 (선택)' : uiLanguage === 'JA' ? 'プロンプト (任意)' : '프롬프트 (선택)'}
                </label>
                <input 
                  type="text" 
                  value={uploadPrompt}
                  onChange={(e) => setUploadPrompt(e.target.value)}
                  placeholder="e.g. upbeat synthpop, energetic tempo"
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                />
              </div>

              {/* Lyrics / Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '가사 / 설명 (선택)' : uiLanguage === 'JA' ? '歌詞 / 説明 (任意)' : '가사 / 설명 (선택)'}
                </label>
                <textarea 
                  value={uploadLyrics}
                  onChange={(e) => setUploadLyrics(e.target.value)}
                  placeholder={uiLanguage === 'KO' ? '가사 또는 음원 정보를 입력하세요' : uiLanguage === 'JA' ? '歌詞または曲の詳細を入力' : '가사 또는 음원 정보를 입력하세요'}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 h-24 resize-none text-sm font-sans"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">
                  {uiLanguage === 'KO' ? '제작 노트 (선택)' : uiLanguage === 'JA' ? 'メモ (任意)' : '제작 노트 (선택)'}
                </label>
                <input 
                  type="text" 
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. Mastered version, special release"
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                />
              </div>

              {/* Credit Information (Lyricist, Composer, Arranger) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">
                    {uiLanguage === 'KO' ? '작사 (선택)' : uiLanguage === 'JA' ? '作詞 (任意)' : '작사 (선택)'}
                  </label>
                  <input 
                    type="text" 
                    value={uploadLyricist}
                    onChange={(e) => setUploadLyricist(e.target.value)}
                    placeholder="e.g. 홍길동"
                    className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">
                    {uiLanguage === 'KO' ? '작곡 (선택)' : uiLanguage === 'JA' ? '作曲 (任意)' : '작곡 (선택)'}
                  </label>
                  <input 
                    type="text" 
                    value={uploadComposer}
                    onChange={(e) => setUploadComposer(e.target.value)}
                    placeholder="e.g. 김철수"
                    className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">
                    {uiLanguage === 'KO' ? '편곡 (선택)' : uiLanguage === 'JA' ? '編曲 (任意)' : '편곡 (선택)'}
                  </label>
                  <input 
                    type="text" 
                    value={uploadArranger}
                    onChange={(e) => setUploadArranger(e.target.value)}
                    placeholder="e.g. 이영희"
                    className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 text-sm"
                  />
                </div>
              </div>

              {/* Publishing Status Toggle */}
              <div className="flex items-center justify-between bg-[#141415] border border-outline-variant/15 p-3 rounded-lg">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-on-surface">
                    {uiLanguage === 'KO' ? '음원 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? '曲を公開 (パブリック)' : '음원 퍼블리싱 (공개 여부)'}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {uiLanguage === 'KO' ? '내 채널(공개 프로필)에 이 음원을 즉시 공개합니다.' : uiLanguage === 'JA' ? 'このトラックを公開プロフィールに表示します。' : '내 채널(공개 프로필)에 이 음원을 즉시 공개합니다.'}
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={uploadIsPublished} 
                  onChange={(e) => setUploadIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant/30 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-outline-variant/10 bg-surface-container/20">
              <button 
                onClick={closeUploadModal} 
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors text-xs font-bold cursor-pointer"
                disabled={isUploading}
              >
                {uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
              </button>
              <button 
                onClick={handleAudioUpload} 
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-black transition-colors text-xs font-bold disabled:opacity-50 cursor-pointer"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                    {uiLanguage === 'KO' ? '업로드 중...' : uiLanguage === 'JA' ? 'アップロード中...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {uiLanguage === 'KO' ? '업로드 완료' : uiLanguage === 'JA' ? 'アップロード完了' : 'Upload Complete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- Playlist Modal --- */}
      {mounted && typeof window !== 'undefined' && document.body && isPlaylistModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
          <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="text-2xl font-sans text-on-surface font-medium">
                {editingPlaylistId 
                  ? (playlistType === 'album' ? '앨범 정보 수정' : '플레이리스트 정보 수정') 
                  : (playlistType === 'album' ? '새 앨범 만들기' : '새 플레이리스트 만들기')}
              </h2>
              <button onClick={handleCancelEdit} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-5 pt-2 flex flex-col gap-4 flex-1 overflow-y-auto">
              {/* Title */}
              <input 
                type="text" 
                value={playlistTitle}
                onChange={(e) => setPlaylistTitle(e.target.value)}
                placeholder={playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 제목' : uiLanguage === 'JA' ? 'アルバムのタイトル' : 'Album Title') : (uiLanguage === 'KO' ? '플레이리스트 제목' : uiLanguage === 'JA' ? 'プレイリストのタイトル' : 'Playlist Title')}
                className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50"
              />
              
              {/* Description */}
              <div className="relative">
                <textarea 
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value.substring(0, 200))}
                  placeholder={playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 설명' : uiLanguage === 'JA' ? 'アルバムの説明' : 'Album Description') : (uiLanguage === 'KO' ? '플레이리스트 설명' : uiLanguage === 'JA' ? 'プレイリストの説明' : 'Playlist Description')}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-on-surface focus:outline-none focus:border-primary/50 h-28 resize-none"
                />
                <div className="text-right text-[11px] text-on-surface-variant mt-1">
                  {playlistDescription.length} / 200
                </div>
              </div>

              {/* Genre Category (Required) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">{uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリ (必須)' : 'Genre Category (Required)'}</label>
                <select
                  value={playlistGenre}
                  onChange={(e) => setPlaylistGenre(e.target.value)}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
                >
                  <option value="">{uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリを選択' : 'Select Genre Category'}</option>
                  {GENRES.map(g => (
                    <option key={g.name} value={g.name}>
                      {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exposure Order Setting */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">{uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順位設定' : 'Exposure Order Settings'}</label>
                <select
                  value={playlistExposureOrder || ''}
                  onChange={(e) => setPlaylistExposureOrder(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
                >
                  <option value="">기본 (최신 등록순)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}순위 (우선 노출)</option>
                  ))}
                </select>
              </div>

              {/* Publishing Status Toggle */}
              <div className="flex items-center justify-between bg-[#141415] border border-outline-variant/15 p-3 rounded-lg mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-on-surface">
                    {playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? 'アルバムの公開 (公開設定)' : 'Publish Album (Public)') : (uiLanguage === 'KO' ? '플레이리스트 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? 'プレイリストの公開 (公開設定)' : 'Publish Playlist (Public)')}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {playlistType === 'album' ? '내 채널(공개 프로필)에 이 앨범을 공개합니다.' : '내 채널(공개 프로필)에 이 플레이리스트를 공개합니다.'}
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={playlistIsPublished} 
                  onChange={(e) => setPlaylistIsPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant/30 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
              </div>

              {/* Central Image Preview */}
              <div className="flex flex-col items-center my-2 gap-3 relative">
                <div className="w-48 h-48 rounded-xl overflow-hidden bg-[#141415] border border-outline-variant/20 flex items-center justify-center group relative shadow-lg">
                  {playlistCover ? (
                    <>
                      <img src={playlistCover} className="w-full h-full object-cover" alt="Playlist Cover" />
                      <button 
                        onClick={() => setPlaylistCover('')} 
                        className="absolute right-2 top-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-on-surface-variant hover:text-primary transition-colors">
                      <Upload className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm font-medium">
                        {playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 커버 업로드' : uiLanguage === 'JA' ? 'アルバムカバーをアップロード' : 'Upload Album Cover') : (uiLanguage === 'KO' ? '플레이리스트 커버 업로드' : uiLanguage === 'JA' ? 'プレイリストカバーをアップロード' : 'Upload Playlist Cover')}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePlaylistCoverUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* AI Image Generation Prompt (UI only for now) */}
              <div className="flex gap-2 items-center">
                <input 
                  type="text"
                  placeholder="Prompt for an AI-generated image..."
                  className="flex-1 bg-[#141415] border border-outline-variant/20 rounded-lg p-3 text-sm text-on-surface focus:outline-none focus:border-primary/50"
                />
                <button 
                  className="px-4 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-bold rounded-lg transition-colors"
                  onClick={() => alert("현재는 디자인(UI) 레이아웃만 적용되어 있습니다. 실제 AI 이미지 생성 API 연동이 필요합니다!")}
                >
                  Generate
                </button>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 pt-2 flex justify-end gap-2">
              <button 
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-outline-variant/20 hover:bg-white/5 rounded-lg text-sm font-bold text-on-surface transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={savePlaylistModal}
                className="px-6 py-2 bg-on-surface text-background font-bold rounded-lg hover:bg-on-surface/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- Custom Confirm Modal --- */}
      {mounted && typeof window !== 'undefined' && document.body && confirmModal && confirmModal.isOpen && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center overflow-y-auto z-[60] p-4 py-12">
          <div className="bg-[#1C1C1E] border border-outline-variant/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 pb-3">
              <h3 className="text-lg font-bold text-on-surface">{confirmModal.title}</h3>
            </div>
            
            {/* Message */}
            <div className="px-5 pb-5 text-sm text-on-surface-variant whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </div>

            {/* Genre Select (For Publishing) */}
            {confirmModal.showGenreSelect && (
              <div className="px-5 pb-5">
                <label className="block text-xs font-bold text-on-surface-variant mb-2">{uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリ (必須)' : 'Genre Category (Required)'}</label>
                <select
                  value={publishGenre}
                  onChange={(e) => setPublishGenre(e.target.value)}
                  className="w-full bg-[#141415] border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
                >
                  <option value="">-- 장르 선택 --</option>
                  {GENRES.map(g => (
                    <option key={g.name} value={g.name}>
                      {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="p-4 bg-[#141415]/40 border-t border-outline-variant/10 flex justify-end gap-2">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all"
              >
                {confirmModal.cancelText || '취소'}
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.showGenreSelect && !publishGenre) {
                    alert('장르 카테고리를 반드시 선택해 주세요.');
                    return;
                  }
                  confirmModal.onConfirm(publishGenre);
                  setConfirmModal(null);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  confirmModal.isDestructive 
                    ? 'bg-red-500 hover:bg-red-600 text-white font-bold' 
                    : 'bg-on-surface text-background font-bold hover:bg-on-surface/90'
                }`}
              >
                {confirmModal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Edit Modal */}
      {mounted && typeof window !== 'undefined' && document.body && isEditingProfile && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md grid place-items-center overflow-y-auto z-50 p-4 py-12 md:py-20">
          <div className="bg-[#121214] border border-zinc-800/80 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="relative py-5 flex items-center justify-center border-b border-zinc-850/40">
              <h2 className="text-base font-extrabold text-white">Edit Profile</h2>
              <button 
                onClick={() => setIsEditingProfile(false)} 
                className="absolute right-4 w-8 h-8 rounded-full bg-zinc-800/50 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
              {/* Background Image Upload Area */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  Background image <Info className="w-3.5 h-3.5 text-zinc-500" />
                </label>
                <div 
                  className="relative w-full h-44 bg-zinc-900/60 hover:bg-zinc-900 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer group overflow-hidden transition-colors"
                  onClick={() => document.getElementById('banner-file-input')?.click()}
                >
                  {editBanner ? (
                    <img src={editBanner} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-zinc-500 group-hover:text-primary transition-colors" />
                      <span className="text-xs text-zinc-400 font-medium">Upload a photo</span>
                    </>
                  )}
                  {/* Pencil Edit Icon bottom right */}
                  <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <input 
                    id="banner-file-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfileBannerUpload} 
                  />
                </div>
              </div>

              {/* Profile Picture Upload Area */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  Profile picture <Info className="w-3.5 h-3.5 text-zinc-500" />
                </label>
                <div 
                  className="relative w-24 h-24 rounded-full cursor-pointer group overflow-visible shrink-0 self-start"
                  onClick={() => document.getElementById('avatar-file-input')?.click()}
                >
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar Preview" className="w-24 h-24 rounded-full object-cover border border-zinc-800 shadow-lg" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                  {/* Pencil Edit Icon bottom right */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black/85 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <input 
                    id="avatar-file-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfileImageUpload} 
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Xen Music"
                  className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600"
                />
              </div>

              {/* Add a bio */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400">Add a bio</label>
                  <span className="text-[10px] font-medium text-zinc-500">{editBio.length}/1200</span>
                </div>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 1200))}
                  placeholder="Tell us about yourself..."
                  maxLength={1200}
                  className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors h-28 resize-none placeholder-zinc-600"
                />
              </div>

              {/* Handle */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">Handle*</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-medium text-zinc-500 font-mono">@</span>
                  <input 
                    type="text" 
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="xen_x"
                    required
                    className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 pl-7 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors placeholder-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Genres Override */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">Genres Override</label>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Add up to 5 genres to describe your music style. If this is empty, the genres will be inferred from your most popular songs
                </p>
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
                
                {/* Genre Override Chips */}
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editTags.map((tag) => (
                      <span 
                        key={tag} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300"
                      >
                        {tag}
                        <button 
                          type="button" 
                          onClick={() => setEditTags(editTags.filter(t => t !== tag))}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Statistical Metrics Grid */}
              <div className="border-t border-zinc-800/40 pt-4 mt-2">
                <details className="group">
                  <summary className="text-xs font-bold text-zinc-500 hover:text-zinc-300 cursor-pointer list-none flex items-center justify-between select-none">
                    <span>Advanced Statistics Override</span>
                    <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-400">조회수 (Plays)</label>
                      <input 
                        type="text" 
                        value={editPlays}
                        onChange={(e) => setEditPlays(e.target.value)}
                        placeholder="예: 62K"
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-400">좋아요수 (Likes)</label>
                      <input 
                        type="text" 
                        value={editLikes}
                        onChange={(e) => setEditLikes(e.target.value)}
                        placeholder="예: 3.5K"
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-400">팔로워 수 (Followers)</label>
                      <input 
                        type="number" 
                        value={editFollowers}
                        onChange={(e) => setEditFollowers(Number(e.target.value))}
                        placeholder="예: 825"
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-400">팔로잉 수 (Following)</label>
                      <input 
                        type="number" 
                        value={editFollowing}
                        onChange={(e) => setEditFollowing(Number(e.target.value))}
                        placeholder="예: 532"
                        className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-[#141415]/40 border-t border-zinc-850/40 flex justify-end gap-3 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-5 py-2.5 text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={saveProfile}
                className="px-5 py-2.5 text-sm font-bold bg-primary text-background hover:bg-primary/95 rounded-xl transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      
      {/* Move Track Modal */}
      {moveTrackModalData && typeof window !== 'undefined' && require('react-dom').createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-[9999] p-4" onClick={() => setMoveTrackModalData(null)}>
          <div className="bg-surface-container border border-outline-variant/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh] text-on-surface" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center">
              <h2 className="text-xl font-bold">폴더로 이동</h2>
            </div>
            
            <div className="overflow-y-auto flex-1 flex flex-col p-2">
              <button
                onClick={() => {
                  handleMoveTrack(moveTrackModalData.id, null);
                  setMoveTrackModalData(null);
                  showToast('기본 폴더로 이동되었습니다.', 'success');
                }}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left w-full"
              >
                <Folder className="w-5 h-5 text-primary fill-current" />
                <span className="text-sm font-bold text-white">기본 폴더 (모든 폴더)</span>
              </button>

              {/* Recursive render for folder tree in Move Modal */}
              {(() => {
                const renderMoveFolders = (nodes: any[], depth = 0): any[] => {
                  let result: any[] = [];
                  for (const folder of nodes) {
                    result.push(
                      <button
                        key={folder.id}
                        onClick={() => {
                          handleMoveTrack(moveTrackModalData.id, folder.id);
                          setMoveTrackModalData(null);
                          showToast(`'${folder.title}' 폴더로 이동되었습니다.`, 'success');
                        }}
                        className="flex items-center gap-4 py-3.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left w-full"
                        style={{ paddingLeft: `${16 + depth * 24}px`, paddingRight: '16px' }}
                      >
                        {depth > 0 ? (
                          <div className="w-5 h-5 flex justify-center items-center opacity-50"><div className="w-1.5 h-1.5 border-l-2 border-b-2 border-zinc-400 rounded-bl-sm"></div></div>
                        ) : (
                          <Folder className="w-5 h-5 text-zinc-400" />
                        )}
                        <span className="text-sm font-bold text-zinc-200">{folder.title}</span>
                      </button>
                    );
                    if (folder.children && folder.children.length > 0) {
                      result = result.concat(renderMoveFolders(folder.children, depth + 1));
                    }
                  }
                  return result;
                };
                return renderMoveFolders(folderTree);
              })()}
            </div>

            <div className="p-4 border-t border-outline-variant/10 flex justify-end bg-surface-container-low/50">
              <button 
                onClick={() => setMoveTrackModalData(null)} 
                className="px-6 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Folder Management Modal */}
      {isFolderManageModalOpen && typeof window !== 'undefined' && require('react-dom').createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md grid place-items-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-surface-container border border-outline-variant/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-left flex flex-col max-h-[80vh] text-on-surface" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center">
              <h2 className="text-xl font-bold">폴더 관리</h2>
              <button onClick={() => setIsFolderManageModalOpen(false)} className="p-1 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-8">
              {/* 새 폴더 만들기 */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-on-surface-variant">새 폴더 만들기</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newQuickFolderName}
                    onChange={(e) => setNewQuickFolderName(e.target.value)}
                    placeholder="새 폴더 이름..."
                    className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickCreateFolder()
                    }}
                  />
                  <button 
                    onClick={handleQuickCreateFolder}
                    disabled={isQuickCreating}
                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-black px-6 py-3 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    {isQuickCreating ? '추가 중...' : '추가'}
                  </button>
                </div>
              </div>

              {/* 시스템 폴더 */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-on-surface-variant">시스템 폴더</label>
                
                <div className="flex flex-col gap-3">
                  {/* 모든 폴더 */}
                  <div className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-surface-container-high rounded-lg text-primary">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">모든 폴더</span>
                        <span className="text-xs text-on-surface-variant">{visibleLooseTracksRaw.length} 곡</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant/50 px-2 py-1 bg-white/5 rounded">수정 불가</span>
                  </div>

                  {/* 업로드 */}
                  <div className="flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-surface-container-high rounded-lg text-primary">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">업로드</span>
                        <span className="text-xs text-on-surface-variant">{visibleLooseTracksRaw.filter(h => h.source === 'upload' || h.type === 'upload').length} 곡</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant/50 px-2 py-1 bg-white/5 rounded">수정 불가</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-outline-variant/10 flex justify-end bg-surface-container-low/50">
              <button 
                onClick={() => setIsFolderManageModalOpen(false)} 
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Beautiful Custom Toast Notifications */}
      {mounted && typeof window !== 'undefined' && document.body && toast && createPortal(
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] bg-[#121214]/90 backdrop-blur-md border border-zinc-800/80 text-sm font-bold text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none">
          <div className={`w-2 h-2 rounded-full ${
            toast.type === 'success' ? 'bg-[#e3fe06]' : toast.type === 'error' ? 'bg-red-500' : 'bg-primary'
          }`} />
          <span>{toast.message}</span>
        </div>,
        document.body
      )}

      {/* Side Panel for Song Details */}
      {selectedSong && mounted && typeof window !== 'undefined' && document.body && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm sm:hidden" onClick={() => setSelectedSong(null)} />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#111a12] border-l border-emerald-950/30 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-emerald-950/30 flex justify-between items-center bg-[#0d140e] shrink-0">
              <h2 className="text-lg font-black text-white truncate pr-4">{selectedSong.title}</h2>
              <button onClick={() => setSelectedSong(null)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-8 bg-[#111a12]/50">
              
              {/* Thumbnail Upload */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  {uiLanguage === 'KO' ? '음원 썸네일' : uiLanguage === 'JA' ? 'サムネイル' : 'Thumbnail'}
                </label>
                <div className="aspect-square bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 relative group shadow-inner">
                  {selectedSong.image_url ? (
                    <img src={selectedSong.image_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/50">
                      <Music className="w-12 h-12 mb-3 opacity-30" />
                      <span className="text-sm font-medium">{uiLanguage === 'KO' ? '이미지 없음' : 'No image'}</span>
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-sm">
                    <div className="bg-white/10 px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-2 hover:bg-white/20 hover:scale-105 transition-all">
                      {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uiLanguage === 'KO' ? '썸네일 업로드' : 'Upload'}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(e, 'image')} disabled={isUploadingMedia} />
                  </label>
                </div>
                <p className="text-xs text-zinc-500 px-1">{uiLanguage === 'KO' ? '최대 5MB 이하의 이미지 파일(JPG, PNG 등)을 권장합니다.' : 'Max 5MB image'}</p>
              </div>

              <div className="h-px bg-emerald-950/30 w-full" />

              {/* Video Upload & Viewer */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                  <Play className="w-4 h-4 text-rose-400" />
                  {uiLanguage === 'KO' ? '뮤직 비디오 (MP4)' : uiLanguage === 'JA' ? 'ミュージックビデオ' : 'Music Video'}
                </label>
                {selectedSong.video_url || history.find(t => t.id === selectedSong.id)?.video_url ? (
                  <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-[9/16] max-h-[400px] w-full max-w-[225px] mx-auto relative group shadow-2xl">
                    <video src={selectedSong.video_url || history.find(t => t.id === selectedSong.id)?.video_url} controls className="w-full h-full object-cover bg-black" />
                    <label className="absolute top-3 right-3 bg-black/70 hover:bg-black/90 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all backdrop-blur-md flex items-center gap-2 z-10 border border-white/10 opacity-0 group-hover:opacity-100 hover:scale-105">
                      {isUploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} 
                      {uiLanguage === 'KO' ? '영상 변경' : 'Change Video'}
                      <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => handleMediaUpload(e, 'video')} disabled={isUploadingMedia} />
                    </label>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-emerald-950/40 hover:border-primary/50 bg-[#111a12] hover:bg-[#152017] rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-zinc-500 hover:text-zinc-300 group">
                    <div className="w-12 h-12 rounded-full bg-emerald-950/30 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                      <Upload className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-bold mb-1.5 text-zinc-300">{uiLanguage === 'KO' ? '동영상 업로드' : 'Upload Video'}</span>
                    <span className="text-xs text-zinc-500 text-center leading-relaxed">
                      {uiLanguage === 'KO' ? 'Spotify 캔버스 스타일의 세로형 짧은 영상(9:16 비율, 3~8초)을 올려주세요.\n(최대 16MB)' : 'Upload short looping video like Spotify Canvas (9:16, 3-8s).\n(Max 16MB)'}
                    </span>
                    <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => handleMediaUpload(e, 'video')} disabled={isUploadingMedia} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
