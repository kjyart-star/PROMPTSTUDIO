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
    const { is_published, playlist_id, liked, image_url, video_url, genre, channel_id, trashed, title, lyrics, lrc, lrc_auto, playlist_order } = body

    // 1. 소유권 확인
    const { data: songCheck } = await supabase
      .from('song_history')
      .select('user_id, form')
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
      if (playlist_id !== undefined || channel_id !== undefined) {
        return NextResponse.json({ error: 'Admins can only change the publishing status or media of other users\' songs.' }, { status: 403 })
      }
      if (is_published !== undefined) updateData.is_published = is_published
      if (image_url !== undefined) updateData.image_url = image_url
      if (video_url !== undefined) updateData.video_url = video_url
    } else {
      // 소유자인 경우 모든 항목 수정 가능
      if (is_published !== undefined) updateData.is_published = is_published
      if (playlist_id !== undefined) updateData.playlist_id = playlist_id
      if (liked !== undefined) updateData.liked = liked
      if (playlist_order === null || Number.isInteger(playlist_order)) updateData.playlist_order = playlist_order
      if (trashed === false) updateData.trashed_at = null // 휴지통에서 복원
      if (typeof title === 'string' && title.trim()) updateData.title = title.trim().slice(0, 200)
      if (typeof lyrics === 'string') updateData.lyrics = lyrics.slice(0, 20000)
      if (lrc !== undefined) {
        // 가사 시간표(LRC/SRT 를 읽은 결과) — form.lrc 에 보관, null 이면 지운다
        const base = (songCheck as any).form && typeof (songCheck as any).form === 'object' ? { ...(songCheck as any).form } : {}
        if (lrc === null) delete base.lrc
        else if (Array.isArray(lrc)) base.lrc = lrc.slice(0, 2000).map((l: any) => ({ t: Number(l.t) || 0, text: String(l.text || '').slice(0, 500) }))
        updateData.form = base
      }
      if (Array.isArray(lrc_auto) && lrc === undefined) {
        // 자동 맞추기 결과 — 사용자가 올린 form.lrc 와 따로 form.lrc_auto 에 둔다(이미 사용자 시간표가 있으면 저장하지 않는다)
        const base = (songCheck as any).form && typeof (songCheck as any).form === 'object' ? { ...(songCheck as any).form } : {}
        if (!Array.isArray(base.lrc) || !base.lrc.length) {
          base.lrc_auto = lrc_auto.slice(0, 2000).map((l: any) => ({ t: Number(l.t) || 0, text: String(l.text || '').slice(0, 500) }))
          updateData.form = base
        }
      }
      if (image_url !== undefined) updateData.image_url = image_url
      if (video_url !== undefined) updateData.video_url = video_url
      if (genre !== undefined) updateData.genre = genre
      if (channel_id !== undefined) {
        // 남의 채널에 내 곡을 붙일 수 없다. 채널 소유권을 서버에서 반드시 확인한다.
        if (channel_id === null) {
          updateData.channel_id = null
        } else {
          const { data: channelCheck } = await supabase
            .from('artists')
            .select('owner_user_id')
            .eq('id', channel_id)
            .single()

          if (!channelCheck || channelCheck.owner_user_id !== user.id) {
            return NextResponse.json({ error: 'You do not own this channel.' }, { status: 403 })
          }
          updateData.channel_id = channel_id
        }
      }
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
