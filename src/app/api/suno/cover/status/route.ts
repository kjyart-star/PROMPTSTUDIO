import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GET as getSavedStatus } from '@/app/api/suno/status/route'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const { data: histories, error } = await supabase.from('song_history').select('id')
      .eq('suno_task_id', taskId).eq('user_id', user.id).order('created_at', { ascending: true }).limit(1)
    if (error) return NextResponse.json({ error: 'History lookup failed' }, { status: 500 })
    if (!histories?.length) return NextResponse.json({ error: 'Cover history not found' }, { status: 404 })
    const url = new URL(request.url)
    url.searchParams.set('historyId', histories[0].id)
    const response = await getSavedStatus(new Request(url, { headers: request.headers }))
    if (!response.ok) return response
    const result = await response.json()
    if (result.status !== 'completed') return NextResponse.json(result)
    const { data: tracks, error: tracksError } = await supabase.from('song_history')
      .select('id,title,audio_url,image_url').eq('suno_task_id', taskId).eq('user_id', user.id)
      .eq('status', 'completed').order('created_at', { ascending: true })
    if (tracksError) return NextResponse.json({ error: 'Could not load saved covers' }, { status: 500 })
    return NextResponse.json({ status: 'completed', results: tracks })
  } catch (err: any) {
    console.error('Cover Status Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
