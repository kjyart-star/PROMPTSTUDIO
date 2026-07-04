import { createClient } from '@/lib/supabase/server'
import { PublicLayoutClient } from '@/components/layout/PublicLayoutClient'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 프로필과 공지사항을 병렬 로드 (공지는 최신 20개로 제한)
  const [profileRes, announcementsRes] = await Promise.all([
    user
      ? supabase.from('profiles').select('is_admin, avatar_url').eq('id', user.id).single()
      : Promise.resolve({ data: null as { is_admin: boolean; avatar_url: string | null } | null }),
    supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  const isAdmin = !!profileRes.data?.is_admin
  const serverAvatarUrl = profileRes.data?.avatar_url ?? null
  const initialAnnouncements = announcementsRes.data || []

  return (
    <PublicLayoutClient
      user={user}
      isAdmin={isAdmin}
      serverAvatarUrl={serverAvatarUrl}
      initialAnnouncements={initialAnnouncements}
    >
      {children}
    </PublicLayoutClient>
  )
}


