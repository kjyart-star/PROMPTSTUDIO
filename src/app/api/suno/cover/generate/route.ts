import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { creditErrorResponse, refundCredits, spendCredits } from '@/lib/credits/suite'
import { APIPASS_COST_USD_PER_SONG, apipassKey, reportProviderUsage } from '@/lib/suite/provider'
import { clampSunoWeight, normalizeSunoModelVersion, normalizeVocalGender } from '@/lib/suno/versions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    // 환경변수가 먼저, 없으면 쿠키플레이 관리 화면에 저장해 둔 키
    const API_KEY = await apipassKey()
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }

    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('suno/cover/generate')
    if (!gate.ok) return gate.response

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 차단 사용자 검증 (크레딧은 스위트 공용 지갑이 본다 — profiles.credits 는 더 이상 쓰지 않는다)
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

    if (!body.audioUrl) {
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 })
    }

    // 같은 클릭이 두 번 닿아도 한 번만 빠지게 — 클라이언트가 보낸 UUID 를 멱등키에 쓴다
    const requestId = typeof body.requestId === 'string' && UUID_RE.test(body.requestId)
      ? body.requestId
      : crypto.randomUUID()

    // 크레딧 선차감. Apipass 가 실패하면 아래에서 되돌린다.
    const spend = await spendCredits({
      action: 'music.cover',
      idempotencyKey: `music.cover:${user.id}:${requestId}`,
      ref: requestId,
      reason: 'AI 커버 생성',
    })
    if (!spend.ok) return creditErrorResponse(spend)

    // Construct the payload as per apipass docs
    // (https://apipass.dev/model/suno/suno_cover). 문서에 없는 필드는 보내지 않는다.
    const modelVersion = normalizeSunoModelVersion(body.modelVersion)

    const input: Record<string, unknown> = {
      model_version: modelVersion,
      audioUrl: body.audioUrl,
      customMode: body.customMode ?? false,
      instrumental: body.instrumental ?? false,
      prompt: body.prompt || "",
      style: body.style || "",
      title: body.title || "",
      styleWeight: clampSunoWeight(body.styleWeight, 0.5),
      weirdnessConstraint: clampSunoWeight(body.weirdnessConstraint ?? body.weirdness, 0.3),
      audioWeight: clampSunoWeight(body.audioWeight, 0.5)
    }

    const gender = normalizeVocalGender(body.vocalGender)
    if (gender) input.vocalGender = gender

    if (typeof body.negativeTags === 'string' && body.negativeTags.trim()) {
      input.negativeTags = body.negativeTags.trim()
    }

    const payload = { model: "suno/cover", input }

    let response: Response
    let data: any
    try {
      response = await fetch("https://api.apipass.dev/api/v1/jobs/createTask", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      })
      data = await response.json()
    } catch (apiErr) {
      await refundCredits(spend.ledgerId, 'apipass 실패')
      console.error('Apipass request failed:', apiErr)
      return NextResponse.json({ error: 'Apipass API Error' }, { status: 400 })
    }

    if (response.ok && data.code === 200) {
       // 공급사에 나간 돈을 관리자단 「사용 금액」에 합류시킨다(taskId 로 중복이 걸러진다).
       void reportProviderUsage({
         providerId: 'apipass',
         action: 'music.cover',
         model: `suno-${modelVersion.toLowerCase()}`,
         ref: data.data.taskId,
         userId: user.id,
         costUsd: APIPASS_COST_USD_PER_SONG,
       })
       // Typically we would save this to Supabase song_history here
       // but for simplicity, we just return the taskId to the client
       return NextResponse.json({ taskId: data.data.taskId, balance: spend.balance })
    } else {
       await refundCredits(spend.ledgerId, 'apipass 실패')
       return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('Create Cover Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
