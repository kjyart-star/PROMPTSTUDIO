'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Track, Album, Artist } from '@/types/music'
import { Play, Pause, Heart, Trophy, ArrowUp, ArrowDown, Minus, RefreshCw, Music } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { createClient } from '@/lib/supabase/client'

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
  
  const { currentTrack, isPlaying, playTrack, togglePlay, setNowPlayingOpen } = usePlayerStore()
  const supabase = createClient()

  const [localGenre, setLocalGenre] = useState(searchParams.get('genre') || 'All')
  const [uiLanguage, setUiLanguage] = useState('KO')

  useEffect(() => {
    const savedLang = localStorage.getItem('uiLanguage')
    if (savedLang) setUiLanguage(savedLang)
  }, [])

  const GENRE_MAP_KO: Record<string, string> = {
    'All': '전체', 'Pop': '팝', 'K-Pop': '케이팝', 'J-Pop': '제이팝', 'Gospel': '가스펠', 
    'Electronic': '일렉트로닉', 'Rock': '록', 'R&B': '알앤비', 'Country': '컨트리', 
    'Latin': '라틴', 'Afrobeats': '아프로비츠', 'Shoegaze': '슈게이즈', 'Experimental': '실험음악', 
    'Alternative': '얼터너티브', 'Folk': '포크', 'Jazz': '재즈', 'Blues': '블루스', 
    'House': '하우스', 'Punk': '펑크', 'Dance': '댄스', 'Indie Rock': '인디 록', 
    'Hip Hop': '힙합', 'Reggae': '레게', 'Hyperpop': '하이퍼팝', 'Metal': '메탈', 
    'Funk Soul': '펑크 소울', 'Soundtrack': '사운드트랙', 'Classical': '클래식', 
    'Ambient': '앰비언트', 'Chill': '칠', 'Podcasts': '팟캐스트'
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

  // 클라이언트 측 즉각 장르 필터링
  const filteredItems = chartItems.filter((item: any) => {
    if (!item.track) return false
    if (localGenre !== 'All') {
      const albumGenres = item.track.album?.genres || []
      const lowerGenre = localGenre.toLowerCase()
      return albumGenres.some((g: string) => g.toLowerCase() === lowerGenre)
    }
    return true
  })

  // 서버에서 계산된 순위(rank)대로 정렬 (더미 음원 등은 이미 서버에서 후순위로 밀림)
  const sortedItems = [...filteredItems].sort((a, b) => {
    return a.rank - b.rank
  })

  // 탭 이동
  const handleTabChange = (type: 'daily' | 'weekly' | 'monthly') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('type', type)
    router.push(`/charts?${params.toString()}`)
  }

  // 장르 이동 (클라이언트에서 즉각 처리)
  const handleGenreChange = (genre: string) => {
    setLocalGenre(genre)
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

  // 단일 재생 및 큐 세팅
  const handlePlayTrack = async (track: Track) => {
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
  const renderRankChange = (change: number | null) => {
    if (change === null) {
      return (
        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-primary/10 border border-[#e3fe06]/20 text-primary">
          NEW
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
            BEATZ 랭킹차트
          </h1>
          {periodDate && (
            <p className="text-[10px] text-on-surface-variant/80 font-mono">
              마지막 업데이트 기준일: {periodDate} {localGenre !== 'All' && `• ${uiLanguage === 'KO' ? (GENRE_MAP_KO[localGenre] || localGenre) : localGenre} 장르`}
            </p>
          )}
        </div>

        {/* 대분류 토글 및 기간 탭 */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* 음원 vs 아티스트 토글 */}
          <div className="flex bg-surface-container-low border border-outline-variant/20 p-1 rounded-xl shrink-0">
            <button
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-primary text-[#080d08] shadow shadow-primary/10 cursor-pointer"
            >
              음원 차트
            </button>
            <Link
              href="/charts/artists"
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              아티스트 차트
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
                    ? 'bg-primary text-[#080d08] shadow shadow-primary/10'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab === 'daily' ? '일간' : tab === 'weekly' ? '주간' : '월간'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 pb-2 overflow-x-auto scrollbar-none">
        {['All', 'Pop', 'K-Pop', 'J-Pop', 'Gospel', 'Electronic', 'Rock', 'R&B', 'Country', 'Latin', 'Afrobeats', 'Shoegaze', 'Experimental', 'Alternative', 'Folk', 'Jazz', 'Blues', 'House', 'Punk', 'Dance', 'Indie Rock', 'Hip Hop', 'Reggae', 'Hyperpop', 'Metal', 'Funk Soul', 'Soundtrack', 'Classical', 'Ambient', 'Chill', 'Podcasts'].map((genre) => (
          <button
            key={genre}
            onClick={() => handleGenreChange(genre)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 border cursor-pointer ${
              genre === localGenre
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-surface-container-low border-outline-variant/10 text-zinc-450 hover:text-on-surface hover:border-white/[0.12]'
            }`}
          >
            {uiLanguage === 'KO' ? (GENRE_MAP_KO[genre] || genre) : (genre === 'All' ? 'All' : genre)}
          </button>
        ))}
      </section>

      {/* 액션바 */}
      <section className="flex items-center justify-between bg-surface-container-low border border-outline-variant/10 p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayAll}
            disabled={sortedItems.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-[#080d08] hover:bg-[#e3fe06] font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/15 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            1위부터 재생
          </button>
        </div>

        {/* 어드민이거나 로컬 개발 환경일 때 차트 재생성 버튼 노출 */}
        {isAdmin && (
          <button
            onClick={handleGenerateChart}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/20 hover:border-white/[0.15] text-on-surface-variant text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            차트 집계 갱신
          </button>
        )}
      </section>

      {/* 랭킹 리스트 */}
      <section className="space-y-4">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-lowest/80 text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">
                <th className="py-4.5 px-6 w-20 text-center">순위</th>
                <th className="py-4.5 px-4">곡 정보</th>
                <th className="py-4.5 px-6 w-24 text-right">재생수</th>
                <th className="py-4.5 px-6 w-24 text-right">좋아요</th>
                <th className="py-4.5 px-6 w-20 text-right">시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs">
              {sortedItems.length > 0 ? (
                sortedItems.map((item, idx) => {
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
                            <span className={`font-mono font-black text-sm ${isCurrent ? 'text-primary' : 'text-on-surface'} ${isCurrent ? 'inline-block' : 'group-hover:hidden'}`}>
                              {idx + 1}
                            </span>
                            <button
                              onClick={() => {
                                handlePlayTrack(track)
                                setNowPlayingOpen(true)
                              }}
                              className={`text-primary cursor-pointer hover:scale-110 transition-transform ${isCurrent ? 'hidden' : 'hidden group-hover:inline-block'}`}
                            >
                              <Play className="w-4 h-4 fill-current mx-auto" />
                            </button>
                          </div>
                          <div className="text-[9px] font-bold">
                            {renderRankChange(item.rank_change)}
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
                                <Pause className="w-5 h-5 fill-current text-primary" />
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
 
                      {/* 좋아요 */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleLikeToggle(track.id)}
                          className={`inline-flex items-center gap-1.5 p-2 rounded-lg hover:bg-white/[0.04] transition-all text-xs font-bold cursor-pointer ${
                            userLikes.includes(track.id) ? 'text-primary' : 'text-on-surface-variant/60 hover:text-primary'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${userLikes.includes(track.id) ? 'fill-current' : ''}`} />
                          <span className="font-mono">{track.like_count || 0}</span>
                        </button>
                      </td>
 
                      {/* 시간 */}
                      <td className="py-4 px-6 font-mono text-xs text-on-surface-variant text-right w-20">
                        {track.duration_sec ? `${Math.floor(track.duration_sec / 60)}:${(track.duration_sec % 60).toString().padStart(2, '0')}` : '-'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant/60">
                    <p className="font-medium text-sm text-on-surface-variant">집계된 차트 데이터가 없습니다.</p>
                    {isAdmin ? (
                      <p className="text-xs text-zinc-650 mt-1">상단의 &apos;차트 집계 갱신&apos; 버튼을 눌러 실시간으로 차트를 만들어보세요.</p>
                    ) : (
                      <p className="text-xs text-zinc-650 mt-1">관련 스케줄러 배치 또는 어드민의 집계 갱신 처리가 필요합니다.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
