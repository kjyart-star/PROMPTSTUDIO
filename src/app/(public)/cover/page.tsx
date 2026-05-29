import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CoverClient } from '@/components/studio/CoverClient'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function CoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Cover Studio...</div>}>
      <CoverClient user={user} />
    </Suspense>
  )
}
