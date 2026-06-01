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

export default async function PublicAlbumDetailPage({ params }: PageProps) {
  const { slug } = await params
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
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
        <h2 className="text-2xl font-bold text-on-surface mb-2">앨범을 찾을 수 없습니다.</h2>
        <p className="text-on-surface-variant mb-6">존재하지 않거나 삭제된 앨범입니다.</p>
        <Link 
          href="/" 
          className="px-6 py-2 bg-primary text-black rounded-full font-bold hover:bg-primary/90 transition-colors"
        >
          홈으로 돌아가기
        </Link>
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
