import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch active guide IDs for the user's profile
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json([])
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('active_guide_ids')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching active guides:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data?.active_guide_ids ?? null)
  } catch (err: any) {
    console.error('API GET active-guides error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT: Update the active_guide_ids list
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { activeGuideIds } = body

    if (!Array.isArray(activeGuideIds)) {
      return NextResponse.json({ error: 'activeGuideIds must be an array of strings' }, { status: 400 })
    }

    // Try to update. If profiles row does not exist, upsert it.
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email || '',
        active_guide_ids: activeGuideIds,
        updated_at: new Date().toISOString()
      })
      .select('active_guide_ids')
      .single()

    if (error) {
      console.error('Error updating active guides in profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data?.active_guide_ids || [])
  } catch (err: any) {
    console.error('API PUT active-guides error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
