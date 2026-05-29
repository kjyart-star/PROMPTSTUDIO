import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from '@/components/library/LibraryClient'
import { Track } from '@/types/music'

export const revalidate = 0

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let likedTracks: Track[] = []

  if (user) {
    // 1. Fetch user profiles to map creator info
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')

    // 2. Fetch completed songs from song_history where liked is true
    const { data: realSongs } = await supabase
      .from('song_history')
      .select('*')
      .eq('status', 'completed')
      .eq('liked', true)
      .order('created_at', { ascending: false })

    likedTracks = (realSongs || []).map((song: any) => {
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
  }

  return (
    <LibraryClient
      initialLikedTracks={likedTracks}
      isLoggedIn={!!user}
    />
  )
}
