import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LRC_AUTO_VERSION, LRC_GPU_MODEL } from '@/lib/studio/lyricsOf'
import { validateAutoLrc } from '@/lib/player/lrcValidate'
import { hasUserLrc, lrcJobsOf } from '@/lib/player/lrcWorkerJobs'

/**
 * 회사 PC 가사 정렬 워커 전용(사전 계산). 헤더 x-lrc-worker-token 이 LRC_WORKER_TOKEN 과 같아야 한다.
 * GET  ?limit=  — 아직 GPU 정렬을 받지 못한 곡 목록(최신순)과 진행률 {total, done}. 음원은 내려받을 수 있는 주소로 준다.
 * POST {song_id, lrc, v, model} — 검증 뒤 소유자 곡의 form.lrc_auto(판 번호·모델)와 song_lrc_auto 에 저장한다.
 *   새 필드·새 테이블에만 쓴다(가사·음원·사용자 시간표는 건드리지 않는다). 사용자 시간표가 있는 곡은 저장하지 않는다.
 */
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function authorized(request: Request): boolean {
  const want = process.env.LRC_WORKER_TOKEN
  return !!want && want.length >= 24 && request.headers.get('x-lrc-worker-token') === want
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('service key missing')
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } })
}

async function audioUrlOf(db: ReturnType<typeof admin>, path: string, published: boolean): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path
  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE
  if (r2 && published) return `${r2.replace(/\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`
  const { data } = await db.storage.from('tracks').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

const COLS = 'id, title, created_at, lyrics, form, audio_url, is_published, trashed_at, status'

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = admin()
    const limit = Math.min(20, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 5))
    const { data, error } = await db.from('song_history').select(COLS).limit(5000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { jobs, total, done } = lrcJobsOf(data ?? [])
    const out = []
    for (const j of jobs.slice(0, limit)) {
      const url = await audioUrlOf(db, j.audio, j.is_published)
      if (url) out.push({ id: j.id, title: j.title, audio_url: url, lines: j.lines, duration: j.duration })
    }
    return NextResponse.json({ v: LRC_AUTO_VERSION, model: LRC_GPU_MODEL, total, done, pending: jobs.length, jobs: out })
  } catch (err: any) {
    console.error('API GET lrc-worker error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    const songId = body?.song_id
    if (typeof songId !== 'string' || !UUID.test(songId)) return NextResponse.json({ error: 'bad song_id' }, { status: 400 })
    if (body?.v !== LRC_AUTO_VERSION || body?.model !== LRC_GPU_MODEL) return NextResponse.json({ error: 'version mismatch' }, { status: 409 })
    const db = admin()
    const { data: rows, error } = await db.from('song_history').select(COLS).limit(5000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const song = (rows ?? []).find((r: any) => r.id === songId)
    if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    const lines = lrcJobsOf(rows ?? []).jobs.find((j) => j.id === songId)?.lines
    if (hasUserLrc(song.form)) return NextResponse.json({ ok: true, stored: false, reason: 'user-lrc' })
    if (!lines) return NextResponse.json({ ok: true, stored: false, reason: 'not-pending' })
    const f = song.form && typeof song.form === 'object' ? song.form : {}
    const check = validateAutoLrc(body?.lrc, { durationSec: Number(f.duration_sec ?? f.duration) || null, expectedTexts: lines })
    if (!check.ok) return NextResponse.json({ error: 'invalid lrc', reason: check.reason }, { status: 422 })

    // 소유자 곡 form 에 새 필드만 더한다(다른 키는 그대로)
    const { data: fresh } = await db.from('song_history').select('form').eq('id', songId).maybeSingle()
    const base = fresh?.form && typeof fresh.form === 'object' ? { ...fresh.form } : {}
    if (hasUserLrc(base)) return NextResponse.json({ ok: true, stored: false, reason: 'user-lrc' })
    base.lrc_auto = check.lines
    base.lrc_auto_v = LRC_AUTO_VERSION
    base.lrc_auto_model = LRC_GPU_MODEL
    const up = await db.from('song_history').update({ form: base }).eq('id', songId)
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })
    const sh = await db.from('song_lrc_auto').upsert(
      { song_id: songId, v: LRC_AUTO_VERSION, lrc: check.lines, model: LRC_GPU_MODEL, submitted_by: null },
      { onConflict: 'song_id,v' },
    )
    if (sh.error) return NextResponse.json({ error: sh.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, stored: true })
  } catch (err) {
    console.error('API POST lrc-worker error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
