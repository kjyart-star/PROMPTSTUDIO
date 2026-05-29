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

  // 2. 검색 대상 데이터 prefetch
  const [
    { data: tracksData },
    { data: artistsData },
    { data: albumsData }
  ] = await Promise.all([
    supabase.from('tracks').select('*, album:albums(*, artist:artists(*))').eq('status', 'published'),
    supabase.from('artists').select('*'),
    supabase.from('albums').select('*, artist:artists(*)').eq('status', 'published')
  ])

  // 3. 로그인 사용자 좋아요 목록 로드
  let initialUserLikes: string[] = []
  if (user) {
    const { data: likesData } = await supabase
      .from('likes')
      .select('track_id')
      .eq('user_id', user.id)
    initialUserLikes = likesData?.map((l) => l.track_id) || []
  }

  return (
    <SearchClient
      initialQuery={q}
      initialTracks={(tracksData || []) as any[]}
      initialArtists={(artistsData || []) as any[]}
      initialAlbums={(albumsData || []) as any[]}
      initialUserLikes={initialUserLikes}
    />
  )
}
