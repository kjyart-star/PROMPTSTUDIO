import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { creditErrorResponse, refundCredits, spendCredits } from '@/lib/credits/suite'
import { SUNO_COST_USD_PER_SONG, reportProviderUsage } from '@/lib/suite/provider'
import { createStemTask, getSunoStatus, parseTaskRef } from '@/lib/suno/channel'
import { pickStems, stemIdempotencyKey, variantIndex, type StemState } from '@/lib/studio/stem'

/**
 * 스템 분리(보컬/악기 2트랙) — 유료(music.stem2).
 *   POST { historyId }      선차감 → 접수. 접수가 안 되면 바로 환불.
 *   GET  ?historyId=…       진행 확인. 끝나면 두 파일을 우리 스토리지로 옮기고 서명 주소를 준다.
 *                           공급사 쪽이 실패하면 여기서 한 번만 환불한다(refunded 표시로 중복 방지).
 * 상태는 곡의 form.stems 에 둔다 — 새 표가 필요 없다.
 */

const adminStorage = () =>
  createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function loadOwned(historyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) } as const
  const { data: item, error } = await supabase.from('song_history').select('*').eq('id', historyId).eq('user_id', user.id).maybeSingle()
  if (error) return { error: NextResponse.json({ error: 'History lookup failed' }, { status: 500 }) } as const
  if (!item) return { error: NextResponse.json({ error: '곡을 찾을 수 없어요.' }, { status: 404 }) } as const
  return { supabase, user, item } as const
}

async function signed(path: string) {
  const { data } = await adminStorage().storage.from('tracks').createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

export async function POST(request: Request) {
  try {
    const gate = await requireAiAccess('suno/stem')
    if (!gate.ok) return gate.response
    const body = await request.json().catch(() => ({}))
    const historyId = typeof body.historyId === 'string' ? body.historyId : ''
    if (!historyId) return NextResponse.json({ error: 'historyId is required' }, { status: 400 })

    const owned = await loadOwned(historyId)
    if ('error' in owned) return owned.error
    const { supabase, user, item } = owned
    const form = (item.form && typeof item.form === 'object' ? item.form : {}) as Record<string, any>
    const prev = form.stems as StemState | undefined

    if (prev?.status === 'processing') return NextResponse.json({ status: 'processing' })
    if (prev?.status === 'done') return NextResponse.json({ status: 'done' })
    if (!item.audio_url || item.status !== 'completed') return NextResponse.json({ error: '완성된 곡만 나눌 수 있어요.' }, { status: 409 })
    if (!item.suno_task_id || parseTaskRef(item.suno_task_id).channel !== 'apipass') {
      return NextResponse.json({ error: '이 곡은 스템 분리를 지원하지 않는 경로로 만들어졌어요.' }, { status: 409 })
    }

    // Suno 곡 id — 저장해 둔 값이 없으면(예전 곡) 만든 작업의 결과 목록에서 순서로 찾는다. 돈을 받기 전에 확인한다.
    let audioId = typeof form.suno_audio_id === 'string' ? form.suno_audio_id : ''
    if (!audioId) {
      const st = await getSunoStatus(item.suno_task_id)
      const hit = st.ok && st.state === 'succeeded' ? st.results[variantIndex(item.title)] : undefined
      audioId = hit && typeof hit.id === 'string' ? hit.id : ''
    }
    if (!audioId) return NextResponse.json({ error: '이 곡의 원본 정보를 찾지 못해 나눌 수 없어요. 새로 만든 곡부터 가능해요.' }, { status: 409 })

    const spend = await spendCredits({
      action: 'music.stem2',
      idempotencyKey: stemIdempotencyKey(user.id, historyId, prev),
      ref: historyId,
      reason: '스템 분리 (보컬/악기)',
    })
    if (!spend.ok) return creditErrorResponse(spend)

    // 환불된 시도도 번호를 남긴다 — 같은 멱등키로 다시 누르면 워커가 옛(환불된) 차감을 돌려줘서 공짜가 된다
    const markFailed = () => supabase.from('song_history')
      .update({ form: { ...form, stems: { status: 'failed', attempt: (prev?.attempt ?? 0) + 1, refunded: true } satisfies StemState } })
      .eq('id', historyId).eq('user_id', user.id)

    const outcome = await createStemTask(item.suno_task_id, audioId)
    if (!outcome.ok) {
      await refundCredits(spend.ledgerId, '스템 분리 접수 실패')
      await markFailed()
      return NextResponse.json({ error: outcome.message, refunded: true }, { status: 502 })
    }

    const state: StemState = {
      status: 'processing', taskRef: outcome.taskRef, ledgerId: spend.ledgerId,
      attempt: (prev?.attempt ?? 0) + 1, startedAt: new Date().toISOString(),
    }
    const { error: saveError } = await supabase.from('song_history')
      .update({ form: { ...form, stems: state } }).eq('id', historyId).eq('user_id', user.id)
    if (saveError) {
      await refundCredits(spend.ledgerId, '스템 분리 기록 실패')
      await markFailed()
      return NextResponse.json({ error: '스템 분리를 시작하지 못했어요. 크레딧은 돌려드렸어요.', refunded: true }, { status: 500 })
    }
    void reportProviderUsage({
      providerId: 'apipass', action: 'music.stem2', model: 'suno-vocal-separation',
      ref: outcome.taskRef, userId: user.id, costUsd: SUNO_COST_USD_PER_SONG.apipass,
    })
    return NextResponse.json({ status: 'processing', balance: spend.balance })
  } catch (err) {
    console.error('Stem POST error:', err)
    return NextResponse.json({ error: '스템 분리를 시작하지 못했어요.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const historyId = new URL(request.url).searchParams.get('historyId') || ''
    if (!historyId) return NextResponse.json({ error: 'historyId is required' }, { status: 400 })
    const owned = await loadOwned(historyId)
    if ('error' in owned) return owned.error
    const { supabase, user, item } = owned
    const form = (item.form && typeof item.form === 'object' ? item.form : {}) as Record<string, any>
    const st = form.stems as StemState | undefined
    if (!st) return NextResponse.json({ status: 'none' })

    if (st.status === 'done' && st.vocals && st.instrumental) {
      return NextResponse.json({ status: 'done', vocalsUrl: await signed(st.vocals), instrumentalUrl: await signed(st.instrumental) })
    }
    if (st.status === 'failed') return NextResponse.json({ status: 'failed', refunded: !!st.refunded })
    if (!st.taskRef) return NextResponse.json({ status: 'processing' })

    const out = await getSunoStatus(st.taskRef)
    if (!out.ok || out.state === 'processing') return NextResponse.json({ status: 'processing' })

    const save = (next: StemState) =>
      supabase.from('song_history').update({ form: { ...form, stems: next } }).eq('id', historyId).eq('user_id', user.id)

    const picked = out.state === 'succeeded' ? pickStems(out.results as any) : null
    if (!picked) {
      // 공급사 실패(또는 결과 불완전) — 한 번만 환불
      let refunded = !!st.refunded
      if (!refunded && st.ledgerId) refunded = (await refundCredits(st.ledgerId, '스템 분리 실패 자동 환불')).ok
      await save({ ...st, status: 'failed', refunded })
      return NextResponse.json({ status: 'failed', refunded })
    }

    const store = adminStorage().storage.from('tracks')
    const move = async (url: string, name: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('download')
      const { error } = await store.upload(`stems/${user.id}/${historyId}-${name}.mp3`, Buffer.from(await res.arrayBuffer()), { upsert: true, contentType: 'audio/mpeg' })
      if (error) throw error
      return `stems/${user.id}/${historyId}-${name}.mp3`
    }
    try {
      const vocals = await move(picked.vocals, 'vocals')
      const instrumental = await move(picked.instrumental, 'instrumental')
      await save({ ...st, status: 'done', vocals, instrumental })
      return NextResponse.json({ status: 'done', vocalsUrl: await signed(vocals), instrumentalUrl: await signed(instrumental) })
    } catch (e) {
      // 우리 스토리지로 못 옮겼다 — 아직 끝난 게 아니다. 다음 조회에서 다시 옮긴다(환불하지 않는다)
      console.error('Stem move error:', e)
      return NextResponse.json({ status: 'processing' })
    }
  } catch (err) {
    console.error('Stem GET error:', err)
    return NextResponse.json({ error: '확인하지 못했어요.' }, { status: 500 })
  }
}
