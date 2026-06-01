import { createClient } from '@/lib/supabase/server'
import { SearchClient } from '@/components/search/SearchClient'
import { parsePlaylistDescription } from '@/lib/utils'
import { Track, Album } from '@/types/music'

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
    { data: userPlaylistsData },
    { data: songHistoryData }
  ] = await Promise.all([
    supabase.from('tracks').select('*, album:albums(*, artist:artists(*))'),
    supabase.from('artists').select('*'),
    supabase.from('user_playlists').select('*').eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('song_history').select('*').eq('status', 'completed')
  ])

  // 3. song_history 작성자 프로필 로드
  const songHistory = songHistoryData || []
  const userIds = Array.from(new Set(songHistory.map((song: any) => song.user_id).filter(Boolean)))

  const { data: profilesData } = userIds.length > 0
    ? await supabase.from('profiles').select('*').in('id', userIds)
    : { data: [] }

  const profiles = profilesData || []

  // 3.5. song_history 플레이리스트 로드
  const playlistIds = Array.from(new Set(songHistory.map((song: any) => song.playlist_id).filter(Boolean)))
  const { data: playlistsData } = playlistIds.length > 0
    ? await supabase.from('user_playlists').select('*').in('id', playlistIds)
    : { data: [] }
  const playlists = playlistsData || []

  // 4. song_history 음원을 Track 형태로 변환
  const mappedRealSongs = songHistory.map((song: any) => {
    const formGenre = song.form?.genre || song.genre || 'Pop'
    const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
    const dbPlayCount = Number(song.form?.play_count || 0)
    const songProfile = profiles.find((p: any) => p.id === song.user_id)
    const playlist = playlists.find((p: any) => p.id === song.playlist_id && !p.description?.startsWith('[folder]'))

    return {
      id: song.id,
      title: song.title,
      file_url: song.audio_url || '',
      duration_sec: song.form?.duration_sec || null,
      like_count: dbLikeCount,
      play_count: dbPlayCount,
      album_id: song.playlist_id || 'loose',
      created_at: song.created_at,
      status: 'published',
      lyricist: song.form?.lyricist || '',
      composer: song.form?.composer || '',
      arranger: song.form?.arranger || '',
      lyrics: song.lyrics || '',
      style_prompt: song.prompt || song.form?.prompt || '',
      image_url: song.image_url || '',
      album: playlist ? {
        id: playlist.id,
        slug: playlist.id,
        title: playlist.title,
        cover_url: song.image_url || playlist.cover_url || '/default-album.png',
        release_type: 'playlist',
        status: 'published',
        genres: [formGenre],
        created_at: playlist.created_at,
        artist_id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
        artist: {
          id: songProfile ? songProfile.id : `suno-artist-${song.id}`,
          name: songProfile ? (songProfile.display_name || songProfile.email.split('@')[0]) : 'Suno AI',
          slug: songProfile ? songProfile.email.split('@')[0] : 'suno-ai',
          avatar_url: songProfile ? (songProfile.avatar_url || '/default-album.png') : '/default-album.png',
          bio: songProfile ? (songProfile.is_admin ? 'Admin Creator' : 'AI Creator') : 'Suno AI generator',
          created_at: song.created_at
        }
      } : {
        id: `suno-album-${song.id}`,
        slug: 'loose',
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

  // 7. Filter and map user_playlists to Album structures
  const rawPlaylists = userPlaylistsData || []
  const dbAlbums = rawPlaylists.filter((p: any) => {
    const { type } = parsePlaylistDescription(p.description)
    return type === 'album'
  })

  const mappedAlbums: Album[] = dbAlbums.map((playlist: any) => {
    const parsedDesc = parsePlaylistDescription(playlist.description)
    const songChannel = (artistsData || []).find(
      (c: any) => c.id === parsedDesc.channelId || c.owner_user_id === playlist.user_id
    )
    const songProfile = profiles.find((p: any) => p.id === playlist.user_id)

    const finalArtistId = songChannel ? songChannel.id : (songProfile ? songProfile.id : `artist-user-${playlist.user_id}`)
    const finalArtistName = songChannel ? songChannel.name : (songProfile ? (songProfile.display_name || songProfile.email.split('@')[0]) : 'Unknown Artist')
    const finalArtistSlug = songChannel ? songChannel.slug : (songProfile ? songProfile.email.split('@')[0] : 'user')
    const finalAvatarUrl = songChannel ? (songChannel.avatar_url || '/default-album.png') : (songProfile ? (songProfile.avatar_url || '/default-album.png') : '/default-album.png')
    const finalBio = songChannel ? (songChannel.bio || '') : (songProfile ? (songProfile.is_admin ? 'Admin Creator' : 'AI Creator') : '')

    return {
      id: playlist.id,
      slug: playlist.id,
      artist_id: finalArtistId,
      title: playlist.title,
      release_type: 'lp',
      cover_url: playlist.cover_url || '/default-album.png',
      release_date: playlist.created_at,
      genres: playlist.genre ? [playlist.genre] : [],
      moods: [],
      description: parsedDesc.text || `${playlist.title} 앨범입니다.`,
      status: 'published',
      generation_tool: 'Suno AI',
      total_plays: playlist.plays || 0,
      total_likes: 0,
      created_at: playlist.created_at,
      updated_at: playlist.created_at,
      artist: {
        id: finalArtistId,
        slug: finalArtistSlug,
        name: finalArtistName,
        bio: finalBio,
        avatar_url: finalAvatarUrl,
        banner_url: songChannel?.banner_url || null,
        links: null,
        is_ai_generated: true,
        owner_user_id: playlist.user_id,
        created_at: playlist.created_at,
        updated_at: playlist.created_at,
        is_user: true
      }
    }
  })

  const initialAlbums: Album[] = mappedAlbums

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
