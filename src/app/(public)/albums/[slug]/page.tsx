import { createClient } from '@/lib/supabase/server'
import { AlbumClient } from '@/components/album/AlbumClient'
import { Album, Track } from '@/types/music'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    slug: string
  }>
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

  // 2. 앨범 정보 로드
  const { data: albumData, error: albumError } = await supabase
    .from('albums')
    .select('*, artists(*)')
    .eq('slug', slug)
    .single()

  if (albumError || !albumData) {
    // Check if slug is a known mock slug
    const mockSlugs = [
      'wood-and-wire', 'autumn-whispers', 'midnight-strings', 'sunlit-keys',
      'homegrown-sessions', 'folkways', 'vintage-vibe', 'cabin-songs',
      'grand-reflections', 'acoustic-hearts', 'rust-and-resonance', 'echoes-in-the-valley'
    ]
    const isMockSlug = slug.startsWith('album-') || slug.startsWith('dummy-album-') || mockSlugs.includes(slug.toLowerCase())

    if (isMockSlug) {
      const titles = [
        'Wood & Wire', 'Autumn Whispers', 'Midnight Strings', 'Sunlit Keys',
        'Homegrown Sessions', 'Folkways', 'Vintage Vibe', 'Cabin Songs',
        'Grand Reflections', 'Acoustic Hearts', 'Rust & Resonance', 'Echoes in the Valley'
      ]
      let idx = 0
      if (slug.startsWith('album-') || slug.startsWith('dummy-album-')) {
        const numMatch = slug.match(/\d+/)
        idx = numMatch ? (parseInt(numMatch[0]) - 1) : 0
      } else {
        idx = mockSlugs.indexOf(slug.toLowerCase())
      }
      idx = Math.max(0, Math.min(idx, 11))

      const dummyId = `album-${idx + 1}`
      const releaseTypes = ['lp', 'single', 'ep', 'lp', 'single', 'lp', 'lp', 'ep', 'lp', 'single', 'ep', 'lp']
      const title = titles[idx] || 'Wood & Wire'
      const releaseType = releaseTypes[idx] || 'lp'
      const coverUrl = `https://images.unsplash.com/photo-${[
        '1510915361894-db8b60106cb1', '1511192336575-5a79af67a629', '1520523839897-bd0b52f945a0',
        '1539635278303-d4002c07eae3', '1485278537138-4e8911a13c02', '1511671782779-c97d3d27a1d4',
        '1550985616-10810253b84d', '1556449895-a33c9dba33dd', '1552422535-c45813c61732',
        '1516450360452-9312f5e86fc7', '1505740420928-5e560c06d30e', '1487215078519-e21cc028cb29'
      ][idx] || '1510915361894-db8b60106cb1'}?auto=format&fit=crop&w=350&h=350&q=80`

      const artistNames = ['Solaris', 'Pulse Unit', 'Void Voyager', 'Electric Aura']
      const artistName = artistNames[idx % artistNames.length]
      
      const album: Album = {
        id: dummyId,
        slug: slug,
        artist_id: `artist-${(idx % 4) + 1}`,
        title: title,
        release_type: releaseType as any,
        cover_url: coverUrl,
        release_date: '2026-05-28',
        genres: ['Ambient', 'Electronic'],
        moods: ['Dreamy'],
        description: `${title} 앨범입니다.`,
        status: 'published',
        generation_tool: 'Suno AI',
        total_plays: (idx + 1) * 8500 + 4000,
        total_likes: (idx + 1) * 350 + 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        artist: {
          id: `artist-${(idx % 4) + 1}`,
          slug: artistName.toLowerCase().replace(' ', '_'),
          name: artistName,
          bio: `${artistName} 님은 AI 음원 아티스트입니다.`,
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
          banner_url: null,
          links: null,
          is_ai_generated: true,
          owner_user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      return (
        <AlbumClient
          album={album}
          initialTracks={[]}
          initialUserLikes={initialUserLikes}
        />
      )
    }

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
