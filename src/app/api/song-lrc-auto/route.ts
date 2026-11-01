import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LRC_AUTO_VERSION, LRC_BROWSER_MODEL, ownLyrics } from '@/lib/studio/lyricsOf'
import { alignLineTexts, validateAutoLrc } from '@/lib/player/lrcValidate'

/**
 * 공개 곡 가사 자동 맞춤 결과 공유(song_lrc_auto).
 * GET  ?id=&v=  — 누구나(공개 곡만 RLS 로 보임). 공유 행이 없으면 볼 수 있는 곡의 form.lrc_auto(같은 판). 없으면 404.
 * POST {song_id, lrc, v} — 로그인 사용자. 공개 곡이고, 가사 줄과 같고, 시간이 단조 증가하며 곡 길이 안일 때만 받는다.
 *   곡당(판 번호당) 첫 유효값 하나만 쓴다 — 이미 있으면 200 {stored:false}. 원곡 song_history 는 수정하지 않는다.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  const v = Number(searchParams.get('v') ?? LRC_AUTO_VERSION)
  if (!UUID.test(id) || !Number.isInteger(v)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const supabase = await createClient()
  const { data } = await supabase.from('song_lrc_auto').select('lrc, v').eq('song_id', id).eq('v', v).maybeSingle()
  if (data) return NextResponse.json({ lrc: data.lrc, v: data.v }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  // 비공개 곡은 공유 테이블이 보이지 않는다 — 볼 수 있는 곡(소유자 등, RLS)이면 곡 기록의 자동 맞춤 결과를 준다
  const { data: song } = await supabase.from('song_history').select('form').eq('id', id).maybeSingle()
  const f = (song as any)?.form
  if (f?.lrc_auto_v === v && Array.isArray(f?.lrc_auto) && f.lrc_auto.length >= 2) {
    return NextResponse.json({ lrc: f.lrc_auto, v }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  }
  return NextResponse.json({ error: 'not found' }, { status: 404 })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const songId = body?.song_id
    if (typeof songId !== 'string' || !UUID.test(songId)) return NextResponse.json({ error: 'bad song_id' }, { status: 400 })
    if (body?.v !== LRC_AUTO_VERSION) return NextResponse.json({ error: 'version mismatch' }, { status: 409 })

    const { data: song } = await supabase
      .from('song_history')
      .select('id, is_published, lyrics, form')
      .eq('id', songId)
      .maybeSingle()
    if (!song || !song.is_published) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

    const { data: existing } = await supabase.from('song_lrc_auto').select('song_id').eq('song_id', songId).eq('v', LRC_AUTO_VERSION).maybeSingle()
    if (existing) return NextResponse.json({ ok: true, stored: false })

    const f = (song as any).form
    const dur = Number(f?.duration_sec ?? f?.duration) || null
    const check = validateAutoLrc(body?.lrc, { durationSec: dur, expectedTexts: alignLineTexts(ownLyrics(song)) })
    if (!check.ok) return NextResponse.json({ error: 'invalid lrc', reason: check.reason }, { status: 422 })

    const { error } = await supabase.from('song_lrc_auto').insert({
      song_id: songId, lrc: check.lines, v: LRC_AUTO_VERSION, model: LRC_BROWSER_MODEL, submitted_by: user.id,
    })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true, stored: false }) // 동시에 온 다른 제출이 먼저 들어감
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, stored: true })
  } catch (err) {
    console.error('API POST song-lrc-auto error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
