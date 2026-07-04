import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 차단 사용자 검증
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned) {
      return NextResponse.json({ error: 'Banned account. Please contact support.' }, { status: 403 })
    }

    const body = await request.json()
    const { system, user: userPrompt, model } = body

    if (!system || !userPrompt || typeof system !== 'string' || typeof userPrompt !== 'string') {
      return NextResponse.json({ error: 'System and user prompts are required' }, { status: 400 })
    }

    // Cap input size to prevent abuse of the server's OpenAI billing.
    const MAX_LEN = 8000
    if (system.length > MAX_LEN || userPrompt.length > MAX_LEN) {
      return NextResponse.json({ error: 'Prompt too long' }, { status: 400 })
    }

    // Only allow an explicit set of models; ignore arbitrary client-supplied ones.
    const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o']
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : 'gpt-4o-mini'

    const apiKey = (process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
    if (!apiKey) {
      console.error('Missing OpenAI API key on server env')
      return NextResponse.json({ error: 'OpenAI API key not configured on server' }, { status: 500 })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('OpenAI API error:', data)
      return NextResponse.json({ error: data?.error?.message || 'OpenAI API call failed' }, { status: response.status || 500 })
    }

    const resultText = data.choices?.[0]?.message?.content || ''
    return NextResponse.json({ text: resultText })
  } catch (err: any) {
    console.error('API POST generate-prompt error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
