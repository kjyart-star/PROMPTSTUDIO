import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch all song histories for the authenticated user (or all published songs for admin)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('all') === 'true'

    let query = supabase
      .from('song_history')
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

      // 관리자는 모든 공개된 곡을 조회할 수 있음 (규정 위반 단속용)
      query = query.eq('is_published', true)
    } else {
      // 일반 사용자는 본인 음원 기록만 조회
      query = query.eq('user_id', user.id)
      
      // 임시: 사용자가 생성하지 않은 더미 데이터(비 오는 밤의 드라이브) 자동 삭제
      await supabase.from('song_history').delete()
        .eq('user_id', user.id)
        .eq('title', '비 오는 밤의 드라이브')
    }

    let result = await query
      .order('exposure_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (result.error && result.error.code === '42703') {
      // Fallback if exposure_order column does not exist in song_history table yet
      result = await query
        .order('created_at', { ascending: false })
    }

    const { data, error } = result

    if (error) {
      console.error('Error fetching song history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    console.error('API GET song-history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: Add a new song history entry
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, prompt, lyrics, notes, negative_prompt, form } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const updatedForm = { ...form, negativePrompt: negative_prompt }
    const { data, error } = await supabase
      .from('song_history')
      .insert({
        user_id: user.id,
        title,
        prompt: prompt || '',
        lyrics: lyrics || '',
        notes: notes || '',
        form: updatedForm
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting song history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST song-history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: Remove a song history entry
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('song_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting song history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API DELETE song-history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
