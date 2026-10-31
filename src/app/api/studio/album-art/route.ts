import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { SUITE_API_BASE, suiteAccessToken } from '@/lib/credits/suite'

/**
 * 앨범아트 만들기 — 유료. 쿠키플레이 AI 게이트웨이(`/v1/ai/images`)를 사용자 토큰으로 부른다.
 * 게이트웨이가 크레딧 선차감·실패 자동 환불·원가×2 바닥 검사를 한다(여기엔 차감 코드가 없다).
 *
 * 모델: GPT Image 2.5 · 1K · 정사각 · 보통 — 게이트웨이 최저 단가대(✦1). 단가는 워커 공개 단가표에서 읽는다.
 *   GET ?quote=1              현재 단가(밀리크레딧)
 *   POST { prompt, requestId } 접수 → { taskId }
 *   GET ?taskId=…             진행 확인 → 끝나면 우리 스토리지로 복사한 공개 주소
 */
export const ALBUM_ART_MODEL = 'gpt-image-2-5'
export const ALBUM_ART_ACTION = 'image.generate.gpt-image-2-5'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function quoteMilli(): Promise<number | null> {
  try {
    const res = await fetch(`${SUITE_API_BASE}/v1/public/prices?serviceId=cookieplay`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const body = await res.json()
    const row = (Array.isArray(body?.prices) ? body.prices : []).find((p: any) => p?.action === ALBUM_ART_ACTION)
    return typeof row?.creditsMilli === 'number' ? row.creditsMilli : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('quote') === '1') {
      return NextResponse.json({ creditsMilli: await quoteMilli(), resolution: '1K (1024×1024)' })
    }
    const taskId = searchParams.get('taskId') || ''
    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })

    const token = await suiteAccessToken()
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    const res = await fetch(`${SUITE_API_BASE}/v1/ai/jobs/${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ status: 'processing' })
    const job = await res.json()

    if (job.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: job.error || '만들지 못했어요.', refunded: !!job.refunded, refundPending: !!job.refundPending })
    }
    if (job.status !== 'succeeded') return NextResponse.json({ status: 'processing' })

    const first = Array.isArray(job.images) ? job.images[0] : null
    const src = typeof first === 'string' ? first : first?.url
    if (!src) return NextResponse.json({ status: 'processing' })

    // 결과 주소는 오래 못 가니 우리 공개 버킷으로 옮긴다
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    const img = await fetch(src)
    if (!img.ok) return NextResponse.json({ status: 'processing' })
    const ext = (img.headers.get('content-type') || '').includes('jpeg') ? 'jpg' : 'png'
    const path = `album_art/${user.id}/${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await admin.storage.from('avatars').upload(path, Buffer.from(await img.arrayBuffer()), { upsert: true, contentType: img.headers.get('content-type') || 'image/png' })
    if (error) return NextResponse.json({ status: 'processing' })
    const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
    return NextResponse.json({ status: 'done', imageUrl: pub.publicUrl })
  } catch (err) {
    console.error('album-art GET error:', err)
    return NextResponse.json({ error: '확인하지 못했어요.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAiAccess('studio/album-art')
    if (!gate.ok) return gate.response
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    const token = await suiteAccessToken()
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1500) : ''
    if (!prompt) return NextResponse.json({ error: '어떤 그림을 원하는지 적어 주세요.' }, { status: 400 })
    const requestId = typeof body.requestId === 'string' && UUID_RE.test(body.requestId) ? body.requestId : crypto.randomUUID()

    // 확인 창에 보인 값보다 더 받지 않는다 — 단가가 그 사이 올랐으면 차감 전에 거절된다
    const shown = Number(body.maxCreditsMilli)
    const quote = await quoteMilli()
    if (quote === null) return NextResponse.json({ error: '요금을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, { status: 503 })
    if (Number.isFinite(shown) && shown > 0 && quote > shown) {
      return NextResponse.json({ error: '요금이 바뀌었어요. 새 요금을 확인해 주세요.', creditsMilli: quote }, { status: 409 })
    }

    const res = await fetch(`${SUITE_API_BASE}/v1/ai/images`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        serviceId: 'cookieplay', model: ALBUM_ART_MODEL, prompt,
        ratio: '1:1', resolution: '1K', quality: 'medium', numImages: 1,
        idempotencyKey: `albumart:${user.id}:${requestId}`,
        maxCreditsMilli: quote,
        meta: { title: '앨범아트' },
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.status === 402) return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
    if (!res.ok || !data?.taskId) {
      return NextResponse.json({ error: data?.error?.message || data?.message || '만들지 못했어요. 크레딧은 빠지지 않았어요.' }, { status: res.status >= 400 && res.status < 600 ? res.status : 502 })
    }
    return NextResponse.json({ taskId: data.taskId, creditsMilli: data.creditsMilli ?? quote, balanceMilli: data.balanceMilli ?? null })
  } catch (err) {
    console.error('album-art POST error:', err)
    return NextResponse.json({ error: '시작하지 못했어요.' }, { status: 500 })
  }
}
