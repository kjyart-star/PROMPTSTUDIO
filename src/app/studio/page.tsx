import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { StudioClient } from '@/components/studio/StudioClient'

export const revalidate = 0

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 작업 편의 및 추후 부분 로그인 방식 적용을 위해 로그인 없이도 바로 진입 허용
  return (
    <main className="w-full min-h-screen bg-[#07090e]">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-purple-400">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-widest uppercase text-purple-400">Loading CookieMusic Studio...</span>
        </div>
      }>
        <StudioClient user={user} />
      </Suspense>
    </main>
  )
}
