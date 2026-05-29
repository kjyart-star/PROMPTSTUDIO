import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    const targetUserId = user?.id || userIdParam

    if (!targetUserId) {
      return new NextResponse('로그인이 필요합니다. (Please log in first or provide userId parameter)', { status: 401 })
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
    const redirectUrl = searchParams.get('redirect') || '/studio?tab=library'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (err: any) {
    return new NextResponse('오류 발생: ' + err.message, { status: 500 })
  }
}
