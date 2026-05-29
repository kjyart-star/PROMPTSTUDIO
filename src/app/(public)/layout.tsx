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
  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    isAdmin = roleData?.role === 'admin'
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
      initialAnnouncements={initialAnnouncements}
    >
      {children}
    </PublicLayoutClient>
  )
}


