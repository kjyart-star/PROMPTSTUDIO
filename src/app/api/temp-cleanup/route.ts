import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('로그인이 필요합니다. (Please log in first)', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    let targetUserId = user.id

    // If attempting to clean up another user's history, verify admin privileges
    if (userIdParam && userIdParam !== user.id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profileData?.is_admin) {
        targetUserId = userIdParam
      } else {
        return new NextResponse('권한이 없습니다. (Forbidden)', { status: 403 })
      }
    }

    // 15분 이전의 모든 song_history 레코드 삭제
    const timeLimit = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    
    const { error } = await supabase
      .from('song_history')
      .delete()
      .eq('user_id', targetUserId)
      .lt('created_at', timeLimit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 정리 완료 후 스튜디오 보관함으로 리다이렉트
    // Only allow same-origin relative paths to prevent open-redirect abuse.
    const requested = searchParams.get('redirect') || '/studio?tab=library'
    const safeRedirect =
      requested.startsWith('/') && !requested.startsWith('//')
        ? requested
        : '/studio?tab=library'
    return NextResponse.redirect(new URL(safeRedirect, request.url))
  } catch (err: any) {
    return new NextResponse('오류 발생: ' + err.message, { status: 500 })
  }
}
