import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.APIPASS_API_KEY

export async function POST(request: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Construct the payload as per apipass docs
    const payload = {
      model: "suno/cover",
      input: {
        model_version: body.modelVersion,
        audioUrl: body.audioUrl,
        customMode: body.customMode,
        instrumental: body.instrumental,
        prompt: body.prompt,
        style: body.style,
        title: body.title,
        continueAt: body.continueAt,
        vocalGender: body.vocalGender,
        styleWeight: body.styleWeight,
        audioWeight: body.audioWeight
      }
    }

    const response = await fetch("https://api.apipass.dev/api/v1/jobs/createTask", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (response.ok && data.code === 200) {
       // Typically we would save this to Supabase song_history here
       // but for simplicity, we just return the taskId to the client
       return NextResponse.json({ taskId: data.data.taskId })
    } else {
       return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('Create Cover Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
