import { createClient } from '@/lib/supabase/server'
import { HomeClient } from '@/components/home/HomeClient'
import { Track, Album, Artist } from '@/types/music'
import { parsePlaylistDescription } from '@/lib/utils'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function PublicHomePage() {
  const supabase = await createClient()

  // 1. Baseline independent queries in parallel
  const [
    userRes,
    realSongsRes,
    latestSnapshotRes,
    recommendedRes,
    latestTracksRes,
    userPlaylistsRes,
    artistsRes
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('song_history')
      .select('*')
      .eq('status', 'completed')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('chart_snapshots')
      .select('period_date')
      .eq('period_type', 'daily')
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('tracks')
      .select('*, albums(*, artists(*))')
      .eq('status', 'published')
      .order('like_count', { ascending: false })
      .limit(12),
    supabase.from('tracks')
      .select('*, albums(*, artists(*))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('user_playlists')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase.from('artists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  const user = userRes.data.user
  const realSongs = realSongsRes.data || []
  const latestSnapshot = latestSnapshotRes.data
  const dbRecommended = recommendedRes.data || []
  const dbLatest = latestTracksRes.data || []
  const userPlaylistsData = userPlaylistsRes.data || []
  const artistsData = artistsRes.data || []
  console.log('=== DEBUG ARTISTS_DATA ===', artistsData.map((a: any) => a.name))

  // Filter user_playlists to get only albums
  const dbAlbums = userPlaylistsData.filter((p: any) => {
    const { type } = parsePlaylistDescription(p.description)
    return type === 'album'
  })

  // 2. Dependent queries in parallel
  const albumUserIds = dbAlbums.map((a: any) => a.user_id).filter(Boolean)
  const userIds = [...new Set([...realSongs.map((s: any) => s.user_id), ...albumUserIds].filter(Boolean))]

  const albumChannelIds = dbAlbums
    .map((a: any) => parsePlaylistDescription(a.description).channelId)
    .filter(Boolean)
  const channelIds = [...new Set([...realSongs.map((s: any) => s.channel_id), ...albumChannelIds].filter(Boolean))]

  const playlistIds = [...new Set(realSongs.map((s: any) => s.playlist_id).filter(Boolean))]
  const latestDateStr = latestSnapshot?.period_date || null

  const [
    userLikedSongsRes,
    profilesRes,
    channelsRes,
    chartDataRes,
    playlistsRes
  ] = await Promise.all([
    user 
      ? supabase.from('song_history').select('id').eq('user_id', user.id).eq('liked', true)
      : Promise.resolve({ data: null }),
    userIds.length > 0
      ? supabase.from('profiles').select('*').in('id', userIds)
      : Promise.resolve({ data: null }),
    channelIds.length > 0 || userIds.length > 0
      ? supabase.from('artists')
          .select('*')
          .or(`id.in.(${[...channelIds, '00000000-0000-0000-0000-000000000000'].join(',')}),owner_user_id.in.(${[...userIds, '00000000-0000-0000-0000-000000000000'].join(',')})`)
      : Promise.resolve({ data: null }),
    latestDateStr
      ? supabase.from('chart_snapshots')
          .select('*, tracks(*, albums(*, artists(*)))')
          .eq('period_type', 'daily')
          .eq('period_date', latestDateStr)
          .order('rank', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: null }),
    playlistIds.length > 0
      ? supabase.from('user_playlists').select('*').in('id', playlistIds)
      : Promise.resolve({ data: null })
  ])

  const userLikedSongs = userLikedSongsRes.data || []
  const initialUserLikes = userLikedSongs.map((l: any) => l.id)
  const profilesData = profilesRes.data || []
  const channelsData = channelsRes.data || []
  const chartData = chartDataRes.data || []
  const playlistsData = playlistsRes.data || []

  const mappedRealSongs = realSongs.map((song: any) => {
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
        artist_id: finalArtistId,
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
        release_type: 'single',
        status: 'published',
        created_at: song.created_at,
        artist_id: finalArtistId,
        artist: {
          id: finalArtistId,
          name: finalArtistName,
          slug: finalArtistSlug,
          avatar_url: finalAvatarUrl,
          bio: finalBio,
          created_at: song.created_at
        }
      }
    }
  }) as unknown as Track[]

  let initialTracks: Track[] = []

  if (chartData.length > 0) {
    initialTracks = chartData.map((item: any) => {
      const rawTrack = item.tracks
      const rawAlbum = rawTrack?.albums
      const rawArtist = rawAlbum?.artists

      return rawTrack ? {
        ...rawTrack,
        rank: item.rank,
        album: rawAlbum ? {
          ...rawAlbum,
          artist: rawArtist
        } : undefined
      } : null
    }).filter(Boolean) as unknown as Track[]
  }

  if (initialTracks.length === 0) {
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

    initialTracks = [...mappedRealSongs, ...dbTracks]
    // Filter duplicates
    const seen = new Set()
    initialTracks = initialTracks.filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    // Sort by play_count
    initialTracks.sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
    initialTracks = initialTracks.slice(0, 10)
    
    // Assign ranks based on sorted index
    initialTracks = initialTracks.map((t, idx) => ({
      ...t,
      rank: idx + 1
    }))
  }

  let initialRecommendedTracks = [...mappedRealSongs, ...dbRecommended]
  // Filter duplicates
  const seenRec = new Set()
  initialRecommendedTracks = initialRecommendedTracks.filter(t => {
    if (seenRec.has(t.id)) return false
    seenRec.add(t.id)
    return true
  })
  // Sort by like_count
  initialRecommendedTracks.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
  initialRecommendedTracks = initialRecommendedTracks.slice(0, 12)

  let initialLatestTracks = [...mappedRealSongs, ...dbLatest]
  // Filter duplicates
  const seenLat = new Set()
  initialLatestTracks = initialLatestTracks.filter(t => {
    if (seenLat.has(t.id)) return false
    seenLat.add(t.id)
    return true
  })
  // Sort by created_at
  initialLatestTracks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  initialLatestTracks = initialLatestTracks.slice(0, 10)

  // Map user_playlists to Album structures
  const mappedAlbums: Album[] = dbAlbums.map((playlist: any) => {
    const parsedDesc = parsePlaylistDescription(playlist.description)
    const songChannel = channelsData.find((c: any) => c.id === parsedDesc.channelId || c.owner_user_id === playlist.user_id)
    const songProfile = profilesData.find((p: any) => p.id === playlist.user_id)

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
  const initialPopularAlbums: Album[] = [...mappedAlbums].sort((a, b) => (b.total_plays || 0) - (a.total_plays || 0))

  const profileArtists: Artist[] = profilesData.map((profile: any) => {
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
    ...artistsData.map((artist: any) => ({
      ...artist,
      followers: artist.followers || 0,
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

