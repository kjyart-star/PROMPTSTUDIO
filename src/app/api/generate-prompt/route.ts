import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { creditErrorResponse, refundCredits, spendCredits, type CreditAction } from '@/lib/credits/suite'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('generate-prompt')
    if (!gate.ok) return gate.response

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Banned account. Please contact support.' }, { status: 403 })
    }

    const body = await request.json()
    const { system, user: userPrompt, model } = body

    if (!system || !userPrompt || typeof system !== 'string' || typeof userPrompt !== 'string') {
      return NextResponse.json({ error: 'System and user prompts are required' }, { status: 400 })
    }

    // Cap input size to prevent abuse of the server's OpenAI billing.
    const MAX_LEN = 8000
    if (system.length > MAX_LEN || userPrompt.length > MAX_LEN) {
      return NextResponse.json({ error: 'Prompt too long' }, { status: 400 })
    }

    // Only allow an explicit set of models; ignore arbitrary client-supplied ones.
    const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o'] as const
    const selectedModel: (typeof ALLOWED_MODELS)[number] = ALLOWED_MODELS.includes(model) ? model : 'gpt-4o-mini'

    const apiKey = (process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
    if (!apiKey) {
      console.error('Missing OpenAI API key on server env')
      return NextResponse.json({ error: 'OpenAI API key not configured on server' }, { status: 500 })
    }

    // 같은 클릭이 두 번 닿아도 한 번만 빠지게 — 클라이언트가 보낸 UUID 를 멱등키에 쓴다
    const requestId = typeof body.requestId === 'string' && UUID_RE.test(body.requestId)
      ? body.requestId
      : crypto.randomUUID()

    // 크레딧 선차감. 단가는 클라이언트가 고른 모델이 아니라 서버가 정한 selectedModel 기준이다.
    const action: CreditAction = `studio.prompt.${selectedModel}`
    const spend = await spendCredits({
      action,
      idempotencyKey: `${action}:${user.id}:${requestId}`,
      ref: requestId,
      reason: '프롬프트·가사 생성',
    })
    if (!spend.ok) return creditErrorResponse(spend)

    let response: Response
    let data: any
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.85,
        }),
      })
      data = await response.json()
    } catch (apiErr) {
      await refundCredits(spend.ledgerId, 'OpenAI 실패')
      console.error('OpenAI request failed:', apiErr)
      return NextResponse.json({ error: 'OpenAI API call failed' }, { status: 500 })
    }

    if (!response.ok) {
      await refundCredits(spend.ledgerId, 'OpenAI 실패')
      console.error('OpenAI API error:', data)
      return NextResponse.json({ error: data?.error?.message || 'OpenAI API call failed' }, { status: response.status || 500 })
    }

    const resultText = data.choices?.[0]?.message?.content || ''
    return NextResponse.json({ text: resultText, balance: spend.balance })
  } catch (err: any) {
    console.error('API POST generate-prompt error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
