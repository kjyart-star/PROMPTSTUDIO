import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { track_id } = await request.json()
    if (!track_id) {
      return NextResponse.json({ error: 'track_id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    // 1. song_history에서 해당 곡 조회
    const { data: song, error: fetchErr } = await supabase
      .from('song_history')
      .select('*')
      .eq('id', track_id)
      .single()

    if (fetchErr || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    // 2. 좋아요 토글 처리 (form jsonb 필드 내에 like_count 저장)
    const nextLiked = !song.liked
    const currentForm = song.form || {}
    let currentLikeCount = Number(currentForm.like_count || (song.liked ? 1 : 0))
    
    if (nextLiked) {
      currentLikeCount += 1
    } else {
      currentLikeCount = Math.max(0, currentLikeCount - 1)
    }

    const updatedForm = {
      ...currentForm,
      like_count: currentLikeCount
    }

    // 3. song_history 테이블 업데이트
    const { error: updateErr } = await supabase
      .from('song_history')
      .update({
        liked: nextLiked,
        form: updatedForm
      })
      .eq('id', track_id)

    if (updateErr) throw updateErr

    // 4. (Optional) 혹시 tracks 테이블이 존재한다면 fallback 업데이트
    try {
      await supabase
        .from('tracks')
        .update({ like_count: currentLikeCount })
        .eq('id', track_id)
    } catch (e) {
      // Ignore missing tracks table error
    }

    return NextResponse.json({ liked: nextLiked, like_count: currentLikeCount })
  } catch (err: any) {
    console.error('Error toggling like:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
