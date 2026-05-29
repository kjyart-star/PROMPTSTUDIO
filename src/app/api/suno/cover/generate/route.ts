import { NextResponse } from 'next/server'

const API_KEY = process.env.APIPASS_API_KEY || "apk_34c50e9bc6cf84c22d8bbe9c5a42b9a24a72bec5083acffdeb5e065b82924b98"

export async function POST(request: Request) {
  try {
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
