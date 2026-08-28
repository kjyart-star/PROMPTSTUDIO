'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Track, Album, Artist } from '@/types/music'
import { 
  Play, Pause, Heart, Library, Users, Disc, 
  ChevronRight, ChevronLeft, Music, TrendingUp, 
  MoreVertical, X, MessageSquare, ListPlus
} from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { TrackDropdown } from '@/components/common/TrackDropdown'
import { AudioDuration } from '@/components/player/AudioDuration'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription } from '@/lib/utils'
import { AlbumCard } from '@/components/common/AlbumCard'
import { withBase } from '@/lib/basePath'
import { GenreCard } from '@/components/common/GenreCard'
import { GENRES } from '@/lib/constants'

// 메인 「인기 카테고리」 줄 — 개수와 순서는 종전 그대로, 카드 생김새만 「모두 둘러보기」와 한 벌로 쓴다.
const HOME_CATEGORY_NAMES = [
  'K-Pop',
  'Pop',
  'Hip Hop',
  'R&B',
  'Electronic',
  'Rock',
  'Jazz',
  'Classical',
  'J-Pop',
  'Gospel',
  'Country',
  'Latin',
  'Afrobeats',
  'Folk',
  'Blues',
  'House',
  'Punk',
  'Dance',
  'Reggae',
  'Metal',
  'Soundtrack',
  'Ambient',
  'Chill',
]
const HOME_CATEGORIES = HOME_CATEGORY_NAMES
  .map((name) => GENRES.find((g) => g.name === name))
  .filter((g): g is (typeof GENRES)[number] => !!g)

interface HomeClientProps {
  initialTracks: Track[]
  initialAlbums: Album[]
  initialPopularAlbums?: Album[]
  initialArtists: Artist[]
  initialUserLikes: string[]
  initialRecommendedTracks?: Track[]
  initialLatestTracks?: Track[]
}

// 아티스트 구역의 목표 슬롯 수. 실제 아티스트로 먼저 채우고 남는 칸만 자리 표시로 메운다.
// 아티스트가 늘어나면 자리 표시가 하나씩 저절로 사라지고, 이 값을 0 으로 두면 기능이 꺼진다.
const ARTIST_SLOTS = 6
const ALBUM_SLOTS = 6

// 앨범 자리 표시용 자켓 (가상 인물, 제목·로고 없음). 순서대로 돌려 쓴다.
const PLACEHOLDER_COVERS = [
  '/images/placeholder/album-1.jpg',
  '/images/placeholder/album-2.jpg',
  '/images/placeholder/album-3.jpg',
  '/images/placeholder/album-4.jpg'
]

// 'K-Pop' · 'k pop' · '케이팝' 처럼 표기만 다른 장르를 같은 키로 본다

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

// 아직 콘텐츠가 없는 자리를 메우는 카드. 아티스트(원형)·앨범(커버) 두 구역이 함께 쓴다.
// 실제 데이터가 늘면 호출부에서 개수를 줄여 하나씩 사라진다.
function PlaceholderSlot({
  shape,
  uiLanguage,
  onClick,
  index = 0,
  className = ''
}: {
  shape: 'circle' | 'cover'
  uiLanguage: string
  onClick: () => void
  index?: number
  className?: string
}) {
  const isCircle = shape === 'circle'
  const ariaLabel = uiLanguage === 'KO' ? '준비 중인 자리' : uiLanguage === 'JA' ? '準備中の枠' : 'Slot in preparation'
  const label = isCircle
    ? (uiLanguage === 'KO' ? '자리 준비 중' : uiLanguage === 'JA' ? '準備中' : 'Open spot')
    : (uiLanguage === 'KO' ? '준비 중' : uiLanguage === 'JA' ? '準備中' : 'Coming up')

  if (!isCircle) {
    // 앨범 자리 — 실제 목록처럼 보이도록 준비된 자켓을 쓰고, 제목 자리에는 담담한 한 줄만 둔다
    const cover = PLACEHOLDER_COVERS[index % PLACEHOLDER_COVERS.length]
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className={`flex flex-col group transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-variant rounded-2xl ${className}`}
      >
        <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden bg-surface-container-lowest border border-white/5">
          <img src={withBase(cover)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-x-0 bottom-0 p-3 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-left">
            <p className="font-bold text-xs text-white/70 truncate">{label}</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex flex-col items-center text-center gap-3 rounded-xl transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-variant p-4 bg-white/[0.01] border border-dashed border-outline-variant/25 hover:border-outline-variant/40 ${className}`}
    >
      <div className="relative flex items-center justify-center bg-surface-container-lowest/40 border border-dashed border-outline-variant/25 overflow-hidden w-20 h-20 rounded-full">
        <img
          src={withBase('/images/cookiemusic-mark.png')}
          alt=""
          className="object-contain opacity-20 grayscale w-10 h-10"
        />
      </div>
      <p className="w-full truncate font-bold text-xs text-on-surface-variant/40">{label}</p>
    </button>
  )
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
  const displayTracks = initialTracks as Track[]
  const initialMergedArtists = [...(initialArtists || [])].sort((a, b) => {
    const isUserA = !!a.is_user
    const isUserB = !!b.is_user
    if (isUserA !== isUserB) {
      return isUserA ? -1 : 1
    }
    return (b.followers || 0) - (a.followers || 0)
  })
  const displayAlbums = initialAlbums || []
  const displayPopularAlbums = initialPopularAlbums || []
  const displayRecommendedTracks = initialRecommendedTracks || []
  const displayLatestTracks = initialLatestTracks || []

  const [tracks, setTracks] = useState<Track[]>(displayTracks)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }
  const notReadyToast = () =>
    showToast(uiLanguage === 'KO' ? '아직 준비 중입니다' : uiLanguage === 'JA' ? 'まだ準備中です' : 'Not ready yet')

  // 실제 앨범을 먼저 채우고 남는 칸만 자리 표시로 메운다 (앨범이 늘면 자리 표시가 줄어든다).
  // coverOffset 으로 구역마다 자켓 순서를 어긋나게 해 두 줄이 복제처럼 보이지 않게 한다.
  const withAlbumSlots = (albums: Album[], key: string, coverOffset: number): any[] => {
    const shown = albums.slice(0, 10)
    return [
      ...shown,
      ...Array.from({ length: Math.max(0, ALBUM_SLOTS - shown.length) }).map((_, i) => ({
        id: `${key}-slot-${i}`,
        __placeholder: true,
        __slotIndex: i + coverOffset
      }))
    ]
  }
  const popularAlbumItems = withAlbumSlots(displayPopularAlbums, 'popular-album', 0)
  const latestAlbumItems = withAlbumSlots(displayAlbums, 'latest-album', 2)
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

    const rankA = a.rank || 999
    const rankB = b.rank || 999
    
    if (rankA !== rankB) {
      return rankA - rankB
    }

    const playA = a.play_count || 0
    const playB = b.play_count || 0
    const likeA = a.like_count || 0
    const likeB = b.like_count || 0
    
    const scoreA = playA + likeA
    const scoreB = playB + likeB
    
    return scoreB - scoreA
  })

  const [artists, setArtists] = useState<Artist[]>(initialMergedArtists)
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [myPlaylists, setMyPlaylists] = useState<any[]>([])

  useEffect(() => {
    const fetchPlaylists = async () => {
      const localSupabase = createClient()
      const { data: { session } } = await localSupabase.auth.getSession()
      if (!session) return
      
      const { data } = await localSupabase
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

  const [activeTab, setActiveTab] = useState<'trending' | 'latest' | 'featured'>('trending')
  const [heroImageIndex, setHeroImageIndex] = useState(0)

  const heroImages = [
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&h=500&q=80",
    withBase("/images/hero-bg-2.png"),
    withBase("/images/hero-bg-3.png")
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % heroImages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [heroImages.length])



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
                  const isDummyA = !!(a as any).is_dummy
                  const isDummyB = !!(b as any).is_dummy
                  if (isDummyA !== isDummyB) {
                    return isDummyA ? 1 : -1
                  }
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

  return (
    <div className="font-sans text-on-surface w-full">

      {toast && createPortal(
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-fade-in transition-all duration-300 bg-[#0d0d0d]/90 border-outline-variant/40 text-white font-bold text-xs uppercase tracking-wider">
          <span role="status">{toast}</span>
        </div>,
        document.body
      )}

      {/* Hero Banner (Edge-to-Edge) */}
      <section className="-mx-[32px] -mt-[24px] relative h-[25vh] min-h-[220px] md:h-[30vh] overflow-hidden bg-[#0d0d0d] flex flex-col justify-end animate-fade-in">
        {/* Background Pop Artist Image */}
        <div className="absolute inset-0 select-none">
          {heroImages.map((src, index) => (
            <img 
              key={src}
              src={src} 
              alt="" 
              className={`absolute inset-0 w-full h-full object-cover grayscale brightness-[0.7] transition-opacity duration-1000 ${
                index === heroImageIndex ? 'opacity-50' : 'opacity-0'
              }`}
            />
          ))}
          {/* Smooth gradients to blend image into the forest green-black background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d]/50 via-transparent to-transparent" />
        </div>

        {/* Content Container (Aligned with main contents below) */}
        <div className="max-w-7xl mx-auto w-full px-[32px] pb-6 md:pb-8 space-y-3 relative z-10 animate-fade-in-up animation-delay-75">
          <span className="inline-flex items-center gap-1.5 text-[8px] font-extrabold bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full uppercase tracking-wider w-fit">
            <TrendingUp className="w-2.5 h-2.5" />
            Trending AI Hits
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-white drop-shadow-md">
            Listen to the Next Era of Melody
          </h2>
          <p className="text-[10px] md:text-xs text-zinc-300 max-w-xl leading-relaxed font-semibold drop-shadow-sm">
            {uiLanguage === 'KO' ? '인공지능으로 창작된 수많은 트랙들과 제작 시 사용된 프롬프트, 가사 메타데이터를 확인해보세요.' : uiLanguage === 'JA' ? 'AI生成された無数のトラックや、その作成に使われたプロンプトと歌詞を探索しましょう。' : 'Explore countless AI-generated tracks and the prompts and lyrics used to create them.'}
          </p>
          <div className="pt-1">
            <Link
              href="/charts"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-[#090909] hover:bg-primary font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              {uiLanguage === 'KO' ? '차트 순위 보러가기' : uiLanguage === 'JA' ? 'チャートランキングを見る' : 'View Chart Rankings'}
              <ChevronRight className="w-3.5 h-3.5 text-black stroke-[3px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-12 animate-fade-in-up animation-delay-150">
        {/* 인기 음원 & 최신 앨범 */}
        <div className="space-y-12">

        {/* 실시간 인기곡 탑 5 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
              <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                <Play className="w-2.5 h-2.5 text-primary fill-current" />
              </span>
              {uiLanguage === 'KO' ? '실시간 인기 트랙' : uiLanguage === 'JA' ? 'トレンドのトラック' : 'Trending Tracks'}
            </h2>
            <Link href="/charts" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
              {uiLanguage === 'KO' ? '차트 전체보기' : uiLanguage === 'JA' ? 'すべてのチャートを見る' : 'See all charts'}
            </Link>
          </div>

          <div>
            {sortedTracks.slice(0, 10).map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id
              const playCount = track.play_count || 0;
              return (
                <div key={track.id} className={`py-3 flex items-center justify-between group hover:bg-white/[0.05] px-3.5 rounded-xl border-b border-outline-variant/40 last:border-b-0 transition-all duration-200 ${isCurrent ? 'bg-primary/15' : ''}`}>
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
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-all ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isCurrent && isPlaying ? (
                          <div className="flex items-end justify-center gap-[2.5px] h-4 w-4">
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                            <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                          </div>
                        ) : (
                          <Play className="w-5 h-5 fill-current text-white ml-0.5" />
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

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[11px] font-mono text-on-surface-variant w-16 text-right">
                      {playCount.toLocaleString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLikeToggle(track.id)
                      }}
                      className={`inline-flex items-center gap-1.5 p-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-bold cursor-pointer ${
                        userLikes.includes(track.id) ? 'text-primary' : 'text-on-surface-variant/60 hover:text-primary'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                      <span className="font-mono w-8 text-left">{track.like_count || 0}</span>
                    </button>
                    <div className="text-xs text-on-surface-variant w-12 text-right tabular-nums">
                      <AudioDuration url={track.file_url} defaultSec={track.duration_sec} />
                    </div>
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
            })}
          </div>
        </div>

        {/* AI 아티스트 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/charts/artists" className="group/title flex items-center gap-2 cursor-pointer">
              <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant group-hover/title:text-primary uppercase tracking-widest transition-colors">
                <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10 group-hover/title:border-primary/50 transition-colors">
                  <Users className="w-2.5 h-2.5 text-primary" />
                </span>
                {uiLanguage === 'KO' ? '주목받는 AI 아티스트' : uiLanguage === 'JA' ? 'トレンドのAIアーティスト' : 'Trending AI Artists'}
              </h2>
            </Link>
            <Link href="/charts/artists" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
              {uiLanguage === 'KO' ? '아티스트 전체보기' : uiLanguage === 'JA' ? 'すべてのアーティストを見る' : 'See all artists'}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.slice(0, ARTIST_SLOTS).map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.slug}`}
                className="flex flex-col items-center text-center gap-3 p-4 bg-white/[0.01] border border-outline-variant/5 hover:border-outline-variant/30 hover:bg-white/[0.04] rounded-xl transition-all duration-200 cursor-pointer group"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center shrink-0">
                  {artist.avatar_url ? (
                    <img src={artist.avatar_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Users className="w-7 h-7 text-on-surface-variant/40" />
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <p className="font-bold text-xs truncate text-on-surface group-hover:text-white transition-colors">{artist.name}</p>
                  <p className="text-[9px] text-primary/70 font-mono truncate mt-0.5 font-bold">@{artist.slug}</p>
                </div>
              </Link>
            ))}

            {/* 빈 자리 표시 — 실제 아티스트가 늘어나면 하나씩 저절로 줄어든다 */}
            {Array.from({ length: Math.max(0, ARTIST_SLOTS - artists.slice(0, ARTIST_SLOTS).length) }).map((_, i) => (
              <PlaceholderSlot
                key={`artist-slot-${i}`}
                shape="circle"
                uiLanguage={uiLanguage}
                onClick={notReadyToast}
              />
            ))}
          </div>
        </div>

      </div>

      {/* 인기 앨범 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-300">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
            <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
              <TrendingUp className="w-2.5 h-2.5 text-primary" />
            </span>
            {uiLanguage === 'KO' ? '인기 앨범' : uiLanguage === 'JA' ? '人気のアルバム' : 'Popular Albums'}
          </h2>
          <Link href="/search?q=popular-albums" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
            {uiLanguage === 'KO' ? '전체보기' : uiLanguage === 'JA' ? 'すべて見る' : 'See all'}
          </Link>
        </div>

        <Carousel
          items={popularAlbumItems}
          renderItem={(album, index) => (
            album.__placeholder ? (
              <PlaceholderSlot
                key={album.id}
                shape="cover"
                uiLanguage={uiLanguage}
                onClick={notReadyToast}
                index={album.__slotIndex}
                className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)]"
              />
            ) : (
              <AlbumCard key={album.id} album={album} variant="home" rank={index + 1} />
            )
          )}
        />
      </section>

      {/* 추천 음원 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-450">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
            <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
              <Music className="w-2.5 h-2.5 text-primary" />
            </span>
            {uiLanguage === 'KO' ? '추천 음원' : uiLanguage === 'JA' ? 'おすすめのトラック' : 'Recommended Tracks'}
          </h2>
          <Link href="/search?q=recommended-tracks" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
            {uiLanguage === 'KO' ? '전체보기' : uiLanguage === 'JA' ? 'すべて見る' : 'See all'}
          </Link>
        </div>

        <Carousel
          items={displayRecommendedTracks.slice(0, 12)}
          containerClassName="grid grid-rows-2 grid-flow-col gap-x-6 gap-y-4 auto-cols-[85%] sm:auto-cols-[calc((100%-24px)/2)] md:auto-cols-[calc((100%-24px)/2)] lg:auto-cols-[calc((100%-48px)/3)] overflow-x-auto scrollbar-none scroll-smooth pb-4"
          renderItem={(track) => {
            const isCurrent = currentTrack?.id === track.id
            const playCount = track.play_count || (track.id.startsWith('dummy-') ? (track.title.length * 900 + 1500) : 0)
            const likeCount = track.like_count || (track.id.startsWith('dummy-') ? (track.title.length * 40 + 90) : 0)

            return (
              <div
                key={track.id}
                className={`w-full p-3.5 border rounded-2xl flex items-center gap-4 transition-all duration-300 group cursor-pointer ${
                  isCurrent ? 'bg-primary/10 border-primary/30' : 'bg-[#0a0a0a]/80 border-[#1d1d1d]/50 hover:border-primary/40 hover:bg-[#131313]/85'
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
                  <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all duration-300 ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover/image:opacity-100'}`}>
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end justify-center gap-[2.5px] h-5 w-5">
                        <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                        <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                        <div className="w-[3px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-primary text-[#090909] rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover/image:scale-100 transition-all">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    )}
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-1 right-1.5 bg-black/70 text-[8px] font-bold text-zinc-300 px-1 py-0.2 rounded font-mono">
                    <AudioDuration url={track.file_url} defaultSec={track.duration_sec} />
                  </div>
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 text-left">
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-black bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded tracking-wider uppercase">
                      FEATURED SINGLE
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
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono mt-1.5 justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Play className="w-3.5 h-3.5 text-zinc-500 fill-current" />
                          {formatCount(playCount)} Plays
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLikeToggle(track.id)
                          }}
                          className={`flex items-center gap-1 transition-colors cursor-pointer ${userLikes.includes(track.id) ? 'text-primary font-bold' : 'hover:text-primary'}`}
                          title="좋아요"
                        >
                          <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : 'text-zinc-500'}`} />
                          <span>{formatCount(likeCount + (userLikes.includes(track.id) && !initialUserLikes.includes(track.id) ? 1 : (!userLikes.includes(track.id) && initialUserLikes.includes(track.id) ? -1 : 0)))} Likes</span>
                        </button>
                      </div>
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
          }}
        />
      </section>

      {/* 최신 앨범 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-600">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
            <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
              <Library className="w-2.5 h-2.5 text-primary" />
            </span>
            {uiLanguage === 'KO' ? '최신 앨범' : uiLanguage === 'JA' ? '最新のアルバム' : 'Latest Albums'}
          </h2>
          <Link href="/search?q=latest-albums" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
            {uiLanguage === 'KO' ? '전체보기' : uiLanguage === 'JA' ? 'すべて見る' : 'See all'}
          </Link>
        </div>

        <Carousel
          items={latestAlbumItems}
          renderItem={(album) => (
            album.__placeholder ? (
              <PlaceholderSlot
                key={album.id}
                shape="cover"
                uiLanguage={uiLanguage}
                onClick={notReadyToast}
                index={album.__slotIndex}
                className="flex-none w-[75%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/3)] lg:w-[calc((100%-120px)/6)]"
              />
            ) : (
              <AlbumCard key={album.id} album={album} variant="home" />
            )
          )}
        />
      </section>

      {/* 최신 음원 */}
      <section className="space-y-6 animate-fade-in-up animation-delay-600">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black flex items-center gap-2 text-on-surface-variant uppercase tracking-widest">
            <span className="h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
              <Music className="w-2.5 h-2.5 text-primary" />
            </span>
            {uiLanguage === 'KO' ? '최신 음원' : uiLanguage === 'JA' ? '最新のトラック' : 'Latest Tracks'}
          </h2>
          <Link href="/search?q=latest-tracks" className="text-[11px] text-primary hover:underline transition-colors font-bold tracking-tight">
            {uiLanguage === 'KO' ? '전체보기' : uiLanguage === 'JA' ? 'すべて見る' : 'See all'}
          </Link>
        </div>

        <Carousel
          items={displayLatestTracks.slice(0, 10)}
          renderItem={(track) => {
            const isCurrent = currentTrack?.id === track.id
            const playCount = track.play_count || (track.id.startsWith('dummy-') ? (track.title.length * 800 + 1100) : 0)
            const likeCount = track.like_count || (track.id.startsWith('dummy-') ? (track.title.length * 35 + 75) : 0)

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
                  <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all duration-300 ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover/image:opacity-100'}`}>
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end justify-center gap-[3px] h-6 w-6">
                        <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                        <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                        <div className="w-[4px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handlePlay(track, displayLatestTracks)
                          setNowPlayingOpen(true)
                        }}
                        className="w-12 h-12 bg-primary hover:bg-primary text-[#090909] rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Top Right Quick Controls */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleLikeToggle(track.id)
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95 ${
                        userLikes.includes(track.id)
                          ? 'bg-primary text-[#090909]'
                          : 'bg-black/60 hover:bg-black/80 text-white'
                      }`}
                      title="좋아요"
                    >
                      <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                    </button>
                    <div className="bg-black/60 hover:bg-black/80 rounded-full w-8 h-8 flex items-center justify-center">
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
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLikeToggle(track.id)
                      }}
                      className={`flex items-center gap-0.5 transition-colors cursor-pointer ${userLikes.includes(track.id) ? 'text-primary font-bold' : 'hover:text-primary'}`}
                      title="좋아요"
                    >
                      <Heart className={`w-2.5 h-2.5 ${userLikes.includes(track.id) ? 'fill-current text-primary' : 'text-zinc-500'}`} />
                      <span>{formatCount(likeCount + (userLikes.includes(track.id) && !initialUserLikes.includes(track.id) ? 1 : (!userLikes.includes(track.id) && initialUserLikes.includes(track.id) ? -1 : 0)))}</span>
                    </button>
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
          {uiLanguage === 'KO' ? '인기 카테고리' : uiLanguage === 'JA' ? 'トップカテゴリー' : 'TOP Categories'}
        </h2>

        <Carousel
          items={HOME_CATEGORIES}
          renderItem={(g) => (
            <div
              key={g.name}
              className="flex-none w-[45%] sm:w-[calc((100%-24px)/2)] md:w-[calc((100%-48px)/4)] lg:w-[calc((100%-120px)/6)] transition-all duration-300"
            >
              <GenreCard genre={g} uiLanguage={uiLanguage} href={`/charts?genre=${g.name}`} />
            </div>
          )}
        />
      </section>

      </div>

    </div>
  )
}
