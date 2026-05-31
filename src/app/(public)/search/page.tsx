import { createClient } from '@/lib/supabase/server'
import { SearchClient } from '@/components/search/SearchClient'

interface PageProps {
  searchParams: Promise<{
    q?: string
  }>
}

export const revalidate = 0

export default async function PublicSearchPage({ searchParams }: PageProps) {
  const { q = '' } = await searchParams
  const supabase = await createClient()

  // 1. 로그인 유저 정보 로드
  const { data: { user } } = await supabase.auth.getUser()

  // 2. 검색 대상 데이터 prefetch (song_history 추가)
  const [
    { data: tracksData },
    { data: artistsData },
    { data: albumsData },
    { data: songHistoryData }
  ] = await Promise.all([
    supabase.from('tracks').select('*, album:albums(*, artist:artists(*))'),
    supabase.from('artists').select('*'),
    supabase.from('albums').select('*, artist:artists(*)'),
    supabase.from('song_history').select('*').eq('status', 'completed')
  ])

  // 3. song_history 작성자 프로필 로드
  const songHistory = songHistoryData || []
  const userIds = Array.from(new Set(songHistory.map((song: any) => song.user_id).filter(Boolean)))

  const { data: profilesData } = userIds.length > 0
    ? await supabase.from('profiles').select('*').in('id', userIds)
    : { data: [] }

  const profiles = profilesData || []

  // 4. song_history 음원을 Track 형태로 변환
  const mappedRealSongs = songHistory.map((song: any) => {
    const formGenre = song.form?.genre || song.genre || 'Pop'
    const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
    const dbPlayCount = Number(song.form?.play_count || 0)
    const songProfile = profiles.find((p: any) => p.id === song.user_id)

    return {
      id: song.id,
      title: song.title,
      file_url: song.audio_url || '',
      duration_sec: song.form?.duration_sec || null,
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
      image_url: song.image_url || '',
      album: {
        id: `suno-album-${song.id}`,
        title: song.form?.styleDesc || song.title,
        cover_url: song.image_url || '/default-album.png',
        release_type: 'single',
        status: 'published',
        genres: [formGenre],
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
  })

  // 5. tracks (admin 업로드)와 song_history (유저 생성) 병합
  const baseTracks = (tracksData || []).map((track: any) => ({
    ...track,
    album: track.album ? {
      ...track.album,
      artist: track.album.artist
    } : undefined
  }))

  const initialTracks = [...mappedRealSongs, ...baseTracks]

  // 6. 아티스트 정보 병합 (profiles + artists)
  const profileArtists = profiles.map((profile: any) => {
    return {
      id: profile.id,
      name: profile.display_name || profile.email.split('@')[0],
      slug: profile.email.split('@')[0],
      avatar_url: profile.avatar_url || '',
      bio: profile.is_admin ? 'Admin Creator' : 'AI Creator',
      created_at: profile.created_at,
      followers: profile.is_admin ? 30000000 : 1000,
      is_user: true
    }
  })

  const initialArtists = [
    ...profileArtists,
    ...(artistsData || []).map((artist: any) => ({
      ...artist,
      followers: artist.followers || (artist.name.length * 850 + 1200),
      is_user: false
    }))
  ]

  // 7. 앨범 정보 병합 (suno 가상 앨범 + albums)
  const baseAlbums = (albumsData || []).map((album: any) => ({
    ...album,
    artist: album.artist
  }))
  const sunoAlbums = mappedRealSongs.map(song => song.album)
  const initialAlbums = [...sunoAlbums, ...baseAlbums]

  // 8. 로그인 사용자 좋아요 목록 로드 (likes + song_history liked)
  let initialUserLikes: string[] = []
  if (user) {
    const [likesRes, songLikesRes] = await Promise.all([
      supabase.from('likes').select('track_id').eq('user_id', user.id),
      supabase.from('song_history').select('id').eq('user_id', user.id).eq('liked', true)
    ])
    const dbLikes = likesRes.data?.map((l) => l.track_id) || []
    const songLikes = songLikesRes.data?.map((l) => l.id) || []
    initialUserLikes = [...dbLikes, ...songLikes]
  }

  return (
    <SearchClient
      initialQuery={q}
      initialTracks={initialTracks as any[]}
      initialArtists={initialArtists as any[]}
      initialAlbums={initialAlbums as any[]}
      initialUserLikes={initialUserLikes}
    />
  )
}
