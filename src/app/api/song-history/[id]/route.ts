import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { is_published, playlist_id, liked } = body

    // 1. 소유권 확인
    const { data: songCheck } = await supabase
      .from('song_history')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!songCheck) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    const isOwner = songCheck.user_id === user.id

    // 2. 관리자 권한 확인
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    const isAdmin = !!profileData?.is_admin

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 소유자가 아니고 관리자일 경우, 오직 'is_published'만 수정 가능하도록 제한
    const updateData: any = {}
    if (!isOwner && isAdmin) {
      if (playlist_id !== undefined) {
        return NextResponse.json({ error: 'Admins can only change the publishing status of other users\' songs.' }, { status: 403 })
      }
      if (is_published !== undefined) updateData.is_published = is_published
    } else {
      // 소유자인 경우 모든 항목 수정 가능
      if (is_published !== undefined) updateData.is_published = is_published
      if (playlist_id !== undefined) updateData.playlist_id = playlist_id
      if (liked !== undefined) updateData.liked = liked
    }

    const { data, error } = await supabase
      .from('song_history')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API PUT song_history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
