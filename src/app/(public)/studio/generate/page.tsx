import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { GenerateClient } from '@/components/studio/GenerateClient'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Generate Studio...</div>}>
      <GenerateClient user={user} />
    </Suspense>
  )
}
