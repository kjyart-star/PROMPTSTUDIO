import { createClient } from '@/lib/supabase/server'
import { ChartClient } from '@/components/chart/ChartClient'

interface PageProps {
  searchParams: Promise<{
    type?: string
    genre?: string
  }>
}

export const revalidate = 0

export default async function PublicChartPage({ searchParams }: PageProps) {
  const { type = 'daily', genre = 'All' } = await searchParams
  const periodType = (type === 'daily' || type === 'weekly' || type === 'monthly') ? type : 'daily'

  const supabase = await createClient()

  // 1. 로그인 유저 정보 및 권한(어드민) 체크
  const { data: { user } } = await supabase.auth.getUser()
  
  let isAdmin = false
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = !!profileData?.is_admin
  }

  // 로컬 개발 환경일 경우 테스트 목적으로 관리자 버튼 활성화 지원
  const isLocal = process.env.NODE_ENV === 'development'
  if (isLocal) {
    isAdmin = true
  }

  // 2. 해당 period_type에서 가장 최신의 period_date를 찾음
  const { data: latestSnapshot } = await supabase
    .from('chart_snapshots')
    .select('period_date')
    .eq('period_type', periodType)
    .order('period_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDateStr = latestSnapshot?.period_date || null

  let chartItems: any[] = []

  // 3. 최신 날짜가 있다면 해당 날짜의 랭킹 스냅샷 100위까지 로드
  if (latestDateStr) {
    const { data: chartData, error } = await supabase
      .from('chart_snapshots')
      .select('*, tracks(*, albums(*, artists(*)))')
      .eq('period_type', periodType)
      .eq('period_date', latestDateStr)
      .order('rank', { ascending: true })

    if (!error && chartData) {
      chartItems = chartData.map((item: any) => {
        // PostgREST 관계 조인 결과(tracks)를 어플리케이션 타입에 맞게 매핑
        const rawTrack = item.tracks
        const rawAlbum = rawTrack?.albums
        const rawArtist = rawAlbum?.artists

        return {
          id: item.id,
          period_type: item.period_type,
          period_date: item.period_date,
          track_id: item.track_id,
          rank: item.rank,
          play_count: item.play_count,
          rank_change: item.rank_change,
          track: rawTrack ? {
            ...rawTrack,
            album: rawAlbum ? {
              ...rawAlbum,
              artist: rawArtist
            } : undefined
          } : undefined
        }
      }).filter((item: any) => item.track)
    }
  }

  // 4. If no DB chart data exists, fill with 20 premium mock items
  if (chartItems.length === 0) {
    // 4.0. Fetch real completed songs from song_history (up to 100)
    const { data: realSongs } = await supabase
      .from('song_history')
      .select('*')
      .eq('status', 'completed')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100)

    // 4.1. Fetch only corresponding profiles
    const userIds = Array.from(new Set(realSongs?.map((song: any) => song.user_id).filter(Boolean) || []))
    let profilesData: any[] = []
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
      profilesData = data || []
    }

    const mappedRealSongs = (realSongs || []).map((song: any, idx: number) => {
      const formGenre = song.form?.genre || song.genre || 'Pop'
      const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
      const dbPlayCount = Number(song.form?.play_count || 0)
      const songProfile = profilesData.find((p: any) => p.id === song.user_id)

      return {
        id: song.id,
        period_type: periodType,
        period_date: new Date().toISOString().split('T')[0],
        track_id: song.id,
        rank: idx + 1,
        play_count: dbPlayCount,
        rank_change: null, // "NEW"
        track: {
          id: song.id,
          title: song.title,
          file_url: song.audio_url || '',
          duration_sec: song.form?.duration_sec || 180,
          like_count: dbLikeCount,
          play_count: dbPlayCount,
          album_id: `suno-album-${song.id}`,
          created_at: song.created_at,
          lyricist: song.form?.lyricist || '',
          composer: song.form?.composer || '',
          arranger: song.form?.arranger || '',
          lyrics: song.lyrics || '',
          style_prompt: song.prompt || song.form?.prompt || '',
          album: {
            id: `suno-album-${song.id}`,
            title: song.form?.styleDesc || song.title,
            cover_url: song.image_url || '/default-album.png',
            artist_id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
            genres: [formGenre],
            artist: {
              id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
              name: songProfile ? (songProfile.display_name || songProfile.email.split('@')[0]) : 'Suno AI',
              slug: songProfile ? songProfile.email.split('@')[0] : 'suno-ai'
            }
          }
        }
      }
    })

    const MOCK_TITLES = [
      { title: "Neon City Nights", artist: "Synthwave Kid", genre: "Electronic", duration: 184, cover: "/images/retro_future_cover.png" },
      { title: "빗소리와 커피 한 잔 (Rainy Day Coffee)", artist: "Lofi Beats Collective", genre: "Ballad", duration: 210, cover: "/images/live_tokyo_cover.png" },
      { title: "Cyberpunk Horizon", artist: "Cyber Sound", genre: "Electronic", duration: 195, cover: "/images/vanguard_cover.png" },
      { title: "마지막 여름 밤 (Last Summer Dream)", artist: "Pop Queen", genre: "Pop", duration: 178, cover: "/images/silent_tides_cover.png" },
      { title: "Lost in the Woods", artist: "Acoustic Duo", genre: "Classical", duration: 220, cover: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop" },
      { title: "Midnight Highway Drive", artist: "Future DJ", genre: "Rock", duration: 202, cover: "/images/retro_future_cover.png" },
      { title: "Tokyo Rain Reflections", artist: "Soul Vocalist", genre: "Jazz", duration: 235, cover: "/images/live_tokyo_cover.png" },
      { title: "Electric Heartbeat", artist: "Synthwave Kid", genre: "Electronic", duration: 168, cover: "/images/vanguard_cover.png" },
      { title: "가끔은 쉼표가 필요해 (Rest Time)", artist: "Chill Sunset", genre: "Ballad", duration: 190, cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=350&auto=format&fit=crop" },
      { title: "Smooth Saxophone Vibes", artist: "Jazz Masters", genre: "Jazz", duration: 245, cover: "/images/silent_tides_cover.png" },
      { title: "Dancing in the Storm", artist: "Rock Band AI", genre: "Rock", duration: 215, cover: "/images/retro_future_cover.png" },
      { title: "Deep Blue Ocean", artist: "Acoustic Duo", genre: "Classical", duration: 180, cover: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop" },
      { title: "Urban Hip Hop Flow", artist: "Street Rapper AI", genre: "Hip Hop", duration: 198, cover: "/images/vanguard_cover.png" },
      { title: "Starlight Serenade", artist: "Classic Vibe", genre: "Classical", duration: 260, cover: "/images/silent_tides_cover.png" },
      { title: "너와 나 둘이서 (Us Two)", artist: "Soul Vocalist", genre: "R&B", duration: 204, cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=350&auto=format&fit=crop" },
      { title: "Summer Wave Energy", artist: "Pop Queen", genre: "Pop", duration: 182, cover: "/images/retro_future_cover.png" },
      { title: "Vintage Dreamer memories", artist: "Vintage Mood", genre: "R&B", duration: 212, cover: "/images/live_tokyo_cover.png" },
      { title: "Winter Breeze", artist: "Chill Sunset", genre: "Ballad", duration: 224, cover: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=350&auto=format&fit=crop" },
      { title: "Epic Symphony of AI", artist: "Classic Vibe", genre: "Classical", duration: 310, cover: "/images/vanguard_cover.png" },
      { title: "Golden hour sunset", artist: "Future DJ", genre: "Pop", duration: 189, cover: "/images/silent_tides_cover.png" }
    ]

    const todayStr = new Date().toISOString().split('T')[0]
    let mockList = MOCK_TITLES.map((m, idx) => ({
      id: `mock-chart-${idx + 1}`,
      period_type: periodType,
      period_date: todayStr,
      track_id: `mock-track-${idx + 1}`,
      rank: idx + 1,
      play_count: 50000 - (idx * 2300),
      rank_change: idx === 0 ? null : (idx % 3 === 0 ? 2 : idx % 3 === 1 ? -1 : 0),
      track: {
        id: `mock-track-${idx + 1}`,
        title: m.title,
        file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration_sec: m.duration,
        like_count: 1200 - (idx * 50),
        play_count: 50000 - (idx * 2300),
        album_id: `mock-album-${idx + 1}`,
        created_at: new Date().toISOString(),
        album: {
          id: `mock-album-${idx + 1}`,
          title: `${m.title} (Album)`,
          cover_url: m.cover,
          artist_id: `mock-artist-${idx + 1}`,
          genres: [m.genre],
          artist: {
            id: `mock-artist-${idx + 1}`,
            name: m.artist,
            slug: `mock-artist-slug-${idx + 1}`
          }
        }
      }
    }))

    // Skip genre filtering on server to allow instant client-side filtering
    let filteredRealSongs = mappedRealSongs

    // Combine real songs and mockups
    const realCount = filteredRealSongs.length
    const neededMockCount = Math.max(0, 20 - realCount)
    const slicedMocks = mockList.slice(0, neededMockCount)
    
    let combinedList = [...filteredRealSongs, ...slicedMocks]
    
    // Re-index ranks
    combinedList = combinedList.map((item, index) => ({
      ...item,
      rank: index + 1
    }))

    chartItems = combinedList
  }

  // 5. 로그인 사용자 좋아요 목록 로드
  let initialUserLikes: string[] = []
  if (user) {
    const { data: userLikedSongs } = await supabase
      .from('song_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('liked', true)
    initialUserLikes = userLikedSongs?.map((l) => l.id) || []
  }

  return (
    <ChartClient
      initialChartItems={chartItems}
      periodType={periodType}
      periodDate={latestDateStr || new Date().toISOString().split('T')[0]}
      initialUserLikes={initialUserLikes}
      isAdmin={isAdmin}
    />
  )
}
