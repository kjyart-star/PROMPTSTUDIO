import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePlaylistDescription, serializePlaylistDescription } from '@/lib/utils'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, cover_url, is_published, description, genre, exposure_order, parent_id, type, channel_id } = body

    // 1. 앨범 소유권 확인
    const { data: playlistCheck } = await supabase
      .from('user_playlists')
      .select('user_id, description')
      .eq('id', id)
      .single()

    if (!playlistCheck) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const isOwner = playlistCheck.user_id === user.id

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
      if (title !== undefined || cover_url !== undefined || description !== undefined || genre !== undefined || exposure_order !== undefined || parent_id !== undefined || channel_id !== undefined) {
        return NextResponse.json({ error: 'Admins can only change the publishing status of other users\' playlists.' }, { status: 403 })
      }
      if (is_published !== undefined) updateData.is_published = is_published
    } else {
      // 소유자인 경우 모든 항목 수정 가능
      if (title !== undefined) updateData.title = title
      if (cover_url !== undefined) updateData.cover_url = cover_url
      if (is_published !== undefined) updateData.is_published = is_published
      if (genre !== undefined) updateData.genre = genre
      if (exposure_order !== undefined) updateData.exposure_order = exposure_order

      // Handle description, parent_id, and channel_id merging
      if (description !== undefined || parent_id !== undefined || type !== undefined || channel_id !== undefined) {
        const currentParsed = parsePlaylistDescription(playlistCheck.description);
        const newText = description !== undefined ? parsePlaylistDescription(description).text : currentParsed.text;
        const newParentId = parent_id !== undefined ? parent_id : currentParsed.parentId;
        const newType = type !== undefined ? type : currentParsed.type;
        const newChannelId = channel_id !== undefined ? channel_id : currentParsed.channelId;
        
        updateData.description = serializePlaylistDescription(newType, newText, newParentId, newChannelId);
      }
    }

    const { data, error } = await supabase
      .from('user_playlists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('API PUT playlist DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const parsed = parsePlaylistDescription(data.description)
    data.parent_id = parsed.parentId || null;

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API PUT playlist error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // 1. Move all songs in this playlist to null (default folder)
    await supabase
      .from('song_history')
      .update({ playlist_id: null })
      .eq('playlist_id', id)
      .eq('user_id', user.id)

    // 2. Delete the playlist
    const { error } = await supabase
      .from('user_playlists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API DELETE playlist error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
