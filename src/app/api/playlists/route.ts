import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils'
import { withBase } from '@/lib/basePath'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('all') === 'true'
    const typeFilter = searchParams.get('type') // 'album' | 'playlist'

    // 조인 쿼리 대신 단순 select로 에러 방지
    let query = supabase
      .from('user_playlists')
      .select('*')

    if (fetchAll) {
      // 관리자 권한 확인
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profileData?.is_admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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

    let filteredData = data || []
    
    // fetchAll이 true이면 profiles 테이블에서 사용자 목록을 추가로 가져와 인메모리에서 결합
    if (fetchAll && filteredData.length > 0) {
      const userIds = Array.from(new Set(filteredData.map(item => item.user_id)))
      let profiles: any[] | null = null
      let profilesErr: any = null

      const res = await supabase
        .from('profiles')
        .select('id, display_name, is_banned')
        .in('id', userIds)

      if (res.error && res.error.code === '42703') {
        const fallback = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds)
        if (!fallback.error && fallback.data) {
          profiles = fallback.data.map(p => ({ ...p, is_banned: false }))
        } else {
          profilesErr = fallback.error
        }
      } else {
        profiles = res.data
        profilesErr = res.error
      }
      
      if (!profilesErr && profiles) {
        const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
        filteredData = filteredData.map(item => ({
          ...item,
          profiles: profileMap.get(item.user_id) || null
        }))
      }
    }

    if (typeFilter === 'playlist') {
      filteredData = filteredData.filter(item => item.description?.startsWith('[playlist]'))
    } else if (typeFilter === 'album') {
      filteredData = filteredData.filter(item => !item.description?.startsWith('[playlist]'))
    }

    // Add parent_id to the response by parsing the description
    filteredData = filteredData.map(item => {
      const parsed = parsePlaylistDescription(item.description)
      return {
        ...item,
        parent_id: parsed.parentId || null
      }
    })

    return NextResponse.json(filteredData)
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
    const { title, cover_url, description, genre, is_published, exposure_order, parent_id, type } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    // Default to playlist if parent_id is provided, otherwise let caller specify description
    // If description is already serialized, use it, else serialize it
    let finalDescription = description || '';
    if (parent_id !== undefined || type === 'playlist') {
      const descObj = parsePlaylistDescription(description);
      finalDescription = serializePlaylistDescription('playlist', descObj.text || description || '', parent_id || descObj.parentId);
    }

    const { data, error } = await supabase
      .from('user_playlists')
      .insert({
        user_id: user.id,
        title,
        cover_url: cover_url || withBase('/default-album.png'),
        description: finalDescription,
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
    
    const parsed = parsePlaylistDescription(data.description)
    data.parent_id = parsed.parentId || null;

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST playlists error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
