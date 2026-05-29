import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { historyId } = body

    if (!historyId) {
      return NextResponse.json({ error: 'historyId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('song_history')
      .update({
        is_published: true
      })
      .eq('id', historyId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error publishing song:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_published: true })
  } catch (err: any) {
    console.error('API POST suno/publish error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
