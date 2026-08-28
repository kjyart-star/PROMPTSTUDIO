import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'

const API_KEY = process.env.APIPASS_API_KEY

export async function POST(request: Request) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }

    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('suno/generate')
    if (!gate.ok) return gate.response

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 차단 사용자 및 크레딧 검증
    let profile: { is_banned?: boolean; credits?: number } | null = null
    const { data: fetchProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_banned, credits')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code === '42703') {
      // is_banned 컬럼이 없을 경우 credits만 조회하여 대체
      const { data: fallbackProfile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()
      if (fallbackProfile) {
        profile = { is_banned: false, credits: fallbackProfile.credits }
      }
    } else {
      profile = fetchProfile
    }

    if (profile?.is_banned) {
      return NextResponse.json({ error: 'Banned account. Please contact support.' }, { status: 403 })
    }

    if ((profile?.credits ?? 0) < 10) {
      return NextResponse.json({ error: 'Insufficient credits. Please recharge.' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      historyId, 
      prompt, 
      style, 
      title, 
      modelVersion, 
      customMode, 
      instrumentalOnly, 
      vocalGender, 
      negativeTags, 
      styleWeight, 
      weirdness, 
      audioWeight 
    } = body

    if (!historyId) {
      return NextResponse.json({ error: 'historyId is required' }, { status: 400 })
    }

    const upperModelVersion = (modelVersion || 'V5').toUpperCase()

    // Prepare Apipass API payload
    const payload = {
      model: "suno/generate",
      input: {
        prompt: prompt || "",
        tags: style || "",
        style: style || "",
        title: title || "",
        make_instrumental: instrumentalOnly || false,
        model_version: upperModelVersion,
        customMode: customMode ?? true
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
      const taskId = data.data.taskId

      // 크레딧 10 차감 및 히스토리 기록
      const { error: rpcError } = await supabase.rpc('record_credit_transaction', {
        p_user_id: user.id,
        p_amount: -10,
        p_type: 'use',
        p_description: '음악 생성 (-10)'
      })

      if (rpcError) {
        console.warn('record_credit_transaction RPC failed, falling back to direct credit update:', rpcError.message)
        // Fallback: Direct credit update using service role client to bypass RLS safely
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (serviceRoleKey && supabaseUrl) {
          const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
          const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey)
          const { data: pData } = await adminSupabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single()
          if (pData) {
            const currentCredits = pData.credits !== null && pData.credits !== undefined ? pData.credits : 120
            const newCredits = Math.max(0, currentCredits - 10)
            await adminSupabase
              .from('profiles')
              .update({ credits: newCredits })
              .eq('id', user.id)
          }
        }
      }

      // Update DB with task ID and status
      const { error } = await supabase
        .from('song_history')
        .update({
          suno_task_id: taskId,
          status: 'processing'
        })
        .eq('id', historyId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating task ID:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ taskId, status: 'processing' })
    } else {
      console.error('Apipass API Error:', data)
      return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('API POST suno/generate error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
