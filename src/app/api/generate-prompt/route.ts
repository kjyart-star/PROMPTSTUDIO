import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { generateSuiteText, suiteTextErrorResponse } from '@/lib/ai/suiteText'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 프롬프트 생성. **OpenAI 를 직접 부르지 않는다** (2026-09-07 이전).
 *
 * 예전에는 여기서 크레딧을 먼저 빼고 `api.openai.com` 을 부른 뒤 실패하면 환불했다.
 * 이제 그 셋을 전부 게이트웨이가 한다(`POST /v1/ai/texts`) — 차감·환불·실패 문구가
 * 한 곳에 모이므로 이 라우트에서 사라진 코드는 옮긴 것이지 없앤 것이 아니다.
 * 차감 action(`studio.prompt.*`)과 멱등키 규칙은 그대로다.
 */
export async function POST(request: Request) {
  try {
    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('generate-prompt')
    if (!gate.ok) return gate.response

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 차단 사용자 검증
    let profile: { is_banned?: boolean } | null = null
    const { data: fetchProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code === '42703') {
      // is_banned 컬럼이 없을 경우 정상(false)으로 간주
      profile = { is_banned: false }
    } else {
      profile = fetchProfile
    }

    if (profile?.is_banned) {
      return NextResponse.json({ error: '이용이 제한된 계정입니다. 고객센터로 문의해 주세요.' }, { status: 403 })
    }

    const body = await request.json()
    const { system, user: userPrompt, model } = body

    if (!system || !userPrompt || typeof system !== 'string' || typeof userPrompt !== 'string') {
      return NextResponse.json({ error: '지시문과 입력이 모두 필요합니다.' }, { status: 400 })
    }

    // 입력 길이 상한. 게이트웨이에도 토큰 상한이 있지만 여기서 먼저 자른다 —
    // 화면(StudioClient)이 이 8,000 자를 기준으로 지침서를 잘라 보내기 때문이다.
    const MAX_LEN = 8000
    if (system.length > MAX_LEN || userPrompt.length > MAX_LEN) {
      return NextResponse.json({ error: '입력이 너무 깁니다. 지침서나 설명을 줄여 주세요.' }, { status: 400 })
    }

    // 같은 클릭이 두 번 닿아도 한 번만 빠지게 — 클라이언트가 보낸 UUID 를 멱등키에 쓴다
    const requestId = typeof body.requestId === 'string' && UUID_RE.test(body.requestId)
      ? body.requestId
      : crypto.randomUUID()

    /* 등급(=차감 action)은 클라이언트가 고른 이름이 아니라 suiteText 의 표가 정한다.
       모르는 이름이 오면 기본 등급으로 떨어진다 — 예전 허용 목록과 같은 규칙이다. */
    const result = await generateSuiteText({
      choice: model,
      system,
      user: userPrompt,
      idempotencyKey: `studio.prompt:${user.id}:${requestId}`,
    })

    if (!result.ok) return suiteTextErrorResponse(result)

    return NextResponse.json({ text: result.text, balance: result.balance })
  } catch (err: any) {
    console.error('API POST generate-prompt error:', err)
    return NextResponse.json({ error: '프롬프트를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
