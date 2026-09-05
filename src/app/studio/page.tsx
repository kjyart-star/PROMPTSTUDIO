import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { StudioClient } from '@/components/studio/StudioClient'
import { hasAiAccess } from '@/lib/auth/aiGate'

export const revalidate = 0

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // [임시 게이트] AI 프롬프트 생성 UI 노출 여부. 실제 차단은 서버 라우트에서 한다.
  const canUseAi = await hasAiAccess()

  // 작업 편의 및 추후 부분 로그인 방식 적용을 위해 로그인 없이도 바로 진입 허용
  return (
    /* 배경은 레이아웃의 바닥색을 그대로 비춘다 — 여기서 다시 칠하면 판이 뜬 느낌이 죽는다.
       높이는 남은 자리를 채워서 얻는다(flex-1) — 상단 바가 폰에서 두세 줄로 접혀 높이가
       달라지므로 `100vh - 고정값` 으로는 맞출 수 없다. */
    <main className="w-full flex-1 md:flex md:flex-col md:overflow-hidden">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-purple-400">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-widest uppercase text-purple-400">Loading CookieMusic Studio...</span>
        </div>
      }>
        <StudioClient user={user} canUseAi={canUseAi} />
      </Suspense>
    </main>
  )
}
