import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { track_id, duration_played } = body

    if (!track_id || typeof duration_played !== 'number') {
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

    // 2. song_history 테이블의 form 내 play_count 증가
    try {
      const { data: song } = await supabase
        .from('song_history')
        .select('*')
        .eq('id', track_id)
        .single()

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
      }
    } catch (songHistoryErr) {
      console.warn("failed to update play_count in song_history:", songHistoryErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error logging play event:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
