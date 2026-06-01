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

    const channelIds = [...new Set((realSongs || []).map((s: any) => s.channel_id).filter(Boolean))]
    let channelsData: any[] = []
    if (channelIds.length > 0) {
      const { data } = await supabase
        .from('artists')
        .select('*')
        .in('id', channelIds)
      channelsData = data || []
    }

    const playlistIds = [...new Set((realSongs || []).map((s: any) => s.playlist_id).filter(Boolean))]
    let playlistsData: any[] = []
    if (playlistIds.length > 0) {
      const { data } = await supabase
        .from('user_playlists')
        .select('*')
        .in('id', playlistIds)
      playlistsData = data || []
    }

    const mappedRealSongs = (realSongs || []).map((song: any, idx: number) => {
      const formGenre = song.form?.genre || song.genre || 'Pop'
      const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
      const dbPlayCount = Number(song.form?.play_count || 0)
      const songChannel = channelsData.find((c: any) => c.id === song.channel_id)
      const songProfile = profilesData.find((p: any) => p.id === song.user_id)
      const playlist = playlistsData.find((p: any) => p.id === song.playlist_id && !p.description?.startsWith('[folder]'))

      const finalArtistId = songChannel ? songChannel.id : (songProfile ? songProfile.id : `suno-artist-${song.id}`)
      const finalArtistName = songChannel ? songChannel.name : (songProfile ? (songProfile.display_name || songProfile.email.split('@')[0]) : 'Suno AI')
      const finalArtistSlug = songChannel ? songChannel.slug : (songProfile ? songProfile.email.split('@')[0] : 'suno-ai')
      const finalAvatarUrl = songChannel ? (songChannel.avatar_url || '/default-album.png') : (songProfile ? (songProfile.avatar_url || '/default-album.png') : '/default-album.png')
      const finalBio = songChannel ? (songChannel.bio || '') : (songProfile ? (songProfile.is_admin ? 'Admin Creator' : 'AI Creator') : 'Suno AI generator')

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
          duration_sec: song.form?.duration_sec || null,
          like_count: dbLikeCount,
          play_count: dbPlayCount,
          album_id: song.playlist_id || 'loose',
          created_at: song.created_at,
          lyricist: song.form?.lyricist || '',
          composer: song.form?.composer || '',
          arranger: song.form?.arranger || '',
          lyrics: song.lyrics || '',
          style_prompt: song.prompt || song.form?.prompt || '',
          album: playlist ? {
            id: playlist.id,
            slug: playlist.id,
            title: playlist.title,
            cover_url: song.image_url || playlist.cover_url || '/default-album.png',
            release_type: 'playlist',
            status: 'published',
            created_at: playlist.created_at,
            artist_id: finalArtistId,
            genres: [formGenre],
            artist: {
              id: finalArtistId,
              name: finalArtistName,
              slug: finalArtistSlug,
              avatar_url: finalAvatarUrl,
              bio: finalBio,
              created_at: song.created_at
            }
          } : {
            id: `suno-album-${song.id}`,
            slug: 'loose',
            title: song.form?.styleDesc || song.title,
            cover_url: song.image_url || '/default-album.png',
            artist_id: finalArtistId,
            genres: [formGenre],
            artist: {
              id: finalArtistId,
              name: finalArtistName,
              slug: finalArtistSlug,
              avatar_url: finalAvatarUrl,
              bio: finalBio
            }
          }
        }
      }
    })

    // Skip genre filtering on server to allow instant client-side filtering
    let combinedList = [...mappedRealSongs]
    
    // Sort combined list by play_count descending
    combinedList.sort((a, b) => b.play_count - a.play_count)
    
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
