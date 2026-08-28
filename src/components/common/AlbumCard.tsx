'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Album } from '@/types/music'
import { Heart, Library, Music, Play } from 'lucide-react'

interface AlbumCardProps {
  album: Album
  variant?: 'home' | 'grid' | 'library'
  rank?: number // Optional rank index (e.g. 1, 2, 3...)
}

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

export function AlbumCard({ album, variant = 'grid', rank }: AlbumCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [uiLanguage, setUiLanguage] = useState('KO')

  const checkLikedStatus = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_liked_albums')
      if (stored) {
        try {
          const list = JSON.parse(stored)
          setIsLiked(list.includes(album.id))
        } catch (e) {
          console.error(e)
        }
      } else {
        setIsLiked(false)
      }
    }
  }

  useEffect(() => {
    checkLikedStatus()

    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('language')
      if (storedLang) {
        setUiLanguage(storedLang.toUpperCase())
      }
    }

    window.addEventListener('storage', checkLikedStatus)
    window.addEventListener('albumLikedChange', checkLikedStatus)

    return () => {
      window.removeEventListener('storage', checkLikedStatus)
      window.removeEventListener('albumLikedChange', checkLikedStatus)
    }
  }, [album.id])

  const handleLikeToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('user_liked_albums')
    let list: string[] = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (err) {
        console.error(err)
      }
    }

    let next: string[]
    if (list.includes(album.id)) {
      next = list.filter((id) => id !== album.id)
      setIsLiked(false)
    } else {
      next = [...list, album.id]
      setIsLiked(true)
    }
    localStorage.setItem('user_liked_albums', JSON.stringify(next))
    
    // Dispatch events to notify other AlbumCard instances
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('albumLikedChange'))
  }

  if (variant === 'home') {
    const playCount = album.total_plays || (album.id.startsWith('album-') ? (album.title.length * 850 + 1200) : 0)
    const likeCount = album.total_likes || (album.id.startsWith('album-') ? (album.title.length * 35 + 80) : 0)

    return (
      <div className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)] flex flex-col justify-between group transition-all duration-300">
        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-white/5">
          <Link 
            href={`/albums/${album.slug || album.id}`} 
            className="block w-full h-full cursor-pointer z-10"
          >
            {album.cover_url ? (
              <img
                src={album.cover_url}
                alt={album.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
              />
            ) : (
              <Library className="w-8 h-8 text-on-surface-variant/40" />
            )}
          </Link>

          {/* Badge top-left */}
          {rank !== undefined ? (
            <span className="absolute top-2.5 left-2.5 text-[9px] font-black px-2 py-0.5 rounded bg-primary text-[#070709] tracking-wider scale-95 z-20 shadow-md">
              {rank}위
            </span>
          ) : (
            <span className="absolute top-2.5 left-2.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-[#070709] uppercase tracking-wider scale-90 z-20">
              {uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'ALBUM'}
            </span>
          )}
          
          {/* Floating Circular Heart Button on Hover */}
          <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <button
              onClick={handleLikeToggle}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                isLiked
                  ? 'bg-primary text-[#090909]'
                  : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
              }`}
              title="앨범 좋아요"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Bottom Text Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end pt-8 z-10 pointer-events-none">
            <p className="font-bold text-xs text-white truncate">
              {album.title}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-300 font-semibold mt-1 font-mono">
              <span className="flex items-center gap-0.5">
                <Play className="w-2.5 h-2.5 text-zinc-300 fill-current" />
                {formatCount(playCount)}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="flex items-center gap-0.5">
                <Heart className={`w-2.5 h-2.5 text-zinc-350 ${isLiked ? 'fill-current text-primary' : ''}`} />
                <span>{formatCount(likeCount + (isLiked ? 1 : 0))}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'library') {
    const isDefaultCover = !album.cover_url || album.cover_url.includes('default-album') || album.cover_url.includes('top100_cover')

    return (
      <Link href={`/albums/${album.id}`} className="group cursor-pointer">
        <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-lg bg-surface-container relative group">
          {isDefaultCover ? (
            <div className="absolute inset-0 w-full h-full z-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-black transition-transform duration-500 group-hover:scale-105">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 scale-150"></div>
              <Music className="w-10 h-10 text-primary filter drop-shadow-[0_0_15px_rgba(255,45,143,0.5)] z-0 transform group-hover:scale-110 transition-transform duration-500" />
            </div>
          ) : (
            <img 
              src={album.cover_url!} 
              alt={album.title}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-0 relative"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity z-10 pointer-events-none"></div>
          <div className="absolute bottom-3 left-3 right-3 text-left">
            <p className="font-bold text-white text-sm truncate">{album.title}</p>
            {album.genres && album.genres.length > 0 && <p className="text-[10px] text-emerald-400 mt-0.5">{album.genres[0]}</p>}
          </div>
          
          {/* Floating/Visible Heart button */}
          <div className="absolute top-2 right-2 z-20">
             <button
               onClick={handleLikeToggle}
               className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                 isLiked
                   ? 'bg-primary text-[#090909]'
                   : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
               }`}
             >
               <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
             </button>
          </div>
        </div>
      </Link>
    )
  }

  // Default: variant === 'grid'
  return (
    <div className="group relative">
      <Link
        href={`/albums/${album.slug || album.id}`}
        className="bg-surface-container-low border border-outline-variant/10 hover:border-primary/30 hover:bg-white/[0.01] p-4 rounded-2xl flex flex-col justify-between group shadow-lg transition-all duration-300 cursor-pointer h-full"
      >
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-outline-variant/20">
          {album.cover_url ? (
            <img
              src={album.cover_url}
              alt={album.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
            />
          ) : (
            <Library className="w-8 h-8 text-zinc-700" />
          )}

          {/* Floating Circular Heart Button on Hover */}
          <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <button
              onClick={handleLikeToggle}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                isLiked
                  ? 'bg-primary text-[#090909]'
                  : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
              }`}
              title="앨범 좋아요"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
        <div className="pt-3 min-w-0">
          <p className="font-bold text-xs truncate text-on-surface group-hover:text-primary transition-colors">{album.title}</p>
          <p className="text-[10px] text-on-surface-variant/60 truncate mt-0.5 font-bold">
            {album.artist?.name || 'Unknown Artist'}
          </p>
        </div>
      </Link>
    </div>
  )
}
