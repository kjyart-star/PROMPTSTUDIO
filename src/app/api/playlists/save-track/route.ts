import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { track_id, playlist_id } = await req.json()

    if (!track_id || !playlist_id) {
      return NextResponse.json({ error: 'Missing track_id or playlist_id' }, { status: 400 })
    }

    // 1. Fetch original track
    const { data: originalTrack, error: fetchError } = await supabase
      .from('song_history')
      .select('*')
      .eq('id', track_id)
      .single()

    if (fetchError || !originalTrack) {
      return NextResponse.json({ error: 'Original track not found' }, { status: 404 })
    }

    // 2. Clone the track to the current user's song_history with the target playlist_id
    const newTrack = {
      user_id: session.user.id,
      title: originalTrack.title,
      prompt: originalTrack.prompt,
      lyrics: originalTrack.lyrics,
      notes: originalTrack.notes,
      form: originalTrack.form, // Contains metadata like duration
      audio_url: originalTrack.audio_url,
      image_url: originalTrack.image_url,
      genre: originalTrack.genre,
      status: originalTrack.status,
      suno_task_id: originalTrack.suno_task_id,
      playlist_id: playlist_id,
      is_published: false,
      channel_id: null,
      exposure_order: null
    }

    const { data: insertedTrack, error: insertError } = await supabase
      .from('song_history')
      .insert([newTrack])
      .select()
      .single()

    if (insertError) {
      console.error('API save-track insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save track' }, { status: 500 })
    }

    return NextResponse.json(insertedTrack)
  } catch (error) {
    console.error('API save-track error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
