'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Track, Album, Artist } from '@/types/music'
import { 
  Play, Pause, Heart, Library, Users, Disc, 
  ChevronRight, ChevronLeft, Music, TrendingUp, 
  MoreVertical, X, MessageSquare
} from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'

interface HomeClientProps {
  initialTracks: Track[]
  initialAlbums: Album[]
  initialPopularAlbums?: Album[]
  initialArtists: Artist[]
  initialUserLikes: string[]
  initialRecommendedTracks?: Track[]
  initialLatestTracks?: Track[]
}

// Premium fallback dummy artists
const DUMMY_ARTISTS = [
  {
    id: 'artist-1',
    name: 'Machines Of Loving Grace',
    slug: 'lovinggrace',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    bio: 'Machines Of Loving Grace creates high contrast synth experiences.',
    created_at: '',
    followers: 1200000
  },
  {
    id: 'artist-2',
    name: 'Dream Relic',
    slug: 'dreamrelic',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
    bio: 'Dream Relic designs ethereal indie-electronica melodies.',
    created_at: '',
    followers: 1150000
  },
  {
    id: 'artist-3',
    name: 'PHELIPE',
    slug: 'phelipe',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop',
    bio: 'PHELIPE blends classical ambient with modern lo-fi.',
    created_at: '',
    followers: 342109
  },
  {
    id: 'artist-4',
    name: 'Lofn AI',
    slug: 'lofn_ai',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
    bio: 'Lofn AI explores artificial soundscapes and deep acoustics.',
    created_at: '',
    followers: 289551
  },
  {
    id: 'artist-5',
    name: 'Krheâzee',
    slug: 'krheazee',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop',
    bio: 'Krheâzee produces experimental glitch art and lo-fi beats.',
    created_at: '',
    followers: 158003
  }
]

// Premium fallback dummy tracks (for general display)
const DUMMY_TRACKS = [
  {
    id: 'dummy-1',
    title: 'Have you seen my baby',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 222,
    like_count: 342109,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-1',
    album: {
      id: 'dummy-album-1',
      title: 'Have you seen my baby',
      cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-1',
      artist: DUMMY_ARTISTS[0]
    }
  },
  {
    id: 'dummy-2',
    title: 'Cosmic Déjà Vu',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 255,
    like_count: 289551,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-2',
    album: {
      id: 'dummy-album-2',
      title: 'Cosmic Déjà Vu',
      cover_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'artist-2',
      artist: DUMMY_ARTISTS[1]
    }
  },
  {
    id: 'dummy-3',
    title: 'Out Yo Head - Remix',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 198,
    like_count: 158003,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-3',
    album: {
      id: 'dummy-album-3',
      title: 'Out Yo Head - Remix',
      cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'artist-3',
      artist: DUMMY_ARTISTS[2]
    }
  },
  {
    id: 'dummy-4',
    title: 'The Questions',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 301,
    like_count: 102994,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-4',
    album: {
      id: 'dummy-album-4',
      title: 'The Questions',
      cover_url: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-4',
      artist: DUMMY_ARTISTS[3]
    }
  },
  {
    id: 'dummy-5',
    title: 'R u still there',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration_sec: 235,
    like_count: 94332,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-5',
    album: {
      id: 'dummy-album-5',
      title: 'R u still there',
      cover_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'artist-5',
      artist: DUMMY_ARTISTS[4]
    }
  }
]

// Premium fallback dummy recommended tracks
const DUMMY_RECOMMENDED_BASE_TRACKS = [
  {
    id: 'dummy-rec-1',
    title: 'IT\'S LIKE, HOMETOWN...',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 215,
    like_count: 245100,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-6',
    album: {
      id: 'dummy-album-6',
      title: 'IT\'S LIKE, HOMETOWN...',
      cover_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-3',
      artist: DUMMY_ARTISTS[2]
    }
  },
  {
    id: 'dummy-rec-2',
    title: 'Triple Arch Over Me',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 278,
    like_count: 198200,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-7',
    album: {
      id: 'dummy-album-7',
      title: 'Triple Arch Over Me',
      cover_url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-4',
      artist: DUMMY_ARTISTS[3]
    }
  },
  {
    id: 'dummy-rec-3',
    title: 'cinnamon sugar butter baby',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration_sec: 192,
    like_count: 145900,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-8',
    album: {
      id: 'dummy-album-8',
      title: 'cinnamon sugar butter baby',
      cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'artist-5',
      artist: DUMMY_ARTISTS[4]
    }
  },
  {
    id: 'dummy-rec-4',
    title: 'Never Looking Back',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 204,
    like_count: 132400,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-9',
    album: {
      id: 'dummy-album-9',
      title: 'Never Looking Back',
      cover_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-5',
      artist: DUMMY_ARTISTS[4]
    }
  },
  {
    id: 'dummy-rec-5',
    title: 'Come Talk To Me',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 250,
    like_count: 98100,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-10',
    album: {
      id: 'dummy-album-10',
      title: 'Come Talk To Me',
      cover_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'single',
      status: 'published',
      created_at: '',
      artist_id: 'artist-1',
      artist: DUMMY_ARTISTS[0]
    }
  }
]

// Premium fallback dummy latest tracks
const DUMMY_LATEST_BASE_TRACKS = [
  {
    id: 'dummy-lat-1',
    title: 'Boom!',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    duration_sec: 185,
    like_count: 220300,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-rec-1',
    album: {
      id: 'dummy-album-rec-1',
      title: 'Boom!',
      cover_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-2',
      artist: DUMMY_ARTISTS[1]
    }
  },
  {
    id: 'dummy-lat-2',
    title: 'American Graffiti',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    duration_sec: 242,
    like_count: 175400,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-rec-2',
    album: {
      id: 'dummy-album-rec-2',
      title: 'American Graffiti',
      cover_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-1',
      artist: DUMMY_ARTISTS[0]
    }
  },
  {
    id: 'dummy-lat-3',
    title: 'What We Lose If We Try',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration_sec: 210,
    like_count: 135800,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-rec-3',
    album: {
      id: 'dummy-album-rec-3',
      title: 'What We Lose If We Try',
      cover_url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'ep',
      status: 'published',
      created_at: '',
      artist_id: 'artist-2',
      artist: DUMMY_ARTISTS[1]
    }
  },
  {
    id: 'dummy-lat-4',
    title: 'WE ROLLIN\'',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration_sec: 198,
    like_count: 122100,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-rec-4',
    album: {
      id: 'dummy-album-rec-4',
      title: 'WE ROLLIN\'',
      cover_url: 'https://images.unsplash.com/photo-1552422535-c45813c61732?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-3',
      artist: DUMMY_ARTISTS[2]
    }
  },
  {
    id: 'dummy-lat-5',
    title: 'Mastery',
    file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration_sec: 228,
    like_count: 89400,
    status: 'published',
    created_at: '',
    album_id: 'dummy-album-rec-5',
    album: {
      id: 'dummy-album-rec-5',
      title: 'Mastery',
      cover_url: 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?auto=format&fit=crop&w=350&h=350&q=80',
      release_type: 'lp',
      status: 'published',
      created_at: '',
      artist_id: 'artist-4',
      artist: DUMMY_ARTISTS[3]
    }
  }
]

// Premium fallback dummy albums
const DUMMY_ALBUMS = [
  {
    id: 'album-1',
    title: 'Have you seen my baby',
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-1',
    artist: DUMMY_ARTISTS[0]
  },
  {
    id: 'album-2',
    title: 'Cosmic Déjà Vu',
    cover_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'single',
    status: 'published',
    created_at: '',
    artist_id: 'artist-2',
    artist: DUMMY_ARTISTS[1]
  },
  {
    id: 'album-3',
    title: 'Out Yo Head - Remix',
    cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'ep',
    status: 'published',
    created_at: '',
    artist_id: 'artist-3',
    artist: DUMMY_ARTISTS[2]
  },
  {
    id: 'album-4',
    title: 'The Questions',
    cover_url: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-4',
    artist: DUMMY_ARTISTS[3]
  },
  {
    id: 'album-5',
    title: 'R u still there',
    cover_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'single',
    status: 'published',
    created_at: '',
    artist_id: 'artist-5',
    artist: DUMMY_ARTISTS[4]
  },
  {
    id: 'album-6',
    title: 'IT\'S LIKE, HOMETOWN...',
    cover_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-3',
    artist: DUMMY_ARTISTS[2]
  },
  {
    id: 'album-7',
    title: 'Triple Arch Over Me',
    cover_url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-4',
    artist: DUMMY_ARTISTS[3]
  },
  {
    id: 'album-8',
    title: 'cinnamon sugar butter baby',
    cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'ep',
    status: 'published',
    created_at: '',
    artist_id: 'artist-5',
    artist: DUMMY_ARTISTS[4]
  },
  {
    id: 'album-9',
    title: 'Never Looking Back',
    cover_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-5',
    artist: DUMMY_ARTISTS[4]
  },
  {
    id: 'album-10',
    title: 'Come Talk To Me',
    cover_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'single',
    status: 'published',
    created_at: '',
    artist_id: 'artist-1',
    artist: DUMMY_ARTISTS[0]
  },
  {
    id: 'album-11',
    title: 'What We Lose If We Try',
    cover_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'ep',
    status: 'published',
    created_at: '',
    artist_id: 'artist-2',
    artist: DUMMY_ARTISTS[1]
  },
  {
    id: 'album-12',
    title: 'WE ROLLIN\'',
    cover_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=350&h=350&q=80',
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'artist-3',
    artist: DUMMY_ARTISTS[2]
  }
]

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

const generateDummyTracks = (baseTracks: typeof DUMMY_TRACKS, count: number): Track[] => {
  const list: Track[] = []
  for (let i = 0; i < count; i++) {
    const base = baseTracks[i % baseTracks.length]
    list.push({
      ...base,
      id: `dummy-track-${i + 1}`,
      title: `${base.title} #${Math.floor(i / baseTracks.length) + 1}`,
      play_count: base.like_count * 5 + i * 100,
      like_count: base.like_count + i * 10,
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    } as any)
  }
  return list
}

interface CarouselProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  containerClassName?: string
}

function Carousel({ items, renderItem, containerClassName }: CarouselProps<any>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
      setShowLeftArrow(scrollLeft > 10)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      checkScroll()
      
      // Re-check scroll multiple times to handle dynamic content/font rendering layout updates
      const t1 = setTimeout(checkScroll, 100)
      const t2 = setTimeout(checkScroll, 500)
      const t3 = setTimeout(checkScroll, 1000)
      
      return () => {
        el.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [items])

  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const { clientWidth } = containerRef.current
      const isGrid = containerClassName?.includes('grid')
      // For grid layouts, scroll by 100% of client width to scroll a full page, otherwise 85%
      const scrollAmount = direction === 'left' 
        ? -(isGrid ? clientWidth : clientWidth * 0.85) 
        : (isGrid ? clientWidth : clientWidth * 0.85)
      containerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="relative group/carousel">
      {/* Left Arrow Button */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute -left-2 md:-left-5 top-1/2 -translate-y-1/2 z-20 bg-[#121214]/80 hover:bg-[#1f1f23] border border-white/5 text-white rounded-full p-2 md:p-2.5 shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5px]" />
        </button>
      )}

      {/* Scrollable Row */}
      <div
        ref={containerRef}
        className={containerClassName || "flex gap-6 overflow-x-auto scrollbar-none scroll-smooth pb-4"}
      >
        {items.map((item, index) => renderItem(item, index))}
      </div>

      {/* Right Arrow Button */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute -right-2 md:-right-5 top-1/2 -translate-y-1/2 z-20 bg-[#121214]/80 hover:bg-[#1f1f23] border border-white/5 text-white rounded-full p-2 md:p-2.5 shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5px]" />
        </button>
      )}
    </div>
  )
}

export function HomeClient({
  initialTracks,
  initialAlbums,
  initialPopularAlbums = [],
  initialArtists,
  initialUserLikes,
  initialRecommendedTracks = [],
  initialLatestTracks = []
}: HomeClientProps) {
  const displayTracks = (initialTracks.length > 0 ? initialTracks : DUMMY_TRACKS) as Track[]
  const initialMergedArtists = (() => {
    const merged = [...initialArtists]
    DUMMY_ARTISTS.forEach((dummy) => {
      if (!merged.some((a) => a.slug === dummy.slug)) {
        merged.push({ ...dummy, is_user: false } as any)
      }
    })
    return merged.sort((a, b) => {
      const isUserA = !!a.is_user
      const isUserB = !!b.is_user
      if (isUserA !== isUserB) {
        return isUserA ? -1 : 1
      }
      return (b.followers || 0) - (a.followers || 0)
    })
  })()
  const displayAlbums = (initialAlbums.length > 0 ? initialAlbums : DUMMY_ALBUMS) as Album[]
  const displayPopularAlbums = (initialPopularAlbums.length > 0 ? initialPopularAlbums : DUMMY_ALBUMS) as Album[]

  const displayRecommendedTracks = (() => {
    if (initialRecommendedTracks.length >= 12) {
      return initialRecommendedTracks
    }
    const dummies = generateDummyTracks(DUMMY_RECOMMENDED_BASE_TRACKS, 12 - initialRecommendedTracks.length)
    return [...initialRecommendedTracks, ...dummies]
  })() as Track[]

  const displayLatestTracks = (initialLatestTracks.length > 0
    ? initialLatestTracks
    : generateDummyTracks(DUMMY_LATEST_BASE_TRACKS, 10)) as Track[]

  const [tracks, setTracks] = useState<Track[]>(displayTracks)
  const isRealTrack = (track: any) => {
    if (!track) return false
    const id = (track.id || '').toLowerCase()
    if (id.startsWith('mock-') || id.startsWith('dummy-')) return false
    const artistSlug = (track.album?.artist?.slug || '').toLowerCase()
    if (artistSlug.startsWith('mock-') || artistSlug === 'neonecho') return false
    return true
  }

  const sortedTracks = [...tracks].sort((a, b) => {
    const isRealA = isRealTrack(a)
    const isRealB = isRealTrack(b)

    if (isRealA !== isRealB) {
      return isRealA ? -1 : 1
    }

    const playA = a.play_count || 0
    const playB = b.play_count || 0
    const likeA = a.like_count || 0
    const likeB = b.like_count || 0
    
    const scoreA = playA + likeA
    const scoreB = playB + likeB
    
    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }
    const rankA = (a as any).rank || 999
    const rankB = (b as any).rank || 999
    return rankA - rankB
  })

  const [artists, setArtists] = useState<Artist[]>(initialMergedArtists)
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [likedAlbums, setLikedAlbums] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_liked_albums')
      if (stored) {
        try {
          setLikedAlbums(JSON.parse(stored))
        } catch (e) {
          console.error(e)
        }
      }
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
  }

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

  useEffect(() => {
    const syncUserFollowers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const extra = localStorage.getItem(`profile-extra-${user.id}`)
          if (extra) {
            const parsed = JSON.parse(extra)
            if (parsed.followers !== undefined) {
              setArtists((prevArtists) => {
                const updated = prevArtists.map((artist) => {
                  if (artist.id === user.id) {
                    return {
                      ...artist,
                      followers: parsed.followers
                    }
                  }
                  return artist
                })
                return [...updated].sort((a, b) => {
                  const isUserA = !!a.is_user
                  const isUserB = !!b.is_user
                  if (isUserA !== isUserB) {
                    return isUserA ? -1 : 1
                  }
                  return (b.followers || 0) - (a.followers || 0)
                })
              })
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    syncUserFollowers()
  }, [])
  
  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
  const supabase = createClient()

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

  const handlePlay = async (track: Track, playlist: Track[] = tracks) => {
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.id.startsWith('dummy-') || track.file_url.startsWith('http')) {
      playTrack(track, playlist)
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
      playTrack(signedTrack, playlist)
    } catch (err) {
      console.error(err)
      alert('음원 재생 주소를 발급받지 못했습니다.')
    }
  }

  return (
    <div className="font-sans text-on-surface w-full">
      
      {/* Hero Banner (Edge-to-Edge) */}
      <section className="-mx-[32px] -mt-[24px] relative h-[25vh] min-h-[220px] md:h-[30vh] overflow-hidden bg-[#0e150e] flex flex-col justify-end animate-fade-in">
        {/* Background Pop Artist Image */}
        <div className="absolute inset-0 select-none">
          <img 
            src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&h=500&q=80" 
            alt="" 
            className="w-full h-full object-cover grayscale opacity-50 brightness-[0.7]"
          />
          {/* Smooth gradients to blend image into the forest green-black background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e150e] via-[#0e150e]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e150e]/50 via-transparent to-transparent" />
        </div>

        {/* Content Container (Aligned with main contents below) */}
        <div className="max-w-7xl mx-auto w-full px-[32px] pb-6 md:pb-8 space-y-3 relative z-10 animate-fade-in-up animation-delay-75">
          <span className="inline-flex items-center gap-1.5 text-[8px] font-extrabold bg-[#e3fe06]/10 border border-[#e3fe06]/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider w-fit">
            <TrendingUp className="w-2.5 h-2.5" />
            Trending AI Hits
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-white drop-shadow-md">
            Listen to the Next Era of Melody
          </h2>
          <p className="text-[10px] md:text-xs text-zinc-300 max-w-xl leading-relaxed font-semibold drop-shadow-sm">
            인공지능으로 창작된 수많은 트랙들과 제작 시 사용된 프롬프트, 가사 메타데이터를 확인해보세요.
          </p>
          <div className="pt-1">
            <Link
              href="/charts"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-[#080d08] hover:bg-[#e3fe06] font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              차트 순위 보러가기
              <ChevronRight className="w-3.5 h-3.5 text-black stroke-[3px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-12 animate-fade-in-up animation-delay-150">
        {/* 인기 음원 & 최신 앨범 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* 실시간 인기곡 탑 5 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
              <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                <Play className="w-2.5 h-2.5 text-primary fill-current" />
              </span>
              실시간 인기 트랙
            </h2>
            <Link href="/charts" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
              차트 전체보기
            </Link>
          </div>

          <div className="space-y-1.5">
            {sortedTracks.slice(0, 5).map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id
              const playCount = track.play_count || 0;
              return (
                <div key={track.id} className={`py-3 flex items-center justify-between group hover:bg-white/[0.05] px-3.5 rounded-xl transition-all duration-200 ${isCurrent ? 'bg-primary/15' : ''}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-mono text-xs font-bold text-on-surface-variant/50 w-4 text-center">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => {
                        handlePlay(track, sortedTracks)
                        setNowPlayingOpen(true)
                      }}
                      className="w-14 h-14 bg-surface-container-lowest border border-outline-variant/10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative cursor-pointer"
                    >
                      {track.album?.cover_url ? (
                        <img src={track.album.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-5 h-5 text-on-surface-variant/40" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        {isCurrent && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current text-primary" />
                        ) : (
                          <Play className="w-5 h-5 fill-current text-white" />
                        )}
                      </div>
                    </button>
                    <div className="min-w-0">
                      <p 
                        onClick={() => {
                          handlePlay(track, sortedTracks)
                          setNowPlayingOpen(true)
                        }}
                        className={`font-bold text-xs truncate transition-colors cursor-pointer hover:underline ${isCurrent ? 'text-primary' : 'text-on-surface group-hover:text-white'}`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate mt-0.5 font-medium">{track.album?.artist?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <button
                      onClick={() => handleLikeToggle(track.id)}
                      className="text-on-surface-variant/60 hover:text-primary transition-colors p-1"
                    >
                      <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                    </button>
                    <span className="text-[11px] font-mono text-on-surface-variant w-24 text-right">
                      {playCount.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant/60 font-bold w-10 text-right">
                      {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* AI 아티스트 */}
        <div className="space-y-6">
          <div className="pb-2">
            <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
              <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                <Users className="w-2.5 h-2.5 text-primary" />
              </span>
              주목받는 AI 아티스트
            </h2>
          </div>

          <div className="space-y-2.5">
            {artists.slice(0, 6).map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.slug}`}
                className="flex items-center gap-3.5 p-2.5 bg-white/[0.01] border border-outline-variant/5 hover:border-outline-variant/30 hover:bg-white/[0.04] rounded-xl transition-all duration-200 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center shrink-0">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Users className="w-4 h-4 text-on-surface-variant/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs truncate text-on-surface group-hover:text-white transition-colors">{artist.name}</p>
                  <p className="text-[9px] text-primary/70 font-mono truncate mt-0.5 font-bold">@{artist.slug}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* 인기 앨범 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-300">
        <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
          <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
            <TrendingUp className="w-2.5 h-2.5 text-primary" />
          </span>
          {uiLanguage === 'KO' ? '인기 앨범' : 'Popular Albums'}
        </h2>

        <Carousel
          items={displayPopularAlbums.slice(0, 10)}
          renderItem={(album, index) => {
            const playCount = album.total_plays || (album.id.startsWith('album-') ? (album.title.length * 850 + 1200) : 0)
            const likeCount = album.total_likes || (album.id.startsWith('album-') ? (album.title.length * 35 + 80) : 0)
            return (
              <div
                key={album.id}
                className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)] flex flex-col justify-between group transition-all duration-300"
              >
                <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-white/5">
                  <Link 
                    href={`/albums/${album.slug || album.id}`} 
                    className="block w-full h-full cursor-pointer z-10"
                  >
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <Library className="w-8 h-8 text-on-surface-variant/40" />
                    )}
                  </Link>

                  {/* Rank badge top-left */}
                  <span className="absolute top-2.5 left-2.5 text-[9px] font-black px-2 py-0.5 rounded bg-primary text-[#070709] tracking-wider scale-95 z-20 shadow-md">
                    {index + 1}위
                  </span>
                  
                  {/* Floating Circular Heart Button on Hover */}
                  <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAlbumLikeToggle(album.id)
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                        likedAlbums.includes(album.id)
                          ? 'bg-primary text-[#080d08]'
                          : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
                      }`}
                      title="앨범 좋아요"
                    >
                      <Heart className={`w-4 h-4 ${likedAlbums.includes(album.id) ? 'fill-current' : ''}`} />
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
                        <Heart className={`w-2.5 h-2.5 text-zinc-300 ${likedAlbums.includes(album.id) ? 'fill-current text-primary' : ''}`} />
                        <span>{formatCount(likeCount + (likedAlbums.includes(album.id) ? 1 : 0))}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          }}
        />
      </section>

      {/* 최신 앨범 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-300">
        <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
          <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
            <Library className="w-2.5 h-2.5 text-primary" />
          </span>
          {uiLanguage === 'KO' ? '최신 앨범' : 'Latest Albums'}
        </h2>

        <Carousel
          items={displayAlbums.slice(0, 10)}
          renderItem={(album) => {
            const playCount = album.total_plays || (album.id.startsWith('album-') ? (album.title.length * 850 + 1200) : 0)
            const likeCount = album.total_likes || (album.id.startsWith('album-') ? (album.title.length * 35 + 80) : 0)
            return (
              <div
                key={album.id}
                className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)] flex flex-col justify-between group transition-all duration-300"
              >
                <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-white/5">
                  <Link 
                    href={`/albums/${album.slug || album.id}`} 
                    className="block w-full h-full cursor-pointer z-10"
                  >
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <Library className="w-8 h-8 text-on-surface-variant/40" />
                    )}
                  </Link>

                  {/* Album badge top-left */}
                  <span className="absolute top-2.5 left-2.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-[#070709] uppercase tracking-wider scale-90 z-20">
                    {uiLanguage === 'KO' ? '앨범' : 'ALBUM'}
                  </span>
                  
                  {/* Floating Circular Heart Button on Hover */}
                  <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAlbumLikeToggle(album.id)
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                        likedAlbums.includes(album.id)
                          ? 'bg-primary text-[#080d08]'
                          : 'bg-black/60 hover:bg-black/85 text-white border border-white/10'
                      }`}
                      title="앨범 좋아요"
                    >
                      <Heart className={`w-4 h-4 ${likedAlbums.includes(album.id) ? 'fill-current' : ''}`} />
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
                        <Heart className={`w-2.5 h-2.5 text-zinc-300 ${likedAlbums.includes(album.id) ? 'fill-current text-primary' : ''}`} />
                        <span>{formatCount(likeCount + (likedAlbums.includes(album.id) ? 1 : 0))}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          }}
        />
      </section>

      {/* 추천 음원 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-450">
        <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
          <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
            <Music className="w-2.5 h-2.5 text-primary" />
          </span>
          {uiLanguage === 'KO' ? '추천 음원' : 'Recommended Tracks'}
        </h2>

        <Carousel
          items={displayRecommendedTracks.slice(0, 12)}
          containerClassName="grid grid-rows-2 grid-flow-col gap-x-6 gap-y-4 overflow-x-auto scrollbar-none scroll-smooth pb-4"
          renderItem={(track) => {
            const isCurrent = currentTrack?.id === track.id
            const playCount = track.play_count || (track.id.startsWith('dummy-') ? (track.title.length * 900 + 1500) : 0)
            const likeCount = track.like_count || (track.id.startsWith('dummy-') ? (track.title.length * 40 + 90) : 0)

            const formatDuration = (sec?: number) => {
              if (!sec) return '3:00'
              const m = Math.floor(sec / 60)
              const s = (sec % 60).toString().padStart(2, '0')
              return `${m}:${s}`
            }

            return (
              <div
                key={track.id}
                className={`flex-none w-[85%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-24px)/2)] lg:w-[calc((100%-48px)/3)] p-3.5 border rounded-2xl flex items-center gap-4 transition-all duration-300 group cursor-pointer ${
                  isCurrent ? 'bg-primary/10 border-primary/30' : 'bg-[#091009]/80 border-[#1a2c1a]/50 hover:border-primary/40 hover:bg-[#111c11]/85'
                }`}
                onClick={() => {
                  handlePlay(track, displayRecommendedTracks)
                  setNowPlayingOpen(true)
                }}
              >
                {/* Album Cover */}
                <div 
                  className="relative w-[80px] h-[80px] rounded-xl overflow-hidden bg-surface-container-lowest shrink-0 border border-white/5 group/image"
                >
                  {track.album?.cover_url ? (
                    <img
                      src={track.album.cover_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <Music className="w-8 h-8 text-on-surface-variant/40" />
                  )}
                  
                  {/* Hover Control Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-all duration-300">
                    <div className="w-8 h-8 bg-primary text-[#080d08] rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover/image:scale-100 transition-all">
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <span className="absolute bottom-1 right-1.5 bg-black/70 text-[8px] font-bold text-zinc-300 px-1 py-0.2 rounded font-mono">
                    {formatDuration(track.duration_sec)}
                  </span>
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 text-left">
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-black bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider uppercase">
                      FEATURED SINGLE
                    </span>
                    <span className="text-[8px] font-bold border border-zinc-700 text-zinc-400 px-1 py-0.5 rounded uppercase tracking-wider">
                      V2.0
                    </span>
                  </div>

                  {/* Title & Artist */}
                  <div className="mt-1">
                    <p className="font-bold text-xs truncate text-slate-100 group-hover:text-primary transition-colors">
                      {track.title}
                    </p>
                    {track.album?.artist ? (
                      <div className="mt-0.5">
                        <Link
                          href={`/artists/${track.album.artist.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-zinc-400 hover:text-primary transition-colors truncate font-semibold cursor-pointer"
                        >
                          {track.album.artist.name}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400 font-semibold truncate mt-0.5">
                        K-Pop
                      </p>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1.5">
                    <span className="flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-zinc-500 fill-current" />
                      {formatCount(playCount)} Plays
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLikeToggle(track.id)
                      }}
                      className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                      title="좋아요"
                    >
                      <Heart className={`w-3.5 h-3.5 text-zinc-500 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                      <span>{formatCount(likeCount + (userLikes.includes(track.id) && !initialUserLikes.includes(track.id) ? 1 : (!userLikes.includes(track.id) && initialUserLikes.includes(track.id) ? -1 : 0)))} Likes</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          }}
        />
      </section>

      {/* 최신 음원 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-600">
        <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
          <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
            <Music className="w-2.5 h-2.5 text-primary" />
          </span>
          {uiLanguage === 'KO' ? '최신 음원' : 'Latest Tracks'}
        </h2>

        <Carousel
          items={displayLatestTracks.slice(0, 10)}
          renderItem={(track) => {
            const isCurrent = currentTrack?.id === track.id
            const playCount = track.play_count || (track.id.startsWith('dummy-') ? (track.title.length * 800 + 1100) : 0)
            const likeCount = track.like_count || (track.id.startsWith('dummy-') ? (track.title.length * 35 + 75) : 0)
            const commentCount = Math.floor(likeCount / 12) + 2

            return (
              <div
                key={track.id}
                className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)] flex flex-col justify-between group transition-all duration-300"
              >
                <div 
                  onClick={() => {
                    handlePlay(track, displayLatestTracks)
                    setNowPlayingOpen(true)
                  }}
                  className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surface-container-lowest flex items-center justify-center border border-white/5 group/image cursor-pointer"
                >
                  {track.album?.cover_url ? (
                    <img
                      src={track.album.cover_url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <Music className="w-8 h-8 text-on-surface-variant/40" />
                  )}
                  
                  {/* Hover Control Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-all duration-300">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handlePlay(track, displayLatestTracks)
                        setNowPlayingOpen(true)
                      }}
                      className="w-12 h-12 bg-primary hover:bg-[#e3fe06] text-[#080d08] rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                  
                  {/* Top Right Quick Controls */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLikeToggle(track.id)
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                      title="좋아요"
                    >
                      <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-2 min-w-0">
                  <div className="flex items-center gap-1.5 justify-between min-w-0">
                    <p 
                      onClick={() => {
                        handlePlay(track, displayLatestTracks)
                        setNowPlayingOpen(true)
                      }}
                      className="font-bold text-xs truncate text-slate-100 group-hover:text-primary transition-colors flex-1 cursor-pointer hover:underline text-left"
                    >
                      {track.title}
                    </p>
                  </div>
                  {track.album?.artist && (
                    <div className="mt-0.5">
                      <Link
                        href={`/artists/${track.album.artist.slug}`}
                        className="text-[10px] text-zinc-400 hover:text-primary transition-colors truncate font-semibold cursor-pointer"
                      >
                        {track.album.artist.name}
                      </Link>
                    </div>
                  )}
                  
                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1.5">
                    <span className="flex items-center gap-0.5">
                      <Play className="w-2.5 h-2.5 text-zinc-500 fill-current" />
                      {formatCount(playCount)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className={`w-2.5 h-2.5 text-zinc-500 ${userLikes.includes(track.id) ? 'fill-current text-primary' : ''}`} />
                      <span>{formatCount(likeCount + (userLikes.includes(track.id) && !initialUserLikes.includes(track.id) ? 1 : (!userLikes.includes(track.id) && initialUserLikes.includes(track.id) ? -1 : 0)))}</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          }}
        />
      </section>

      {/* TOP 카테고리 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-750 pb-10">
        <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
          <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
            <Disc className="w-2.5 h-2.5 text-primary" />
          </span>
          {uiLanguage === 'KO' ? '인기 카테고리' : 'TOP Categories'}
        </h2>

        <Carousel
          items={[
            { name: 'K-Pop', koName: '케이팝', gradient: 'from-pink-600/20 to-fuchsia-600/20 hover:border-pink-500/40 text-pink-300' },
            { name: 'Pop', koName: '팝', gradient: 'from-emerald-600/20 to-teal-600/20 hover:border-emerald-500/40 text-emerald-300' },
            { name: 'Hip Hop', koName: '힙합', gradient: 'from-amber-600/20 to-orange-600/20 hover:border-amber-500/40 text-amber-300' },
            { name: 'R&B', koName: '알앤비', gradient: 'from-rose-600/20 to-red-600/20 hover:border-rose-500/40 text-rose-300' },
            { name: 'Electronic', koName: '일렉트로닉', gradient: 'from-cyan-600/20 to-blue-600/20 hover:border-cyan-500/40 text-cyan-300' },
            { name: 'Rock', koName: '락', gradient: 'from-red-700/20 to-stone-800/20 hover:border-red-500/40 text-red-300' },
            { name: 'Jazz', koName: '재즈', gradient: 'from-indigo-600/20 to-violet-600/20 hover:border-indigo-500/40 text-indigo-300' },
            { name: 'Classical', koName: '클래식', gradient: 'from-slate-600/20 to-zinc-700/20 hover:border-slate-500/40 text-zinc-300' },
            { name: 'J-Pop', koName: '제이팝', gradient: 'from-sky-600/20 to-indigo-600/20 hover:border-sky-500/40 text-sky-300' },
            { name: 'Gospel', koName: '가스펠', gradient: 'from-yellow-600/20 to-amber-700/20 hover:border-yellow-500/40 text-yellow-300' },
            { name: 'Country', koName: '컨트리', gradient: 'from-amber-700/20 to-yellow-800/20 hover:border-amber-600/40 text-amber-400' },
            { name: 'Latin', koName: '라틴', gradient: 'from-orange-600/20 to-red-500/20 hover:border-orange-500/40 text-orange-300' },
            { name: 'Afrobeats', koName: '아프로비트', gradient: 'from-yellow-500/20 to-red-600/20 hover:border-yellow-400/40 text-yellow-200' },
            { name: 'Folk', koName: '포크', gradient: 'from-green-700/20 to-emerald-800/20 hover:border-green-600/40 text-green-300' },
            { name: 'Blues', koName: '블루스', gradient: 'from-blue-800/20 to-indigo-900/20 hover:border-blue-700/40 text-blue-300' },
            { name: 'House', koName: '하우스', gradient: 'from-purple-600/20 to-pink-700/20 hover:border-purple-500/40 text-purple-300' },
            { name: 'Punk', koName: '펑크락', gradient: 'from-red-600/20 to-orange-700/20 hover:border-red-500/40 text-red-300' },
            { name: 'Dance', koName: '댄스', gradient: 'from-fuchsia-500/20 to-rose-600/20 hover:border-fuchsia-400/40 text-fuchsia-200' },
            { name: 'Reggae', koName: '레게', gradient: 'from-green-600/20 to-yellow-600/20 hover:border-green-500/40 text-green-200' },
            { name: 'Metal', koName: '메탈', gradient: 'from-zinc-700/20 to-neutral-900/20 hover:border-zinc-500/40 text-zinc-400' },
            { name: 'Soundtrack', koName: '사운드트랙', gradient: 'from-violet-700/20 to-fuchsia-900/20 hover:border-violet-600/40 text-violet-300' },
            { name: 'Ambient', koName: '엠비언트', gradient: 'from-teal-700/20 to-cyan-800/20 hover:border-teal-600/40 text-teal-300' },
            { name: 'Chill', koName: '칠아웃', gradient: 'from-blue-600/20 to-teal-600/20 hover:border-blue-500/40 text-blue-200' }
          ]}
          renderItem={(cat) => (
            <div 
              key={cat.name} 
              className="flex-none w-[45%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/4)] lg:w-[calc((100%-168px)/8)] transition-all duration-300"
            >
              <Link
                href={`/charts?genre=${cat.name}`}
                className={`relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br ${cat.gradient} p-5 flex flex-col justify-between aspect-square hover:scale-[1.03] hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition-all duration-300 cursor-pointer group w-full`}
              >
                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-300">
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <Disc className="w-8 h-8 opacity-20 group-hover:opacity-40 group-hover:rotate-[360deg] transition-all duration-1000" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-white group-hover:text-primary transition-colors">
                    {uiLanguage === 'KO' ? cat.koName : cat.name}
                  </p>
                  <p className="text-[9px] font-mono text-zinc-400 mt-0.5 tracking-wider uppercase">
                    {cat.name}
                  </p>
                </div>
              </Link>
            </div>
          )}
        />
      </section>

      </div>

    </div>
  )
}
