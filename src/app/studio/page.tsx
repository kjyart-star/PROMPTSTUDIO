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
      {/*
        여기에 <Suspense>(또는 loading.tsx)를 두면 안 된다 — 스튜디오가 통째로
        「늦게 도착하는 경계」가 되고, 그 경계는 React 19.2 에서 requestAnimationFrame
        으로만 열린다(react-dom 의 $RC → $RB 큐 → rAF($RV) → 다시 rAF(_reactRetry)).
        브라우저는 화면을 그리지 않는 탭에서 rAF 를 돌리지 않으므로, 배경 탭·가려진
        창·뒤로가기 복원처럼 그리지 않는 상태로 들어오면 경계가 `$~`(queued)로 멈춘 채
        내용이 `<div hidden>` 안에 갇힌다. 스피너만 남고 하이드레이션도, 마운트
        effect(보관함·지침서 불러오기)도 영영 돌지 않는다. 사용자가 한 번 클릭하면
        살아나는 건 클릭이 탭을 다시 그리게 만들어 rAF 가 돌기 때문이다.
        (2026-09-06 실측: 배경 탭에서 `$RB.length===2`, `$RT===undefined` 로 고정.
        react-dom 19.2.8 까지 같은 코드라 버전을 올려도 달라지지 않는다.)

        내용을 첫 셸에 같이 실어 보내면 루트와 함께 하이드레이트되고, 루트
        하이드레이션은 rAF 가 아니라 스케줄러(MessageChannel)로 돌아서 안 그리는
        탭에서도 정상 진행된다. 위의 두 await 때문에 셸은 어차피 기다리므로
        실제로 늘어나는 건 TTFB 수십 ms 뿐이다.
      */}
      <StudioClient user={user} canUseAi={canUseAi} />
    </main>
  )
}
