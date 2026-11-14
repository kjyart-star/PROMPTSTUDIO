import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// 임시 기록 정리: POST 전용, 관리자 세션 또는 크론 비밀 헤더(Authorization: Bearer CRON_SECRET)만.
// 지우는 대상은 「재생할 음원이 없는(audio_url 없음) 비공개 기록 중 15분이 지난 것」뿐이다.
// 음원이 있는 곡·공개 곡·휴지통 곡은 어떤 경우에도 지우지 않는다(사용자 음원 삭제 금지).

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    const isCron = !!cronSecret && !!bearer && safeEqual(bearer, cronSecret)

    let targetUserId: string | null = null
    let db: any

    if (isCron) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
      db = createServiceClient(url, key, { auth: { persistSession: false } })
    } else {
      const origin = request.headers.get('origin')
      if (origin && new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      const { data: profileData } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profileData?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const body = await request.json().catch(() => ({}))
      targetUserId = typeof body?.userId === 'string' ? body.userId : user.id
      db = supabase
    }

    const timeLimit = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    let q = db
      .from('song_history')
      .delete()
      .is('audio_url', null)
      .eq('is_published', false)
      .is('trashed_at', null)
      .lt('created_at', timeLimit)
    if (targetUserId) q = q.eq('user_id', targetUserId)
    const { error } = await q

    if (error) return NextResponse.json({ error: 'cleanup_failed' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
