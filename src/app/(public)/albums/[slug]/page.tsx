import { createClient } from '@/lib/supabase/server'
import { AlbumClient } from '@/components/album/AlbumClient'
import { Album, Track } from '@/types/music'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export const revalidate = 0

export default async function PublicAlbumDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams;
  const artistSlug = resolvedSearchParams?.artist as string | undefined;

  const supabase = await createClient()

  // 1. 로그인 사용자 좋아요 목록 로드
  const { data: { user } } = await supabase.auth.getUser()
  let initialUserLikes: string[] = []
  if (user) {
    const { data: likesData } = await supabase
      .from('likes')
      .select('track_id')
      .eq('user_id', user.id)
    initialUserLikes = likesData?.map((l) => l.track_id) || []
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  if (isUUID) {
    // 2. 미니 앨범 (플레이리스트) 정보 로드
    const { data: playlistData, error: playlistError } = await supabase
      .from('user_playlists')
      .select('*')
      .eq('id', slug)
      .single()

      if (playlistError || !playlistData) {
        console.error('Playlist not found:', playlistError)
        return notFound()
      }

      // 폴더는 앨범/플레이리스트 페이지로 렌더링하지 않음
      if (playlistData.description?.startsWith('[folder]')) {
        return notFound()
      }

      // 3. 앨범 제작자 (아티스트) 정보 로드
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', playlistData.user_id)
        .single()
        
      const { data: channelsData } = await supabase
        .from('artists')
        .select('*')
        .eq('owner_user_id', playlistData.user_id)
      const mainChannel = channelsData?.[0]
      const artistName = mainChannel?.name || profileData?.display_name || 'Unknown Artist'
      const artistSlug = mainChannel?.slug || profileData?.username || 'user'
      const artistAvatar = mainChannel?.avatar_url || profileData?.avatar_url || '/default-album.png'

      const album: Album = {
        id: playlistData.id,
        slug: playlistData.id,
        artist_id: playlistData.user_id,
        title: playlistData.title,
        release_type: 'playlist',
        cover_url: playlistData.cover_url || '/default-album.png',
        release_date: playlistData.created_at,
        genres: playlistData.genre ? [playlistData.genre] : [],
        moods: [],
        description: playlistData.description || `${playlistData.title} 플레이리스트입니다.`,
        status: 'published',
        generation_tool: 'Suno AI',
        total_plays: playlistData.plays || 0,
        total_likes: 0,
        created_at: playlistData.created_at,
        updated_at: playlistData.created_at,
        artist: {
          id: playlistData.user_id,
          slug: artistSlug,
          name: artistName,
          bio: '',
          avatar_url: artistAvatar,
          banner_url: mainChannel?.banner_url || null,
          links: null,
          is_ai_generated: true,
          owner_user_id: playlistData.user_id,
          created_at: playlistData.created_at,
          updated_at: playlistData.created_at,
          is_user: true
        }
      }

      // 4. 수록 트랙 목록 로드 (song_history에서 playlist_id로 매칭)
      const { data: tracksData } = await supabase
        .from('song_history')
        .select('*')
        .eq('playlist_id', playlistData.id)
        .order('created_at', { ascending: true })

      const initialTracks: Track[] = (tracksData || []).map((song: any) => ({
        id: song.id,
        album_id: playlistData.id,
        track_number: 1,
        title: song.title,
        duration_sec: song.duration_sec || 180,
        file_url: song.audio_url || '',
        file_size: null,
        waveform_data: null,
        lyrics: null,
        style_prompt: song.style_desc || null,
        bpm: null,
        song_key: null,
        prompt_meta: null,
        lyricist: song.form?.lyricist || '',
        composer: song.form?.composer || '',
        arranger: song.form?.arranger || '',
        play_count: song.like_count || 0, // Fallback
        like_count: song.like_count || 0,
        status: 'published',
        created_at: song.created_at,
        updated_at: song.created_at,
        album: { ...album },
        image_url: song.image_url || ''
      }))

      return (
        <AlbumClient
          album={album}
          initialTracks={initialTracks}
          initialUserLikes={initialUserLikes}
        />
      )
  }

  // 2. 정규 앨범 (albums 테이블) 정보 로드
  const { data: albumData, error: albumError } = await supabase
    .from('albums')
    .select('*, artists(*)')
    .eq('slug', slug)
    .single()

  if (albumError || !albumData) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
        <h2 className="text-2xl font-bold text-on-surface mb-2">앨범을 찾을 수 없습니다.</h2>
        <p className="text-on-surface-variant mb-6">존재하지 않거나 삭제된 앨범입니다.</p>
        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/" 
            className="px-6 py-2 bg-primary text-black rounded-full font-bold hover:bg-primary/90 transition-colors"
          >
            홈으로 돌아가기
          </Link>
          {artistSlug && (
            <Link 
              href={`/artists/${artistSlug}`} 
              className="px-6 py-2 bg-surface-container-highest text-on-surface rounded-full font-bold hover:bg-surface-container-highest/80 transition-colors"
            >
              제작자 채널로 이동
            </Link>
          )}
        </div>
      </div>
    )
  }

  const album: Album = {
    ...albumData,
    artist: albumData.artists
  }

  // 3. 수록 트랙 목록 로드
  const { data: tracksData } = await supabase
    .from('tracks')
    .select('*')
    .eq('album_id', album.id)
    .order('track_number')

  const initialTracks: Track[] = (tracksData || []).map((t: any) => ({
    ...t,
    album: { ...album }
  }))

  return (
    <AlbumClient
      album={album}
      initialTracks={initialTracks}
      initialUserLikes={initialUserLikes}
    />
  )
}
