import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StudioClient } from '@/components/studio/StudioClient'

export const revalidate = 0

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/studio')
  }

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Studio...</div>}>
      <StudioClient user={user} />
    </Suspense>
  )
}
