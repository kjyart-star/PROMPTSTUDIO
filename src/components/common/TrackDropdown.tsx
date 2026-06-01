'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Plus, Search, Check, Heart, ListMusic, Share2, Disc3, Info } from 'lucide-react'
import { Track } from '@/types/music'
import { usePlayerStore } from '@/stores/playerStore'

interface TrackDropdownProps {
  track: Track;
  myPlaylists: any[];
  userLikes: string[];
  uiLanguage: string;
  onLikeToggle: (trackId: string) => void;
  onSaveToPlaylist: (trackId: string, playlistId: string) => void;
  onShowCredits?: () => void;
}

export function TrackDropdown({
  track,
  myPlaylists,
  userLikes,
  uiLanguage,
  onLikeToggle,
  onSaveToPlaylist,
  onShowCredits
}: TrackDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isLiked = userLikes.includes(track.id)

  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
      if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
        setShowSubmenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!showDropdown) {
      setSearchQuery('')
      setShowSubmenu(false)
    }
  }, [showDropdown])

  const handleMouseEnterDropdown = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    setShowDropdown(true)
  }

  const handleMouseLeaveDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false)
      setShowSubmenu(false)
    }, 150)
  }

  const handleMouseEnterPlaylist = () => {
    if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current)
    setShowSubmenu(true)
  }

  const handleMouseLeavePlaylist = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setShowSubmenu(false)
    }, 150)
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(`${url} (Track: ${track.title})`)
    alert(uiLanguage === 'KO' ? '주소가 복사되었습니다.' : uiLanguage === 'JA' ? 'リンクがコピーされました。' : 'Link copied to clipboard.')
    setShowDropdown(false)
  }

  const handleGoToAlbum = (e: React.MouseEvent) => {
    e.stopPropagation()
    const slug = track.album?.slug || track.album_id
    if (slug && slug !== 'loose' && !slug.includes('dummy')) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      if (isUUID) {
        if (typeof window !== 'undefined') {
          window.location.href = `/profile?tab=albums&playlistId=${slug}`
        }
      } else {
        if (typeof window !== 'undefined') {
          window.location.href = `/albums/${slug}`
        }
      }
    } else {
      if (window.confirm(uiLanguage === 'KO' ? '해당 음원은 연결된 앨범이 없습니다.\n제작자 채널로 이동하시겠습니까?' : 'This track does not have an associated album.\nGo to the creator\\'s channel?')) {
        const artistSlug = track.album?.artist?.slug || (track as any).artist?.slug || 'suno-ai';
        if (typeof window !== 'undefined') {
          window.location.href = `/artists/${artistSlug}`;
        }
      }
    }
    setShowDropdown(false)
  }

  const addToQueue = (e: React.MouseEvent) => {
    e.stopPropagation()
    const store = usePlayerStore.getState()
    const isAlreadyInQueue = store.queue.some(t => t.id === track.id)
    if (isAlreadyInQueue) {
      alert(uiLanguage === 'KO' ? '이미 대기열에 있는 곡입니다.' : 'Already in queue.')
    } else {
      usePlayerStore.setState({
        queue: [...store.queue, track]
      })
      alert(uiLanguage === 'KO' ? '재생목록 대기열에 추가되었습니다.' : 'Added to play queue.')
    }
    setShowDropdown(false)
  }

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnterDropdown}
      onMouseLeave={handleMouseLeaveDropdown}
    >
      <button 
        onClick={(e) => {
          e.stopPropagation()
          setShowDropdown(!showDropdown)
        }}
        className={`text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-center ${showDropdown ? 'text-primary bg-white/[0.04]' : ''}`}
        title={uiLanguage === 'KO' ? '더 보기' : 'More options'}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-56 bg-[#282828] border border-zinc-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col text-xs font-bold text-zinc-200 select-none animate-in fade-in slide-in-from-top-2 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 플레이리스트에 추가하기 (Trigger sub-menu on hover) */}
          <div 
            className="relative"
            onMouseEnter={handleMouseEnterPlaylist}
            onMouseLeave={handleMouseLeavePlaylist}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSubmenu(!showSubmenu)
              }}
              className={`w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center justify-between cursor-pointer ${showSubmenu ? 'bg-white/10 text-white' : ''}`}
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {uiLanguage === 'KO' ? '플레이리스트에 추가하기' : uiLanguage === 'JA' ? 'プレイリストに追加' : 'Add to playlist'}
              </span>
              <span className="text-zinc-400 font-mono text-[10px]">▶</span>
            </button>

            {/* Submenu: Playlist List (Absolute Position next to the main dropdown) */}
            {showSubmenu && (
              <div 
                className="absolute right-[224px] top-0 w-56 bg-[#282828] border border-zinc-800 rounded-lg shadow-2xl z-[60] p-1.5 flex flex-col gap-1 text-xs font-bold text-zinc-200"
                onMouseEnter={handleMouseEnterPlaylist}
                onMouseLeave={handleMouseLeavePlaylist}
              >
                {/* Search playlist */}
                <div className="relative px-1 py-1">
                  <input
                    type="text"
                    placeholder={uiLanguage === 'KO' ? '플레이리스트 찾기' : 'Search playlist'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                    className="w-full bg-[#3e3e3e] text-white border-none rounded px-2.5 py-1.5 pl-7 text-[11px] placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3.5" />
                </div>

                <div className="border-b border-zinc-800 my-0.5"></div>

                {/* Playlist scroll list */}
                <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5">
                  {myPlaylists
                    .filter(pl => pl.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(pl => (
                      <button
                        key={pl.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSaveToPlaylist(track.id, pl.id)
                          setShowDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-white/10 hover:text-white truncate cursor-pointer flex items-center justify-between text-zinc-200"
                      >
                        <span className="truncate">{pl.title}</span>
                      </button>
                    ))}
                  {myPlaylists.filter(pl => pl.title?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-3 text-zinc-500 text-[10px]">
                      {uiLanguage === 'KO' ? '검색 결과가 없습니다' : 'No playlists found'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-zinc-800 my-0.5 mx-2"></div>

          {/* 좋아요 표시한 곡에 추가 / 삭제 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onLikeToggle(track.id)
              setShowDropdown(false)
            }}
            className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
          >
            {isLiked ? (
              <>
                <Check className="w-4 h-4 text-primary" />
                <span>{uiLanguage === 'KO' ? '좋아요 표시한 곡에서 삭제하기' : uiLanguage === 'JA' ? 'いいねを解除' : 'Remove from Liked Songs'}</span>
              </>
            ) : (
              <>
                <Heart className="w-4 h-4" />
                <span>{uiLanguage === 'KO' ? '좋아요 표시한 곡에 추가하기' : uiLanguage === 'JA' ? 'いいねに追加' : 'Add to Liked Songs'}</span>
              </>
            )}
          </button>

          {/* 재생목록에 추가하기 */}
          <button
            onClick={addToQueue}
            className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
          >
            <ListMusic className="w-4 h-4" />
            <span>{uiLanguage === 'KO' ? '재생목록에 추가하기' : uiLanguage === 'JA' ? 'キューに追加' : 'Add to queue'}</span>
          </button>

          <div className="border-b border-zinc-800 my-0.5 mx-2"></div>

          {/* 앨범 보러가기 */}
          <button
            onClick={handleGoToAlbum}
            className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
          >
            <Disc3 className="w-4 h-4" />
            <span>{uiLanguage === 'KO' ? '앨범 보러가기' : uiLanguage === 'JA' ? 'アルバムを見る' : 'Go to album'}</span>
          </button>

          {/* 크레딧 보기 (Optional) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onShowCredits) {
                onShowCredits()
              } else {
                alert(uiLanguage === 'KO' ? '크레딧 기능은 준비중입니다.' : 'Credits feature coming soon.')
              }
              setShowDropdown(false)
            }}
            className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
          >
            <Info className="w-4 h-4" />
            <span>{uiLanguage === 'KO' ? '크레딧 보기' : uiLanguage === 'JA' ? 'クレジットを見る' : 'Show credits'}</span>
          </button>

          {/* 공유 */}
          <button
            onClick={handleShare}
            className="w-full text-left px-3 py-2.5 rounded hover:bg-white/10 hover:text-white flex items-center gap-2 cursor-pointer text-zinc-200"
          >
            <Share2 className="w-4 h-4" />
            <span>{uiLanguage === 'KO' ? '공유 (주소 복사)' : uiLanguage === 'JA' ? '共有' : 'Share'}</span>
          </button>

        </div>
      )}
    </div>
  )
}
