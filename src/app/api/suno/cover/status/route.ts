import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.APIPASS_API_KEY

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

    const response = await fetch(`https://api.apipass.dev/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    const data = await response.json()

    if (response.ok && data.code === 200) {
       const state = data.data.state // queuing, generating, success, fail
       if (state === 'success') {
          // You could also save the result to Supabase song_history here
          return NextResponse.json({ status: 'completed', results: data.data.resultJson?.data })
       } else if (state === 'fail') {
          return NextResponse.json({ status: 'failed', message: data.data.failMsg })
       } else {
          return NextResponse.json({ status: 'processing' })
       }
    } else {
       return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('Cover Status Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
