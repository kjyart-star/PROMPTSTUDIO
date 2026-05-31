import { createClient } from '@/lib/supabase/server'
import { ArtistClient } from '@/components/artist/ArtistClient'
import { Artist, Album, Track } from '@/types/music'
import { notFound, redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export const revalidate = 0

export default async function PublicArtistDetailPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // 1. 아티스트 정보 로드
  let artistData = null
  let isUserProfile = false

  const { data: dbArtist } = await supabase
    .from('artists')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (dbArtist) {
    artistData = dbArtist
  } else {
    // Try to load from profiles table using slug/email prefix
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')

    const matchingProfile = (profiles || []).find(
      (p: any) => (p.email && p.email.split('@')[0] === slug)
    )

    if (matchingProfile) {
      isUserProfile = true
      artistData = {
        id: matchingProfile.id,
        name: matchingProfile.display_name || matchingProfile.email.split('@')[0],
        slug: slug,
        bio: matchingProfile.is_admin ? 'Admin Creator & Producer' : 'AI Creator',
        avatar_url: matchingProfile.avatar_url || '',
        banner_url: null,
        is_ai_generated: false,
        created_at: matchingProfile.created_at,
        updated_at: matchingProfile.updated_at,
        is_user: true
      }
    }
  }

  if (!artistData) {
    return notFound()
  }

  // 1.5. 로그인 사용자 정보 조회 및 본인 크리에이터 채널 리다이렉트 처리
  const { data: { user } } = await supabase.auth.getUser()
  if (isUserProfile && user && user.id === artistData.id) {
    redirect('/profile?tab=public')
  }

  const artist: Artist = artistData as Artist

  // 2. 아티스트 앨범 목록 로드 (공개된 앨범만)
  let albums: Album[] = []
  let initialTracks: Track[] = []

  if (isUserProfile) {
    // Fetch completed songs from song_history for this user
    const { data: userSongs } = await supabase
      .from('song_history')
      .select('*')
      .eq('user_id', artist.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    initialTracks = (userSongs || []).map((song: any, idx: number) => {
      return {
        id: song.id,
        title: song.title,
        file_url: song.audio_url || '',
        duration_sec: null,
        like_count: song.liked ? 1200 - idx * 50 : 35,
        play_count: song.play_count || (10000 - idx * 250),
        album_id: `user-album-${song.id}`,
        created_at: song.created_at,
        status: 'published',
        album: {
          id: `user-album-${song.id}`,
          title: song.form?.styleDesc || song.title,
          cover_url: song.image_url || '/default-album.png',
          release_type: 'single',
          status: 'published',
          created_at: song.created_at,
          artist_id: artist.id,
          artist: artist
        }
      }
    }) as unknown as Track[]
  } else {
    const { data: albumsData } = await supabase
      .from('albums')
      .select('*')
      .eq('artist_id', artist.id)
      .eq('status', 'published')
      .order('release_date', { ascending: false })

    albums = (albumsData || []).map((album: any) => ({
      ...album,
      artist: artist
    }))

    const albumIds = albums.map(a => a.id)

    // 3. 아티스트의 인기 트랙 상위 10곡 로드 (플레이 수 기준)
    if (albumIds.length > 0) {
      const { data: tracksData } = await supabase
        .from('tracks')
        .select('*, albums(*)')
        .in('album_id', albumIds)
        .eq('status', 'published')
        .order('play_count', { ascending: false })
        .limit(10)

      initialTracks = (tracksData || []).map((t: any) => ({
        ...t,
        album: t.albums ? {
          ...t.albums,
          artist: artist
        } : undefined
      }))
    }
  }

  // 3.5. UGC tracks (User generated content uploaded to this channel)
  const { data: ugcTracksData } = await supabase
    .from('song_history')
    .select('*')
    .eq('channel_id', artist.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const ugcTracks = (ugcTracksData || []).map((song: any) => ({
    id: song.id,
    title: song.title,
    file_url: song.audio_url || '',
    duration_sec: song.form?.duration_sec || null,
    like_count: song.like_count || 0,
    play_count: song.play_count || 0,
    album_id: `ugc-${song.id}`,
    created_at: song.created_at,
    status: 'published',
    lyrics: song.lyrics || '',
    image_url: song.image_url || '',
    lyricist: song.form?.lyricist || song.lyricist || '',
    composer: song.form?.composer || song.composer || '',
    arranger: song.form?.arranger || song.arranger || '',
    album: {
      id: `ugc-${song.id}`,
      title: 'Single',
      cover_url: song.image_url || '/default-album.png',
      release_type: 'single',
      status: 'published',
      created_at: song.created_at,
      artist_id: artist.id,
      artist: artist
    }
  })) as unknown as Track[]

  if (ugcTracks.length > 0) {
    initialTracks = [...initialTracks, ...ugcTracks]
  }

  // 4. 아티스트의 플레이리스트 로드
  let playlists: any[] = []
  if (artist) {
    const { data: playlistsData } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', artist.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(10)

    playlists = playlistsData || []
  }

  // 5. 로그인 사용자의 좋아요 목록 로드 (앞서 조회한 user 변수 활용)
  let initialUserLikes: string[] = []
  if (user) {
    const { data: likesData } = await supabase
      .from('likes')
      .select('track_id')
      .eq('user_id', user.id)
    initialUserLikes = likesData?.map((l) => l.track_id) || []
  }

  return (
    <ArtistClient
      artist={artist}
      albums={albums}
      initialTracks={initialTracks}
      initialUserLikes={initialUserLikes}
      playlists={playlists}
      currentUserId={user?.id || null}
    />
  )
}
