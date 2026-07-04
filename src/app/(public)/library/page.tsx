import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from '@/components/library/LibraryClient'
import { Track } from '@/types/music'

export const revalidate = 0

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let likedTracks: Track[] = []

  if (user) {
    // 1. Fetch the current user's liked songs only:
    //    (a) own song_history rows marked liked, plus
    //    (b) songs the user liked via the likes table.
    const [{ data: ownLiked }, { data: likeRows }] = await Promise.all([
      supabase
        .from('song_history')
        .select('*')
        .eq('status', 'completed')
        .eq('liked', true)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('likes').select('track_id').eq('user_id', user.id)
    ])

    const likedIds = (likeRows || []).map((l: any) => l.track_id).filter(Boolean)
    const ownIds = new Set((ownLiked || []).map((s: any) => s.id))
    const externalIds = likedIds.filter((id: string) => !ownIds.has(id))

    let externalLiked: any[] = []
    if (externalIds.length > 0) {
      const { data } = await supabase
        .from('song_history')
        .select('*')
        .eq('status', 'completed')
        .in('id', externalIds)
      externalLiked = data || []
    }

    const realSongs = [...(ownLiked || []), ...externalLiked]

    // 2. Fetch associated profiles and playlists in parallel
    const userIds = Array.from(new Set(realSongs.map((song: any) => song.user_id).filter(Boolean)))
    const playlistIds = Array.from(new Set(realSongs.map((song: any) => song.playlist_id).filter(Boolean)))

    const [profilesRes, playlistsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('*').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      playlistIds.length > 0
        ? supabase.from('user_playlists').select('*').in('id', playlistIds)
        : Promise.resolve({ data: [] as any[] })
    ])

    const profilesData: any[] = profilesRes.data || []
    const playlistsData: any[] = playlistsRes.data || []

    likedTracks = (realSongs || []).map((song: any) => {
      const formGenre = song.form?.genre || song.genre || 'Pop'
      const dbLikeCount = Number(song.form?.like_count || (song.liked ? 1 : 0))
      const dbPlayCount = Number(song.form?.play_count || 0)
      const songProfile = profilesData.find((p: any) => p.id === song.user_id)
      const playlist = playlistsData.find((p: any) => p.id === song.playlist_id && !p.description?.startsWith('[folder]'))

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
        album: playlist ? {
          id: playlist.id,
          slug: playlist.id,
          title: playlist.title,
          cover_url: song.image_url || playlist.cover_url || '/default-album.png',
          release_type: 'playlist',
          status: 'published',
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
  }

  return (
    <LibraryClient
      initialLikedTracks={likedTracks}
      isLoggedIn={!!user}
    />
  )
}
