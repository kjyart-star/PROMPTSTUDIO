import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/components/profile/ProfileClient'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let isAdmin = false
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  isAdmin = roleData?.role === 'admin'

  const isLocal = process.env.NODE_ENV === 'development'
  if (isLocal) {
    isAdmin = true
  }

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Profile...</div>}>
      <ProfileClient user={user} isAdmin={isAdmin} />
    </Suspense>
  )
}
