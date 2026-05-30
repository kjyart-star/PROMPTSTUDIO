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
  const { data: profileData } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  isAdmin = !!profileData?.is_admin

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
