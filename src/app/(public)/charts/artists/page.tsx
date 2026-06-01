import { createClient } from '@/lib/supabase/server'
import { ArtistChartClient } from '@/components/chart/ArtistChartClient'
import { Artist } from '@/types/music'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function PublicArtistChartPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  const periodType = (searchParams?.type as 'daily' | 'weekly' | 'monthly') || 'daily'

  // 1. Get logged in user info
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Fetch profiles and system artists
  const [profilesRes, artistsRes] = await Promise.all([
    supabase.from('profiles')
      .select('*')
      .order('followers', { ascending: false })
      .limit(100),
    supabase.from('artists')
      .select('*')
      .order('followers', { ascending: false })
      .limit(100)
  ])

  const dbProfiles = profilesRes.data || []
  const dbArtists = artistsRes.data || []

  // 3. Map profiles to Artist type
  const profileArtists: Artist[] = dbProfiles.map((p: any) => ({
    id: p.id,
    name: p.display_name || p.email?.split('@')[0] || 'Unknown Creator',
    slug: p.email?.split('@')[0] || p.id,
    avatar_url: p.avatar_url || '',
    bio: p.bio || (p.is_admin ? 'Admin Creator' : 'AI Creator'),
    created_at: p.created_at,
    followers: p.followers || 0,
    is_user: true
  } as any))

  // 4. Map system artists to Artist type
  const systemArtists: Artist[] = dbArtists.map((a: any) => ({
    id: a.id,
    name: a.name,
    slug: a.slug || a.id,
    avatar_url: a.avatar_url || '',
    bio: a.bio || 'AI Generated Artist',
    created_at: a.created_at,
    followers: a.followers || 0,
    is_user: false
  } as any))

  // 5. Merge and sort by followers descending
  // (In a real scenario, artist charting might use a different logic per period. 
  // For now, we use standard followers count as requested)
  const combined = [...profileArtists, ...systemArtists].sort((a, b) => {
    return (b.followers || 0) - (a.followers || 0)
  })

  // 6. Sliced to top 100
  const top100Artists = combined.slice(0, 100)

  return (
    <ArtistChartClient 
      initialArtists={top100Artists}
      currentUserId={user?.id || null}
      periodType={periodType}
    />
  )
}
