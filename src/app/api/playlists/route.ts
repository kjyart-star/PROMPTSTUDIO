import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('all') === 'true'

    let query = supabase
      .from('user_playlists')
      .select('*')

    if (fetchAll) {
      // 관리자 권한 확인
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (roleData?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      
      // 관리자는 모든 공개된 앨범을 조회할 수 있음 (규정 위반 단속용)
      query = query.eq('is_published', true)
    } else {
      // 일반 사용자는 본인 앨범만 조회
      query = query.eq('user_id', user.id)
    }

    let result = await query
      .order('exposure_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (result.error && result.error.code === '42703') {
      // Fallback if exposure_order column does not exist in user_playlists table yet
      result = await query
        .order('created_at', { ascending: false })
    }

    const { data, error } = result

    if (error) {
      console.error('API GET playlists DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API GET playlists error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, cover_url, description, genre, is_published, exposure_order } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('user_playlists')
      .insert({
        user_id: user.id,
        title,
        cover_url: cover_url || '/default-album.png',
        description: description || '',
        genre: genre || '',
        is_published: is_published !== undefined ? is_published : false,
        exposure_order: exposure_order !== undefined ? exposure_order : null
      })
      .select()
      .single()

    if (error) {
      console.error('API POST playlists DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST playlists error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
