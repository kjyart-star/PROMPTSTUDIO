import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PricingClient } from '@/components/subscription/PricingClient'

export const revalidate = 0

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <Suspense fallback={<div className="p-8 text-xs text-zinc-500 font-bold">Loading Pricing...</div>}>
      <PricingClient user={user} />
    </Suspense>
  )
}
