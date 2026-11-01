import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { LRC_AUTO_VERSION, LRC_MIN_READ_VERSION, lrcAutoFailed, lrcAutoReadable } from '@/lib/studio/lyricsOf'

/**
 * 곡 가사 시간표 — 웹과 앞으로 만들 앱(iOS·Android)이 같은 API 를 쓴다. 재생 쪽은 이 값을 표시만 한다.
 * GET /api/lyrics-sync/{songId} → 200 { song_id, v, source:'user'|'auto', model, lines:[{t,end?,conf?,text}], words? }
 *   - 사람이 고친 시간표(form.lrc, lrc_by=user) → 공개 결과(song_lrc_auto) → 곡 기록의 자동 결과(form.lrc_auto) 순.
 *   - { failed:true } = 믿을 수 없다고 접은 곡(일반 가사로 표시), { pending:true } = 가사 싱크 처리 중(공개 대기).
 *   - 볼 수 있는 곡만(공개 곡·곡 주인, RLS). ETag 를 붙여 같은 값이면 304(모바일 데이터 절약).
 */
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function reply(request: Request, body: unknown, status = 200) {
  const json = JSON.stringify(body)
  const etag = `W/"${createHash('sha1').update(json).digest('base64url')}"`
  const headers = { ETag: etag, 'Cache-Control': 'private, max-age=60, must-revalidate', 'Content-Type': 'application/json' }
  if (status === 200 && request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(json, { status, headers })
}

export async function GET(request: Request, { params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params
  if (!UUID.test(songId)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  try {
    const supabase = await createClient()
    const { data: song } = await supabase.from('song_history').select('id, form').eq('id', songId).maybeSingle()
    if (!song) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const f = (song as any).form ?? {}
    const review = !!f.lrc_review
    if (f.lrc_by === 'user' && Array.isArray(f.lrc) && f.lrc.length >= 2) {
      return reply(request, { song_id: songId, v: LRC_AUTO_VERSION, source: 'user', model: 'user', lines: f.lrc })
    }
    if (lrcAutoFailed(f)) return reply(request, { song_id: songId, failed: true })
    const { data: shared } = await supabase.from('song_lrc_auto').select('lrc, v, model').eq('song_id', songId)
      .gte('v', LRC_MIN_READ_VERSION).lte('v', LRC_AUTO_VERSION).order('v', { ascending: false }).limit(1).maybeSingle()
    const fromForm = lrcAutoReadable(f.lrc_auto_v) && Array.isArray(f.lrc_auto) && f.lrc_auto.length >= 2
    // 곡 기록 쪽이 같거나 새 판이면 그쪽(단어 시각까지 있음), 아니면 공유 결과
    if (fromForm && (!shared || Number(f.lrc_auto_v) >= Number((shared as any).v))) {
      const words = Array.isArray(f.lrc_auto_words) && f.lrc_auto_words.length === f.lrc_auto.length ? f.lrc_auto_words : undefined
      return reply(request, { song_id: songId, v: f.lrc_auto_v, source: 'auto', model: f.lrc_auto_model ?? null, lines: f.lrc_auto, ...(words ? { words } : {}), ...(review ? { review } : {}) })
    }
    if (shared) return reply(request, { song_id: songId, v: (shared as any).v, source: 'auto', model: (shared as any).model ?? null, lines: (shared as any).lrc, ...(review ? { review } : {}) })
    if (f.publish_pending) return reply(request, { song_id: songId, pending: true }, 404)
    return reply(request, { song_id: songId, error: 'not found' }, 404)
  } catch (err) {
    console.error('API GET lyrics-sync error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
