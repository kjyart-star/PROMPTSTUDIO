import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper to verify if the requesting user is an admin
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return !!data.is_admin
}

// PUT / POST: Ban or Unban a user (Admin only)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await checkAdmin(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { target_user_id, is_banned } = body

    if (!target_user_id || is_banned === undefined) {
      return NextResponse.json({ error: 'target_user_id and is_banned are required' }, { status: 400 })
    }

    // 1. 프로필의 is_banned 상태 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_banned })
      .eq('id', target_user_id)

    if (profileError) {
      console.error('Error updating user ban status:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 2. 사용자를 차단(is_banned = true)하는 경우, 이 사용자가 올린 모든 음원 및 앨범 퍼블리싱 해제(비공개) 처리
    if (is_banned) {
      const [songErr, playlistErr] = await Promise.all([
        supabase
          .from('song_history')
          .update({ is_published: false })
          .eq('user_id', target_user_id),
        supabase
          .from('user_playlists')
          .update({ is_published: false })
          .eq('user_id', target_user_id)
      ])

      if (songErr.error) console.error('Error unpublishing banned user songs:', songErr.error)
      if (playlistErr.error) console.error('Error unpublishing banned user playlists:', playlistErr.error)
    }

    return NextResponse.json({ success: true, target_user_id, is_banned })
  } catch (err: any) {
    console.error('API PUT user-ban error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
