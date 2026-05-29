import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/SettingsClient'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Settings...</div>}>
      <SettingsClient user={user} />
    </Suspense>
  )
}
