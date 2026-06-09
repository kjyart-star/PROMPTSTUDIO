import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import NodeID3 from 'node-id3'

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

    let listData = data || []

    // fetchAll이 true이면 profiles 테이블에서 사용자 목록을 추가로 가져와 인메모리에서 결합
    if (fetchAll && listData.length > 0) {
      const userIds = Array.from(new Set(listData.map(item => item.user_id)))
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, display_name, is_banned')
        .in('id', userIds)
      
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
          if (tags && tags.image) {
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

    const updatedForm = form || { negativePrompt: negative_prompt || '' }
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
