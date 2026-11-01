import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import NodeID3 from 'node-id3'
import { platformOfUA } from '@/lib/lyricsSync/platform'
import { kickFreeQueue } from '@/lib/lyricsSync/kick'

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
    const trashOnly = searchParams.get('trash') === '1'

    // 조인 쿼리 대신 단순 select로 에러 방지
    let query = supabase
      .from('song_history')
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
      // 일반 사용자는 본인 음원 기록만 조회
      query = query.eq('user_id', user.id)
    }

    // 휴지통: trashed_at 이 있는 곡은 기본 목록에서 빠지고 ?trash=1 로만 본다
    // (컬럼이 아직 없는 환경에서는 42703 → 필터 없이 다시 조회, 휴지통은 빈 목록)
    const baseQuery = query
    query = trashOnly ? baseQuery.not('trashed_at', 'is', null) : baseQuery.is('trashed_at', null)

    let result = await query
      .order('exposure_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (result.error && result.error.code === '42703' && trashOnly) {
      return NextResponse.json([])
    }
    if (result.error && result.error.code === '42703') {
      query = baseQuery
      result = await query
        .order('exposure_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
    }

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

    let listData = data || []

    // fetchAll이 true이면 profiles 테이블에서 사용자 목록을 추가로 가져와 인메모리에서 결합
    if (fetchAll && listData.length > 0) {
      const userIds = Array.from(new Set(listData.map(item => item.user_id)))
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
        listData = listData.map(item => ({
          ...item,
          profiles: profileMap.get(item.user_id) || null
        }))
      }
    }

    return NextResponse.json(listData)
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
    const {
      title,
      prompt,
      lyrics,
      notes,
      genre,
      audio_url,
      image_url,
      status,
      is_published,
      channel_id,
      form,
      negative_prompt
    } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    let finalImageUrl = image_url || ''

    // If no cover image was provided but we have an uploaded audio file,
    // try to extract the embedded cover image from its ID3 metadata.
    if (!finalImageUrl && audio_url && audio_url.startsWith('audio/')) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('tracks')
          .download(audio_url)

        if (!downloadError && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer())
          const tags = NodeID3.read(buffer)
          if (tags && tags.image && typeof tags.image !== 'string') {
            const mimeType = tags.image.mime || 'image/jpeg'
            const fileExt = mimeType.split('/').pop() || 'jpg'
            const imageFileName = `${user.id}-extracted-cover-${crypto.randomUUID()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(imageFileName, tags.image.imageBuffer, {
                contentType: mimeType
              })

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(imageFileName)
              if (publicUrlData?.publicUrl) {
                finalImageUrl = publicUrlData.publicUrl
              }
            }
          }
        }
      } catch (extractErr) {
        console.error('Failed to extract embedded cover art:', extractErr)
      }
    }

    // 만든(올린) 기기 — 폰에서 만든 곡은 브라우저가 가사 시간을 계산하지 않으므로 서버 무료 큐가 먼저 맞춘다
    const updatedForm = { ...(form || { negativePrompt: negative_prompt || '' }), client_platform: platformOfUA(request.headers.get('user-agent')) }
    const { data, error } = await supabase
      .from('song_history')
      .insert({
        user_id: user.id,
        title: title.trim(),
        prompt: prompt?.trim() || '',
        lyrics: lyrics?.trim() || '',
        notes: notes?.trim() || '',
        genre: genre || '',
        audio_url: audio_url || null,
        image_url: finalImageUrl,
        status: status || 'completed',
        is_published: is_published || false,
        channel_id: channel_id || null,
        form: updatedForm
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting song history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // 폰에서 올린(만든) 곡이나 공개 대기로 들어간 곡은 브라우저가 계산하지 않으므로 서버 무료 큐를 바로 깨운다
    if ((data as any)?.audio_url && ((data as any)?.form?.publish_pending || updatedForm.client_platform === 'mobile')) after(kickFreeQueue)

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST song-history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: 기본은 휴지통으로 이동(소프트 삭제, trashed_at).
//   ?id=…&permanent=1  휴지통에 있는 곡만 영구 삭제
//   ?empty=1           내 휴지통 전부 영구 삭제
//   ?id=…&rollback=1   생성 실패로 음원이 없는 빈 기록 정리(휴지통 거치지 않음)
// 이미 쿠키뮤직에 공개된 곡은 어떤 경로로도 지울 수 없다.
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (searchParams.get('empty') === '1') {
      const { error } = await supabase
        .from('song_history')
        .delete()
        .eq('user_id', user.id)
        .eq('is_published', false)
        .not('trashed_at', 'is', null)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { data: row } = await supabase
      .from('song_history')
      .select('id, is_published, audio_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (!row) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

    if (row.is_published) {
      return NextResponse.json({ error: '쿠키뮤직에 공개된 곡은 지울 수 없습니다. 먼저 관리자에게 문의해 주세요.', code: 'published' }, { status: 409 })
    }

    if (searchParams.get('rollback') === '1') {
      if (row.audio_url) return NextResponse.json({ error: 'Not an empty record' }, { status: 409 })
      const { error } = await supabase.from('song_history').delete().eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // direct=1: 감상 쪽(프로필)의 기존 삭제 동작 유지 — 휴지통은 스튜디오에만 있다
    if (searchParams.get('direct') === '1') {
      const { error } = await supabase.from('song_history').delete().eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (searchParams.get('permanent') === '1') {
      const { error } = await supabase
        .from('song_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .not('trashed_at', 'is', null)
      if (error) {
        console.error('Error deleting song history:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from('song_history')
      .update({ trashed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.error('Error trashing song history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, trashed: true })
  } catch (err: any) {
    console.error('API DELETE song-history error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
