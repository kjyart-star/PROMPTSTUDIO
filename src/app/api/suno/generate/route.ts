import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { creditErrorResponse, refundCredits, spendCredits } from '@/lib/credits/suite'

const API_KEY = process.env.APIPASS_API_KEY

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }

    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('suno/generate')
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
    const {
      historyId,
      prompt,
      style,
      title,
      modelVersion,
      customMode,
      instrumentalOnly,
      vocalGender,
      negativeTags,
      styleWeight,
      weirdness,
      audioWeight
    } = body

    if (!historyId) {
      return NextResponse.json({ error: 'historyId is required' }, { status: 400 })
    }

    // 같은 클릭이 두 번 닿아도 한 번만 빠지게 — 클라이언트가 보낸 UUID 를 멱등키에 쓴다
    const requestId = typeof body.requestId === 'string' && UUID_RE.test(body.requestId)
      ? body.requestId
      : crypto.randomUUID()

    // 크레딧 선차감. Apipass 가 실패하면 아래에서 되돌린다.
    const spend = await spendCredits({
      action: 'music.generate',
      idempotencyKey: `music.generate:${user.id}:${requestId}`,
      ref: historyId || requestId,
      reason: '음악 생성',
    })
    if (!spend.ok) return creditErrorResponse(spend)

    const upperModelVersion = (modelVersion || 'V5').toUpperCase()

    // Prepare Apipass API payload
    const payload = {
      model: "suno/generate",
      input: {
        prompt: prompt || "",
        tags: style || "",
        style: style || "",
        title: title || "",
        make_instrumental: instrumentalOnly || false,
        model_version: upperModelVersion,
        customMode: customMode ?? true
      }
    }

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
      const taskId = data.data.taskId

      // Update DB with task ID and status
      const { error } = await supabase
        .from('song_history')
        .update({
          suno_task_id: taskId,
          status: 'processing'
        })
        .eq('id', historyId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating task ID:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ taskId, status: 'processing', balance: spend.balance })
    } else {
      await refundCredits(spend.ledgerId, 'apipass 실패')
      console.error('Apipass API Error:', data)
      return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('API POST suno/generate error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
