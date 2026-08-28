'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Track, Album, Artist } from '@/types/music'
import { Play, Pause, Heart, Trophy, ArrowUp, ArrowDown, Minus, RefreshCw, Music, Search } from 'lucide-react'
import { TrackDropdown } from '@/components/common/TrackDropdown'
import { usePlayerStore } from '@/stores/playerStore'
import { AudioDuration } from '@/components/player/AudioDuration'
import { createClient } from '@/lib/supabase/client'
import { parsePlaylistDescription } from '@/lib/utils'

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

interface ChartItem {
  id: string
  period_type: string
  period_date: string
  track_id: string
  rank: number
  play_count: number
  rank_change: number | null
  track: Track & {
    album: Album & {
      artist: Artist
    }
  }
}

interface ChartClientProps {
  initialChartItems: ChartItem[]
  periodType: 'daily' | 'weekly' | 'monthly'
  periodDate: string | null
  initialUserLikes: string[]
  isAdmin: boolean
}

export function ChartClient({
  initialChartItems,
  periodType,
  periodDate,
  initialUserLikes,
  isAdmin
}: ChartClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [chartItems, setChartItems] = useState<ChartItem[]>(initialChartItems)

  useEffect(() => {
    setChartItems(initialChartItems)
  }, [initialChartItems])
  const [userLikes, setUserLikes] = useState<string[]>(initialUserLikes)
  const [isGenerating, setIsGenerating] = useState(false)
  const [myPlaylists, setMyPlaylists] = useState<any[]>([])
  
  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
  const supabase = createClient()

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

  const [localGenre, setLocalGenre] = useState(searchParams.get('genre') || 'All')
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

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

  const GENRE_MAP_KO: Record<string, string> = {
    'All': '전체', 'Pop': '팝', 'K-Pop': '케이팝', 'J-Pop': '제이팝', 'Gospel': '가스펠', 
    'Electronic': '일렉트로닉', 'Rock': '록', 'R&B': '알앤비', 'Country': '컨트리', 
    'Latin': '라틴', 'Afrobeats': '아프로비츠', 'Shoegaze': '슈게이즈', 'Experimental': '실험음악', 
    'Alternative': '얼터너티브', 'Folk': '포크', 'Jazz': '재즈', 'Blues': '블루스', 
    'House': '하우스', 'Punk': '펑크', 'Dance': '댄스', 'Indie Rock': '인디 록', 
    'Hip Hop': '힙합', 'Reggae': '레게', 'Hyperpop': '하이퍼팝', 'Metal': '메탈', 
    'Funk Soul': '펑크 소울', 'Soundtrack': '사운드트랙', 'Classical': '클래식', 
    'Ambient': '앰비언트', 'Chill': '칠', 'Podcasts': '팟캐스트',
    'Animation': '애니메이션', 'City Pop': '시티팝', 'Trot': '트로트', 'Other': '기타'
  }

  const GENRE_MAP_JA: Record<string, string> = {
    'All': 'すべて', 'Pop': 'ポップ', 'K-Pop': 'K-POP', 'J-Pop': 'J-POP', 'Gospel': 'ゴスペル', 
    'Electronic': 'エレクトロニック', 'Rock': 'ロック', 'R&B': 'R&B', 'Country': 'カントリー', 
    'Latin': 'ラテン', 'Afrobeats': 'アフロビーツ', 'Shoegaze': 'シューゲイザー', 'Experimental': '実験音楽', 
    'Alternative': 'オルタナティヴ', 'Folk': 'フォーク', 'Jazz': 'ジャズ', 'Blues': 'ブルース', 
    'House': 'ハウス', 'Punk': 'パンク', 'Dance': 'ダンス', 'Indie Rock': 'インディーロック', 
    'Hip Hop': 'ヒップホップ', 'Reggae': 'レゲエ', 'Hyperpop': 'ハイパーポップ', 'Metal': 'メタル', 
    'Funk Soul': 'ファンク/ソウル', 'Soundtrack': 'サントラ', 'Classical': 'クラシック', 
    'Ambient': 'アンビエント', 'Chill': 'チルアウト', 'Podcasts': 'ポッドキャスト',
    'Animation': 'アニメ', 'City Pop': 'シティ・ポップ', 'Trot': 'トロット', 'Other': 'その他'
  }

  const isRealTrack = (item: any) => {
    const track = item?.track
    if (!track) return false
    const id = (track.id || '').toLowerCase()
    if (id.startsWith('mock-') || id.startsWith('dummy-')) return false
    const artistSlug = (track.album?.artist?.slug || '').toLowerCase()
    if (artistSlug.startsWith('mock-') || artistSlug === 'neonecho') return false
    return true
  }

  // 클라이언트 측 즉각 장르 및 검색어 필터링
  const filteredItems = chartItems.filter((item: any) => {
    if (!item.track) return false
    if (localGenre !== 'All') {
      const albumGenres = item.track.album?.genres || []
      const lowerGenre = localGenre.toLowerCase()
      if (!albumGenres.some((g: string) => g.toLowerCase() === lowerGenre)) return false
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const titleMatch = item.track.title?.toLowerCase().includes(q)
      const artistMatch = item.track.album?.artist?.name?.toLowerCase().includes(q)
      const albumMatch = item.track.album?.title?.toLowerCase().includes(q)
      if (!titleMatch && !artistMatch && !albumMatch) return false
    }
    return true
  })

  // 서버에서 계산된 순위(rank)대로 정렬 (더미 음원 등은 이미 서버에서 후순위로 밀림)
  const sortedItems = [...filteredItems].sort((a, b) => {
    return a.rank - b.rank
  })

  // 제한 없이 모두 표시 (100개씩 페이징)
  const itemsPerPage = 100
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)

  // 탭 이동
  const handleTabChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setCurrentPage(1)
    const params = new URLSearchParams(searchParams.toString())
    params.set('type', type)
    router.push(`/charts?${params.toString()}`)
  }

  // 장르 이동 (클라이언트에서 즉각 처리)
  const handleGenreChange = (genre: string) => {
    setLocalGenre(genre)
    setCurrentPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (genre === 'All') {
      params.delete('genre')
    } else {
      params.set('genre', genre)
    }
    // 서버 왕복 없이 URL만 업데이트하여 속도 최적화
    window.history.replaceState(null, '', `/charts?${params.toString()}`)
  }

  // 좋아요 토글
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

      setChartItems((prev) =>
        prev.map((item) =>
          item.track_id === trackId
            ? { ...item, track: { ...item.track, like_count: data.like_count } }
            : item
        )
      )
    } catch (err) {
      console.error(err)
      alert('좋아요 처리에 실패했습니다.')
    }
  }

  // 플레이리스트에 담기
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

  // 단일 재생 및 큐 세팅
  const handlePlayTrack = async (track: Track) => {
    setNowPlayingOpen(true)
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }

    if (track.file_url.startsWith('http')) {
      const queueTracks = sortedItems.map((item) => item.track)
      playTrack(track, queueTracks)
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

      // 차트 전체 트랙을 큐에 삽입
      const queueTracks = sortedItems.map((item) => item.track)

      playTrack(signedTrack, queueTracks)
    } catch (err) {
      console.error(err)
      alert('음원 재생에 실패했습니다.')
    }
  }

  // 전체 재생
  const handlePlayAll = () => {
    if (sortedItems.length === 0) return
    handlePlayTrack(sortedItems[0].track)
  }

  // 차트 데이터 강제 수동 빌드 (API 호출)
  const handleGenerateChart = async () => {
    if (isGenerating) return
    setIsGenerating(true)

    try {
      const res = await fetch(`/api/charts/cron?period_type=${periodType}`, {
        method: 'GET'
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '차트 생성 실패')
      }

      alert('차트 집계가 완료되었습니다.')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('차트 생성에 실패했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  // 순위 변동폭 렌더러
  const renderRankChange = (change: number | null, createdAt?: string) => {
    // 1주일 내 등록된 신곡인 경우에만 NEW 배지 표시
    const isNew = createdAt && (new Date().getTime() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000)

    if (change === null) {
      if (isNew) {
        return (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
            NEW
          </span>
        )
      }
      return (
        <span className="flex items-center gap-0.5 text-xs text-on-surface-variant/60">
          <Minus className="w-3 h-3 text-on-surface-variant/40" />
        </span>
      )
    }
    if (change > 0) {
      return (
        <span className="flex items-center gap-0.5 text-xs text-primary font-bold">
          <ArrowUp className="w-3 h-3 fill-current" />
          {change}
        </span>
      )
    }
    if (change < 0) {
      return (
        <span className="flex items-center gap-0.5 text-xs text-blue-500 font-bold">
          <ArrowDown className="w-3 h-3 fill-current" />
          {Math.abs(change)}
        </span>
      )
    }
    return (
      <span className="flex items-center gap-0.5 text-xs text-on-surface-variant/60">
        <Minus className="w-3 h-3 text-on-surface-variant/40" />
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-[32px] py-10 space-y-8 font-sans">
      
      {/* 타이틀 및 탭 */}
      <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
            <Trophy className="w-6 h-6 text-primary shrink-0" />
            {uiLanguage === 'KO' ? '쿠키뮤직 랭킹차트' : uiLanguage === 'JA' ? 'クッキーミュージック ランキングチャート' : 'CookieMusic Ranking Chart'}
          </h1>
          {periodDate && (
            <p className="text-[10px] text-on-surface-variant/80 font-mono">
              {uiLanguage === 'KO' ? '마지막 업데이트 기준일:' : uiLanguage === 'JA' ? '最終更新:' : 'Last updated:'} {periodDate} {localGenre !== 'All' && `• ${uiLanguage === 'KO' ? (GENRE_MAP_KO[localGenre] || localGenre) : localGenre} ${uiLanguage === 'KO' ? '장르' : uiLanguage === 'JA' ? 'ジャンル' : 'Genre'}`}
            </p>
          )}
        </div>

        {/* 대분류 토글 및 기간 탭 */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* 음원 vs 아티스트 토글 */}
          <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl shrink-0">
            <button
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-primary text-[#090909] shadow shadow-primary/10 cursor-pointer"
            >
              {uiLanguage === 'KO' ? '음원 차트' : uiLanguage === 'JA' ? 'トラックチャート' : 'Track Chart'}
            </button>
            <Link
              href="/charts/artists"
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              {uiLanguage === 'KO' ? '아티스트 차트' : uiLanguage === 'JA' ? 'アーティストチャート' : 'Artist Chart'}
            </Link>
          </div>

          {/* 탭 컨트롤 */}
          <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl shrink-0">
            {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer capitalize ${
                  periodType === tab
                    ? 'bg-primary text-[#090909] shadow shadow-primary/10'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {uiLanguage === 'KO' 
                  ? (tab === 'daily' ? '일간' : tab === 'weekly' ? '주간' : '월간')
                  : (tab === 'daily' ? 'Daily' : tab === 'weekly' ? 'Weekly' : 'Monthly')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 카테고리 (장르) 필터 - 임시 숨김 처리 */}
      <section className="hidden flex-wrap gap-2 pb-2 overflow-x-auto scrollbar-none">
        {['All', 'K-Pop', 'Pop', 'Hip Hop', 'R&B', 'Dance', 'Electronic', 'Rock', 'Indie Rock', 'J-Pop', 'City Pop', 'Jazz', 'Classical', 'Ambient', 'Chill', 'Soundtrack', 'Animation', 'Trot', 'Blues', 'Country', 'Latin', 'Afrobeats', 'Shoegaze', 'Experimental', 'Alternative', 'Folk', 'House', 'Punk', 'Reggae', 'Hyperpop', 'Metal', 'Funk Soul', 'Gospel', 'Podcasts', 'Other'].map((genre) => (
          <button
            key={genre}
            onClick={() => handleGenreChange(genre)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border cursor-pointer ${
              genre === localGenre
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-surface-container-low border-outline-variant/10 text-zinc-450 hover:text-on-surface hover:border-white/[0.12]'
            }`}
          >
            {uiLanguage === 'KO' ? (GENRE_MAP_KO[genre] || genre) : uiLanguage === 'JA' ? (GENRE_MAP_JA[genre] || genre) : (genre === 'All' ? 'All' : genre)}
          </button>
        ))}
      </section>

      {/* 액션바 */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low border border-outline-variant/10 p-4 rounded-2xl shadow-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handlePlayAll}
            disabled={sortedItems.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-[#090909] hover:bg-primary font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/15 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {uiLanguage === 'KO' ? '1위부터 재생' : uiLanguage === 'JA' ? '1位から再生' : 'Play from Top 1'}
          </button>
          
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
            <input
              type="text"
              placeholder={uiLanguage === 'KO' ? "제목, 앨범, 아티스트 검색..." : uiLanguage === 'JA' ? "タイトル、アルバム、アーティストを検索..." : "Search title, album, artist..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full sm:w-[250px] bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-on-surface focus:outline-none focus:border-primary/50 transition-colors placeholder:text-on-surface-variant/40"
            />
          </div>
        </div>

        {/* 어드민이거나 로컬 개발 환경일 때 차트 재생성 버튼 노출 */}
        {isAdmin && (
          <button
            onClick={handleGenerateChart}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/20 hover:border-white/[0.15] text-on-surface-variant text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {uiLanguage === 'KO' ? '차트 집계 갱신' : uiLanguage === 'JA' ? 'チャートを更新' : 'Refresh Chart'}
          </button>
        )}
      </section>

      {/* 랭킹 리스트 */}
      <section className="space-y-4">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                <th className="p-0 w-20 text-center border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 rounded-tl-[15px] w-full h-full">{uiLanguage === 'KO' ? '순위' : uiLanguage === 'JA' ? '順位' : 'Rank'}</div></th>
                <th className="p-0 border-b border-white/[0.04]"><div className="py-4.5 px-4 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '곡 정보' : uiLanguage === 'JA' ? 'トラック' : 'Track'}</div></th>
                <th className="p-0 w-24 text-right border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '재생수' : uiLanguage === 'JA' ? '再生数' : 'Plays'}</div></th>
                <th className="p-0 w-24 text-right border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね数' : 'Likes'}</div></th>
                <th className="p-0 w-20 text-right border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 w-full h-full">{uiLanguage === 'KO' ? '시간' : uiLanguage === 'JA' ? '時間' : 'Time'}</div></th>
                <th className="p-0 w-16 border-b border-white/[0.04]"><div className="py-4.5 px-6 bg-surface-container-lowest/80 rounded-tr-[15px] w-full h-full select-none text-transparent">&nbsp;</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item, idx) => {
                  const track = item.track
                  const album = track?.album
                  const artist = album?.artist
 
                  if (!track) return null

                  const playCount = track.play_count || item.play_count || 0
                  const isCurrent = currentTrack?.id === track.id
 
                  return (
                    <tr key={item.id} className={`hover:bg-white/[0.02] transition-all group ${isCurrent ? 'bg-primary/10' : ''}`}>
                      {/* 순위 및 변동 (세로로 배치) */}
                      <td className="py-4 px-6 text-center w-20">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="h-5 flex items-center justify-center">
                            <span className={`font-mono font-black text-sm ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                              {(currentPage - 1) * itemsPerPage + idx + 1}
                            </span>
                          </div>
                          <div className="text-[9px] font-bold">
                            {renderRankChange(item.rank_change, track.created_at)}
                          </div>
                        </div>
                      </td>
 
                      {/* 곡 메타데이터 */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              handlePlayTrack(track)
                              setNowPlayingOpen(true)
                            }}
                            className="w-14 h-14 bg-surface-container-lowest border border-outline-variant/20 rounded overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer group/cover"
                          >
                            {album?.cover_url ? (
                              <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-5 h-5 text-zinc-650" />
                            )}
                            <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-all ${
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                              {isCurrent && isPlaying ? (
                                <div className="flex items-end justify-center gap-[3px] h-4 w-4">
                                  <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-1 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                  <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-2 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                  <div className="w-[2.5px] h-full bg-primary rounded-sm animate-eq-3 shadow-[0_0_8px_rgba(255,45,143,0.5)]"></div>
                                </div>
                              ) : (
                                <Play className="w-5 h-5 fill-current text-white" />
                              )}
                            </div>
                          </button>
                          <div className="min-w-0">
                            <span 
                              onClick={() => {
                                handlePlayTrack(track)
                                setNowPlayingOpen(true)
                              }}
                              className={`font-bold block truncate max-w-sm sm:max-w-md cursor-pointer hover:underline ${isCurrent ? 'text-primary' : 'text-on-surface'}`}
                            >
                              {track.title}
                            </span>
                            <span className="text-[10px] text-on-surface-variant/80 truncate max-w-sm sm:max-w-md block mt-0.5 font-medium">
                              {artist?.name || 'Unknown Artist'} &bull; {album?.title || 'Single'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 재생수 */}
                      <td className="py-4 px-6 text-right font-mono text-on-surface-variant/80 text-xs">
                        {formatCount(playCount)}
                      </td>
 
                      {/* 좋아요 및 담기 */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleLikeToggle(track.id)}
                            className={`inline-flex items-center gap-1.5 p-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-bold cursor-pointer ${
                              userLikes.includes(track.id) ? 'text-primary' : 'text-on-surface-variant/60 hover:text-primary'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                            <span className="font-mono">{track.like_count || 0}</span>
                          </button>
                        </div>
                      </td>
 
                      {/* 시간 */}
                      <td className="py-4 px-6 font-mono text-xs text-on-surface-variant text-right w-20">
                        <AudioDuration url={track.file_url} defaultSec={track.duration_sec} />
                      </td>

                      {/* 더보기 (점) */}
                      <td className="py-4 px-6 text-right w-16">
                        <div className="flex items-center justify-center gap-1">
                          <TrackDropdown
                            track={track}
                            myPlaylists={myPlaylists}
                            userLikes={userLikes}
                            uiLanguage={uiLanguage}
                            onLikeToggle={handleLikeToggle}
                            onSaveToPlaylist={handleSaveToPlaylist}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant/60">
                    <p className="font-medium text-sm text-on-surface-variant">{uiLanguage === 'KO' ? '집계된 차트 데이터가 없습니다.' : uiLanguage === 'JA' ? 'チャートデータがありません。' : 'No chart data available.'}</p>
                    {isAdmin ? (
                      <p className="text-xs text-zinc-650 mt-1">{uiLanguage === 'KO' ? '상단의 \'차트 집계 갱신\' 버튼을 눌러 실시간으로 차트를 만들어보세요.' : uiLanguage === 'JA' ? 'クリック ' : 'Click "Refresh Chart" above to generate chart in real-time.'}</p>
                    ) : (
                      <p className="text-xs text-zinc-650 mt-1">{uiLanguage === 'KO' ? '관련 스케줄러 배치 또는 어드민의 집계 갱신 처리가 필요합니다.' : uiLanguage === 'JA' ? 'スケジューラバッチまたは管理者のチャート生成が必要です。' : 'Requires scheduler batch or admin chart generation.'}</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="text-xs text-zinc-500 font-bold">
              {uiLanguage === 'KO' 
                ? `페이지 ${currentPage} / ${totalPages}` 
                : uiLanguage === 'JA' ? `${currentPage} / ${totalPages} ページ` : `Page ${currentPage} of ${totalPages}`}
            </p>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-[#1a1a1f] hover:bg-zinc-855 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {uiLanguage === 'KO' ? '이전' : uiLanguage === 'JA' ? '前へ' : 'Prev'}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                      currentPage === page 
                        ? 'bg-[#FF2D55] text-white shadow-md shadow-red-500/10' 
                        : 'text-zinc-400 hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-[#1a1a1f] hover:bg-zinc-855 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {uiLanguage === 'KO' ? '다음' : uiLanguage === 'JA' ? '次へ' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
