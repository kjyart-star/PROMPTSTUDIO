import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { creditErrorResponse, refundCredits, spendCredits } from '@/lib/credits/suite'
import { SUNO_COST_USD_PER_SONG, reportProviderUsage } from '@/lib/suite/provider'
import { createSunoTask } from '@/lib/suno/channel'
import { clampSunoWeight, normalizeSunoModelVersion, normalizeVocalGender } from '@/lib/suno/versions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
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

    // 크레딧 선차감. 접수가 실패하면 아래에서 되돌린다.
    const spend = await spendCredits({
      action: 'music.generate',
      idempotencyKey: `music.generate:${user.id}:${requestId}`,
      ref: historyId || requestId,
      reason: '음악 생성',
    })
    if (!spend.ok) return creditErrorResponse(spend)

    const upperModelVersion = normalizeSunoModelVersion(modelVersion)

    // 어느 채널로 나갈지는 채널 층이 정한다(APIPASS 먼저, 안 되면 kie.ai).
    const outcome = await createSunoTask('generate', {
      modelVersion: upperModelVersion,
      prompt: prompt || '',
      style: style || '',
      title: title || '',
      customMode: customMode ?? true,
      instrumental: instrumentalOnly || false,
      vocalGender: normalizeVocalGender(vocalGender),
      negativeTags: typeof negativeTags === 'string' && negativeTags.trim() ? negativeTags.trim() : undefined,
      styleWeight: clampSunoWeight(styleWeight, 0.5),
      weirdnessConstraint: clampSunoWeight(weirdness, 0.3),
      audioWeight: clampSunoWeight(audioWeight, 0.5),
    })

    if (!outcome.ok) {
      await refundCredits(spend.ledgerId, 'suno 접수 실패')
      return NextResponse.json({ error: outcome.message }, { status: 400 })
    }

    const taskId = outcome.taskRef

    // 공급사에 나간 돈을 관리자단 「사용 금액」에 합류시킨다. 작업이 접수된 시점에
    // 공급사 크레딧이 빠지므로 여기서 한 번만 보낸다(taskId 로 중복이 걸러진다).
    void reportProviderUsage({
      providerId: outcome.channel,
      action: 'music.generate',
      model: `suno-${upperModelVersion.toLowerCase()}`,
      ref: taskId,
      userId: user.id,
      costUsd: SUNO_COST_USD_PER_SONG[outcome.channel],
    })

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
  } catch (err: any) {
    console.error('API POST suno/generate error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
