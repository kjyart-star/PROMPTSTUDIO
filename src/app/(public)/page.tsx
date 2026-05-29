import { createClient } from '@/lib/supabase/server'
import { HomeClient } from '@/components/home/HomeClient'
import { Track, Album, Artist } from '@/types/music'

export const revalidate = 0

export default async function PublicHomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let initialUserLikes: string[] = []
  if (user) {
    const { data: userLikedSongs } = await supabase
      .from('song_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('liked', true)
    initialUserLikes = userLikedSongs?.map((l) => l.id) || []
  }

  // 1.4. profiles 목록 로드
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('*')

  // 1.5. Fetch real completed songs from song_history for general fallbacks & lists
  const { data: realSongs } = await supabase
    .from('song_history')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const mappedRealSongs = (realSongs || []).map((song: any) => {
    const formGenre = song.form?.genre || song.genre || 'Pop'
    const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
    const dbPlayCount = Number(song.form?.play_count || 0)
    const songProfile = (profilesData || []).find((p: any) => p.id === song.user_id)

    return {
      id: song.id,
      title: song.title,
      file_url: song.audio_url || '',
      duration_sec: song.form?.duration_sec || 180,
      like_count: dbLikeCount,
      play_count: dbPlayCount,
      album_id: `suno-album-${song.id}`,
      created_at: song.created_at,
      status: 'published',
      lyricist: song.form?.lyricist || '',
      composer: song.form?.composer || '',
      arranger: song.form?.arranger || '',
      lyrics: song.lyrics || '',
      style_prompt: song.prompt || song.form?.prompt || '',
      album: {
        id: `suno-album-${song.id}`,
        title: song.form?.styleDesc || `${song.title} (Suno)`,
        cover_url: song.image_url || '/default-album.png',
        release_type: 'single',
        status: 'published',
        created_at: song.created_at,
        artist_id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
        artist: {
          id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
          name: songProfile ? (songProfile.display_name || songProfile.email.split('@')[0]) : 'Suno AI',
          slug: songProfile ? songProfile.email.split('@')[0] : 'suno-ai',
          avatar_url: songProfile ? (songProfile.avatar_url || '/default-album.png') : '/default-album.png',
          bio: songProfile ? (songProfile.is_admin ? 'Admin Creator' : 'AI Creator') : 'Suno AI generator',
          created_at: song.created_at
        }
      }
    }
  }) as unknown as Track[]

  // 1.6. 실시간 차트 정보 로드 (daily snapshot)
  const { data: latestSnapshot } = await supabase
    .from('chart_snapshots')
    .select('period_date')
    .eq('period_type', 'daily')
    .order('period_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDateStr = latestSnapshot?.period_date || null

  let initialTracks: Track[] = []

  // 최신 날짜가 있다면 해당 날짜의 랭킹 스냅샷 10위까지 로드
  if (latestDateStr) {
    const { data: chartData, error } = await supabase
      .from('chart_snapshots')
      .select('*, tracks(*, albums(*, artists(*)))')
      .eq('period_type', 'daily')
      .eq('period_date', latestDateStr)
      .order('rank', { ascending: true })
      .limit(10)

    if (!error && chartData) {
      initialTracks = chartData.map((item: any) => {
        const rawTrack = item.tracks
        const rawAlbum = rawTrack?.albums
        const rawArtist = rawAlbum?.artists

        return rawTrack ? {
          ...rawTrack,
          album: rawAlbum ? {
            ...rawAlbum,
            artist: rawArtist
          } : undefined
        } : null
      }).filter(Boolean) as unknown as Track[]
    }
  }

  // Fallback fallback lists for local dev
  const DUMMY_TRACKS_FALLBACK = [
    { id: 'dummy-1', title: 'Have you seen my baby', file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration_sec: 222, like_count: 342109, play_count: 342109, status: 'published', created_at: '', album_id: 'dummy-album-1', album: { id: 'dummy-album-1', title: 'Have you seen my baby', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=350&h=350&q=80', release_type: 'lp', status: 'published', created_at: '', artist_id: 'artist-1', artist: { id: 'artist-1', name: 'Machines Of Loving Grace', slug: 'machines', avatar_url: '', bio: '', created_at: '' } } },
    { id: 'dummy-2', title: 'Cosmic Déjà Vu', file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration_sec: 255, like_count: 289551, play_count: 289551, status: 'published', created_at: '', album_id: 'dummy-album-2', album: { id: 'dummy-album-2', title: 'Cosmic Déjà Vu', cover_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=350&h=350&q=80', release_type: 'single', status: 'published', created_at: '', artist_id: 'artist-2', artist: { id: 'artist-2', name: 'Dream Relic', slug: 'dream-relic', avatar_url: '', bio: '', created_at: '' } } },
    { id: 'dummy-3', title: 'Out Yo Head - Remix', file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration_sec: 198, like_count: 158003, play_count: 158003, status: 'published', created_at: '', album_id: 'dummy-album-3', album: { id: 'dummy-album-3', title: 'Out Yo Head - Remix', cover_url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=350&h=350&q=80', release_type: 'single', status: 'published', created_at: '', artist_id: 'artist-3', artist: { id: 'artist-3', name: 'PHELIPE', slug: 'phelipe', avatar_url: '', bio: '', created_at: '' } } },
    { id: 'dummy-4', title: 'The Questions', file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration_sec: 301, like_count: 102994, play_count: 102994, status: 'published', created_at: '', album_id: 'dummy-album-4', album: { id: 'dummy-album-4', title: 'The Questions', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=350&h=350&q=80', release_type: 'single', status: 'published', created_at: '', artist_id: 'artist-4', artist: { id: 'artist-4', name: 'Lofn AI', slug: 'lofn-ai', avatar_url: '', bio: '', created_at: '' } } },
    { id: 'dummy-5', title: 'R u still there', file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', duration_sec: 235, like_count: 94332, play_count: 94332, status: 'published', created_at: '', album_id: 'dummy-album-5', album: { id: 'dummy-album-5', title: 'R u still there', cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=350&h=350&q=80', release_type: 'single', status: 'published', created_at: '', artist_id: 'artist-5', artist: { id: 'artist-5', name: 'Krheâzee', slug: 'krheazee', avatar_url: '', bio: '', created_at: '' } } }
  ]

  // 만약 랭킹 스냅샷 데이터가 비어있다면 song_history 완료본 기반으로 fallback 리스트 빌드
  if (initialTracks.length === 0) {
    // 인기 트랙 로드
    const { data: tracksData } = await supabase
      .from('tracks')
      .select('*, albums(*, artists(*))')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(10)

    const dbTracks: Track[] = (tracksData || []).map((track: any) => ({
      ...track,
      album: track.albums ? {
        ...track.albums,
        artist: track.albums.artists
      } : undefined
    }))

    const baseTracks = dbTracks.length > 0 ? dbTracks : DUMMY_TRACKS_FALLBACK as Track[]
    initialTracks = [...mappedRealSongs, ...baseTracks.slice(0, Math.max(0, 10 - mappedRealSongs.length))]
  }

  // 추천 음원 로드 (좋아요 순)
  const { data: recommendedTracksData } = await supabase
    .from('tracks')
    .select('*, albums(*, artists(*))')
    .eq('status', 'published')
    .order('like_count', { ascending: false })
    .limit(10)

  const dbRecommended: Track[] = (recommendedTracksData || []).map((track: any) => ({
    ...track,
    album: track.albums ? {
      ...track.albums,
      artist: track.albums.artists
    } : undefined
  }))

  const baseRecommended = dbRecommended.length > 0 ? dbRecommended : DUMMY_TRACKS_FALLBACK as Track[]
  const initialRecommendedTracks = [...mappedRealSongs, ...baseRecommended.slice(0, Math.max(0, 10 - mappedRealSongs.length))]

  // 최신 음원 로드 (최신 등록 순)
  const { data: latestTracksData } = await supabase
    .from('tracks')
    .select('*, albums(*, artists(*))')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)

  const dbLatest: Track[] = (latestTracksData || []).map((track: any) => ({
    ...track,
    album: track.albums ? {
      ...track.albums,
      artist: track.albums.artists
    } : undefined
  }))

  const baseLatest = dbLatest.length > 0 ? dbLatest : DUMMY_TRACKS_FALLBACK as Track[]
  const initialLatestTracks = [...mappedRealSongs, ...baseLatest.slice(0, Math.max(0, 10 - mappedRealSongs.length))]

  // 최신 앨범 로드 (10개)
  const { data: albumsData } = await supabase
    .from('albums')
    .select('*, artists(*)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)

  const initialAlbums: Album[] = (albumsData || []).map((album: any) => ({
    ...album,
    artist: album.artists
  }))

  // 인기 앨범 로드 (10개, 플레이수 및 좋아요수 내림차순)
  const { data: popularAlbumsData } = await supabase
    .from('albums')
    .select('*, artists(*)')
    .eq('status', 'published')
    .order('total_plays', { ascending: false })
    .order('total_likes', { ascending: false })
    .limit(10)

  const initialPopularAlbums: Album[] = (popularAlbumsData || []).map((album: any) => ({
    ...album,
    artist: album.artists
  }))

  // 추천 아티스트 로드
  const { data: artistsData } = await supabase
    .from('artists')
    .select('*')
    .limit(4)



  const profileArtists: Artist[] = (profilesData || []).map((profile: any) => {
    return {
      id: profile.id,
      name: profile.display_name || profile.email.split('@')[0],
      slug: profile.email.split('@')[0],
      avatar_url: profile.avatar_url || '',
      bio: profile.is_admin ? 'Admin Creator' : 'AI Creator',
      created_at: profile.created_at,
      followers: profile.is_admin ? 30000000 : 1000,
      is_user: true
    } as any
  })

  const initialArtists: Artist[] = [
    ...profileArtists,
    ...(artistsData || []).map((artist: any) => ({
      ...artist,
      followers: artist.followers || (artist.name.length * 850 + 1200),
      is_user: false
    }))
  ]

  return (
    <HomeClient
      initialTracks={initialTracks}
      initialAlbums={initialAlbums}
      initialPopularAlbums={initialPopularAlbums}
      initialArtists={initialArtists}
      initialUserLikes={initialUserLikes}
      initialRecommendedTracks={initialRecommendedTracks}
      initialLatestTracks={initialLatestTracks}
    />
  )
}
