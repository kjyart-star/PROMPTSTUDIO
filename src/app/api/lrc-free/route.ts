import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LRC_AUTO_VERSION, LRC_CF_MODEL, lyricsOfItem } from '@/lib/studio/lyricsOf'
import { alignLineTexts, validateAutoLrc } from '@/lib/player/lrcValidate'
import { finalizeAlignment, lowConfidenceOf, ONSET_LEAD_SEC } from '@/lib/player/lyricAlign'
import { freeJobsOf } from '@/lib/lyricsSync/freeQueue'
import { localFix, matchWords, type Word } from '@/lib/lyricsSync/match'
import { holdExpired, releaseIfSynced } from '@/lib/lyricsSync/publishGate'

/**
 * Workers AI 무료 큐(Cloudflare 워커 cookiemusic-lrc-free) 전용. 헤더 x-lrc-free-token 이 LRC_FREE_TOKEN 과 같아야 한다.
 * 뉴런 상한(하루 9,000)은 워커가 D1 로 지킨다 — 이 라우트는 Workers AI 를 부르지 않는다.
 * GET  ?limit=          — 채우기(공개 대기·폰에서 만든 곡 먼저)와 검수 작업, 음원 주소
 * POST {action:'sweep'} — 공개 대기 24시간이 지난 곡을 싱크 없이 공개(일반 가사만 표시)
 * GET  ?probe=<id>     — 운영 검증용: 결과가 이미 있는 곡도 작업으로 돌려준다(kind 'probe')
 * POST {song_id, kind:'fill'|'audit'|'probe', words:[{word,start,end}], neurons}
 *   probe: fill 과 같은 계산을 하되 저장하지 않고 결과만 돌려준다(저장된 결과를 비우지도 바꾸지도 않는다)
 *   fill : 받아쓰기를 원문과 맞춰 시간표를 만들고 검증 뒤 저장, 공개 대기 중이면 공개
 *   audit: 브라우저 결과를 받아쓰기로 ±20초 보정, 크게 어긋나면 「가사 시간 확인」 표시
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLS = 'id, title, created_at, lyrics, form, audio_url, is_published, trashed_at, status'

function authorized(request: Request): boolean {
  const want = process.env.LRC_FREE_TOKEN
  return !!want && want.length >= 24 && request.headers.get('x-lrc-free-token') === want
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

function wordsOf(input: unknown): Word[] | null {
  if (!Array.isArray(input) || input.length > 5000) return null
  const out: Word[] = []
  for (const w of input) {
    const start = Number((w as any)?.start), end = Number((w as any)?.end)
    if (typeof (w as any)?.word !== 'string' || !isFinite(start) || !isFinite(end)) return null
    out.push({ word: (w as any).word.slice(0, 60), start, end })
  }
  return out
}

async function loadRows(db: ReturnType<typeof admin>) {
  return db.from('song_history').select(COLS).eq('status', 'completed').is('trashed_at', null).limit(5000)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = admin()
    const sp = new URL(request.url).searchParams
    const limit = Math.min(10, Math.max(1, Number(sp.get('limit')) || 3))
    const { data, error } = await loadRows(db)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const probe = sp.get('probe')
    if (probe) {
      const r = (data ?? []).find((x: any) => x.id === probe) as any
      const lines = r ? alignLineTexts(lyricsOfItem(r, data ?? [])) : []
      if (!r || lines.length < 2) return NextResponse.json({ jobs: [] })
      const url = await audioUrlOf(db, String(r.audio_url), !!r.is_published)
      return NextResponse.json({ jobs: url ? [{ id: r.id, kind: 'probe', audio_url: url, lines, duration: Number(r.form?.duration_sec ?? r.form?.duration) || null }] : [] })
    }
    const { fill, audit } = freeJobsOf(data ?? [])
    const out = []
    for (const j of [...fill, ...audit].slice(0, limit)) {
      const url = await audioUrlOf(db, j.audio, j.is_published)
      if (url) out.push({ id: j.id, kind: j.kind, audio_url: url, lines: j.lines, duration: j.duration })
    }
    return NextResponse.json({ fill: fill.length, audit: audit.length, jobs: out })
  } catch (err) {
    console.error('API GET lrc-free error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = admin()
    const body = await request.json().catch(() => null)

    if (body?.action === 'sweep') {
      const { data, error } = await db.from('song_history').select('id, form').not('form->publish_pending', 'is', null).limit(1000)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      let released = 0
      for (const r of data ?? []) {
        if (!holdExpired((r as any).form)) continue
        const form = { ...(r as any).form, lrc_sync_skipped: { at: new Date().toISOString() } }
        delete form.publish_pending
        const up = await db.from('song_history').update({ is_published: true, form }).eq('id', (r as any).id)
        if (!up.error) released++
      }
      return NextResponse.json({ ok: true, released })
    }

    const songId = body?.song_id
    if (typeof songId !== 'string' || !UUID.test(songId)) return NextResponse.json({ error: 'bad song_id' }, { status: 400 })
    const words = wordsOf(body?.words)
    if (!words || !['fill', 'audit', 'probe'].includes(body?.kind)) return NextResponse.json({ error: 'bad body' }, { status: 400 })
    if (body.kind === 'probe') {
      // 검증용 — 계산만 하고 저장하지 않는다
      const { data: one } = await db.from('song_history').select(COLS).eq('id', songId).maybeSingle()
      const lines = one ? alignLineTexts(lyricsOfItem(one)) : []
      if (lines.length < 2) return NextResponse.json({ ok: false, reason: 'no-lyrics' })
      const f = (one as any).form ?? {}
      const dur = Number(f.duration_sec ?? f.duration) || null
      const raw = matchWords(words, lines)
      const starts = finalizeAlignment(raw.map((v) => (v === null ? null : v + ONSET_LEAD_SEC)), dur ?? (raw.filter((v) => v !== null).pop() ?? 0) + 30)
      const check = starts ? validateAutoLrc(lines.map((text, i) => ({ t: starts[i], text })), { durationSec: dur, expectedTexts: lines }) : null
      return NextResponse.json({ ok: !!check?.ok, reason: check && !check.ok ? check.reason : undefined, matched: raw.filter((v) => v !== null).length, total: lines.length, lines: check?.ok ? check.lines : null, stored: Array.isArray(f.lrc_auto) ? f.lrc_auto.map((l: any) => l.t) : null })
    }
    const { data: rows, error } = await loadRows(db)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const job = [...freeJobsOf(rows ?? [], Date.now() + 3600_000).fill, ...freeJobsOf(rows ?? []).audit].find((j) => j.id === songId && j.kind === body.kind)
    if (!job) return NextResponse.json({ ok: true, stored: false, reason: 'not-pending' })
    const song = (rows ?? []).find((r: any) => r.id === songId) as any
    const form = { ...(song.form ?? {}) }
    const dur = Number(form.duration_sec ?? form.duration) || null
    const now = new Date().toISOString()

    if (body.kind === 'fill') {
      const raw = matchWords(words, job.lines)
      // 받아쓰기 시각은 소리 시작 그대로라 강제 정렬용 앞당김(ONSET_LEAD_SEC)을 되돌려 넣는다 — 화면이 0.3초 먼저 켠다
      const starts = finalizeAlignment(raw.map((v) => (v === null ? null : v + ONSET_LEAD_SEC)), dur ?? (raw.filter((v) => v !== null).pop() ?? 0) + 30)
      const check = starts ? validateAutoLrc(job.lines.map((text, i) => ({ t: starts[i], text })), { durationSec: dur, expectedTexts: job.lines }) : null
      if (!check?.ok) {
        form.lrc_free_fail = { at: now, reason: check ? check.reason : 'too-few-lines' }
        await db.from('song_history').update({ form }).eq('id', songId)
        return NextResponse.json({ ok: true, stored: false, reason: form.lrc_free_fail.reason })
      }
      form.lrc_auto = check.lines
      form.lrc_auto_v = LRC_AUTO_VERSION
      form.lrc_auto_model = LRC_CF_MODEL
      delete form.lrc_free_fail
      if (lowConfidenceOf(raw)) form.lrc_review = { reason: 'low-confidence', at: now }
      const rel = releaseIfSynced(form)
      const up = await db.from('song_history').update({ form: rel.form ?? form, ...(rel.is_published ? { is_published: true } : {}) }).eq('id', songId)
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })
      if (song.is_published || rel.is_published) {
        await db.from('song_lrc_auto').upsert({ song_id: songId, v: LRC_AUTO_VERSION, lrc: check.lines, model: LRC_CF_MODEL, submitted_by: null }, { onConflict: 'song_id,v' })
      }
      return NextResponse.json({ ok: true, stored: true, released: !!rel.is_published, review: !!form.lrc_review })
    }

    // audit: 브라우저 결과를 받아쓰기로 근처 보정
    const cur = Array.isArray(form.lrc_auto) ? form.lrc_auto as { t: number; text: string }[] : []
    const fix = localFix(cur.map((l) => l.t), words, job.lines)
    const enough = fix.found >= Math.ceil(job.lines.length * 0.5)
    const bad = enough && (fix.medianDiff ?? 0) > 2
    form.lrc_audit = { at: now, found: fix.found, moved: fix.moved, med: fix.medianDiff === null ? null : Math.round(fix.medianDiff * 100) / 100 }
    if (bad) form.lrc_review = { reason: 'audit-mismatch', at: now }
    let fixed = false
    if (fix.moved > 0 && !bad) {
      const check = validateAutoLrc(cur.map((l, i) => ({ ...l, t: fix.starts[i] })), { durationSec: dur, expectedTexts: job.lines })
      if (check.ok) { form.lrc_auto = check.lines; form.lrc_auto_model = `${form.lrc_auto_model}+cf-fix`; fixed = true }
    }
    const up = await db.from('song_history').update({ form }).eq('id', songId)
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })
    if (fixed && song.is_published) {
      await db.from('song_lrc_auto').upsert({ song_id: songId, v: LRC_AUTO_VERSION, lrc: form.lrc_auto, model: form.lrc_auto_model, submitted_by: null }, { onConflict: 'song_id,v' })
    }
    return NextResponse.json({ ok: true, audited: true, moved: fixed ? fix.moved : 0, review: bad })
  } catch (err) {
    console.error('API POST lrc-free error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
