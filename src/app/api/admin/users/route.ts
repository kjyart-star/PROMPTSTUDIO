import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Helper to verify if the requesting user is an admin
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return !!data.is_admin
}

// GET: Fetch all profiles (Admin only)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await checkAdmin(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 전체 가입 회원 조회
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users for admin:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    console.error('API GET admin-users error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: Update user credits (Admin only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await checkAdmin(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { targetUserId, creditDelta } = body

    if (!targetUserId || creditDelta === undefined) {
      return NextResponse.json({ error: 'targetUserId and creditDelta are required' }, { status: 400 })
    }

    // Create a service role client to bypass RLS for admin operations.
    // Fail loudly if the service key is missing rather than silently
    // falling back to the anon key (which would behave inconsistently).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey)

    // Get current credits
    const { data: profile, error: fetchError } = await adminSupabase
      .from('profiles')
      .select('credits')
      .eq('id', targetUserId)
      .single()

    if (fetchError) {
      console.error('Error fetching credits:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const currentCredits = profile.credits !== null && profile.credits !== undefined ? profile.credits : 120
    const newCredits = currentCredits + creditDelta

    const { data, error } = await adminSupabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', targetUserId)
      .select('id, email, display_name, credits')
      .single()

    if (error) {
      console.error('Error updating credits:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST admin-users error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
