import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSunoStatus } from '@/lib/suno/channel'

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

    // 접수한 그 채널에만 묻는다 — 작업 id 의 접두사가 길을 정한다.
    const outcome = await getSunoStatus(taskId)

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: 400 })
    }

    if (outcome.state === 'succeeded') {
      // You could also save the result to Supabase song_history here
      return NextResponse.json({ status: 'completed', results: outcome.results })
    }
    if (outcome.state === 'failed') {
      return NextResponse.json({ status: 'failed', message: outcome.message })
    }
    return NextResponse.json({ status: 'processing' })
  } catch (err: any) {
    console.error('Cover Status Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
