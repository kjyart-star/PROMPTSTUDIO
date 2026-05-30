import { createClient } from '@/lib/supabase/server'
import { PublicLayoutClient } from '@/components/layout/PublicLayoutClient'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let serverAvatarUrl = null
  
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin, avatar_url')
      .eq('id', user.id)
      .single()
    isAdmin = !!profileData?.is_admin
    serverAvatarUrl = profileData?.avatar_url
  }

  // 공지사항 로드
  const { data: announcementsData } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  const initialAnnouncements = announcementsData || []

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


