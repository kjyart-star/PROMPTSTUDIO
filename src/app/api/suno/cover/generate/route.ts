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
       // 크레딧 10 차감 및 히스토리 기록
       const { error: rpcError } = await supabase.rpc('record_credit_transaction', {
         p_user_id: user.id,
         p_amount: -10,
         p_type: 'use',
         p_description: '커버 생성 (-10)'
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
