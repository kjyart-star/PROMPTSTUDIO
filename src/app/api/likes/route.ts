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
      .maybeSingle()

    let nextLiked = true;
    let currentLikeCount = 0;

    if (song) {
      // 2. 좋아요 토글 처리 (form jsonb 필드 내에 like_count 저장)
      nextLiked = !song.liked
      const currentForm = song.form || {}
      currentLikeCount = Number(currentForm.like_count || (song.liked ? 1 : 0))
      
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

      // (Optional) 혹시 tracks 테이블이 존재한다면 fallback 업데이트
      try {
        await supabase
          .from('tracks')
          .update({ like_count: currentLikeCount })
          .eq('id', track_id)
      } catch (e) {}

    } else {
      // 만약 song_history에 없다면 (채널에 등록된 앨범 내의 track일 경우)
      const { data: track } = await supabase
        .from('tracks')
        .select('like_count')
        .eq('id', track_id)
        .maybeSingle()

      if (!track) {
        return NextResponse.json({ error: 'Song not found' }, { status: 404 })
      }

      // 2. tracks 테이블용 좋아요 토글 처리
      // tracks 테이블 자체에는 현재 유저가 좋아요를 눌렀는지 여부(liked)를 알 수 없으나, 
      // 클라이언트에서 호출될 때는 토글이므로 현재 like_count를 조정합니다.
      // 더 정확히 하려면 userLikes 배열(likes 테이블)을 조회해야 합니다.
      
      const { data: userLike } = await supabase
        .from('likes')
        .select('*')
        .eq('track_id', track_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (userLike) {
        // 이미 좋아요를 누른 상태이므로 취소
        await supabase.from('likes').delete().eq('id', userLike.id)
        nextLiked = false
        currentLikeCount = Math.max(0, (track.like_count || 0) - 1)
      } else {
        // 좋아요 추가
        await supabase.from('likes').insert({ track_id: track_id, user_id: user.id })
        nextLiked = true
        currentLikeCount = (track.like_count || 0) + 1
      }

      await supabase
        .from('tracks')
        .update({ like_count: currentLikeCount })
        .eq('id', track_id)
    }

    return NextResponse.json({ liked: nextLiked, like_count: currentLikeCount })
  } catch (err: any) {
    console.error('Error toggling like:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
