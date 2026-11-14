import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { hit } from '@/lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { track_id, duration_played } = body

    if (typeof track_id !== 'string' || !UUID_RE.test(track_id) || typeof duration_played !== 'number' || !Number.isFinite(duration_played) || duration_played < 0 || duration_played > 86400) {
      return NextResponse.json({ error: 'invalid track_id or duration_played' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const ip_hash = crypto
      .createHash('sha256')
      .update(ip + (process.env.IP_SALT || 'suno-music-salt'))
      .digest('hex')
      .substring(0, 16)

    // 재생수 조작 방지(감사 M-2): 같은 IP 의 같은 곡은 1분에 3번까지, 같은 IP 전체는 1분에 60번까지만 센다.
    // 넘어도 오류로 알리지 않고 조용히 세지 않는다(정상 재생 UI 에 영향 없음). 인스턴스별 최선 노력 제한이다.
    if (!hit(`play:${ip_hash}:${track_id}`, 3, 60_000) || !hit(`play:${ip_hash}`, 60, 60_000)) {
      return NextResponse.json({ ok: true, counted: false })
    }

    // 1. play_events 테이블에 기록 시도 (존재하지 않으면 경고 출력 후 무시)
    try {
      await supabase.from('play_events').insert({
        track_id,
        user_id: user?.id ?? null,
        duration_played,
        ip_hash,
      })
    } catch (e) {
      console.warn("play_events table not found, skipping insert")
    }

    // 2. song_history 테이블의 form 내 play_count 증가, 또는 tracks 테이블의 play_count 증가
    try {
      const { data: song } = await supabase
        .from('song_history')
        .select('form')
        .eq('id', track_id)
        .maybeSingle()

      if (song) {
        const currentForm = song.form || {}
        const currentPlayCount = Number(currentForm.play_count || 0)
        const updatedForm = {
          ...currentForm,
          play_count: currentPlayCount + 1
        }
        await supabase
          .from('song_history')
          .update({ form: updatedForm })
          .eq('id', track_id)
      } else {
        // 만약 song_history에 없다면 (채널에 등록된 앨범 내의 track일 경우)
        const { data: track } = await supabase
          .from('tracks')
          .select('play_count')
          .eq('id', track_id)
          .maybeSingle()
          
        if (track) {
          await supabase
            .from('tracks')
            .update({ play_count: (track.play_count || 0) + 1 })
            .eq('id', track_id)
        }
      }
    } catch (songHistoryErr) {
      console.warn("failed to update play_count in song_history or tracks:", songHistoryErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error logging play event:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
