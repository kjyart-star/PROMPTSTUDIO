import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('file_path')

    if (!filePath) {
      return NextResponse.json({ error: 'file_path is required' }, { status: 400 })
    }

    // 1. Get the current logged-in user's supabase client (reads cookies)
    const userSupabase = await createServerClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    // 2. Query the track in song_history to check permissions.
    // If the track is published (is_published = true), anyone (including guest users) can play it.
    // If the track is a draft, only the owner (user_id = user.id) or an administrator can play it.
    const { data: trackData, error: dbError } = await userSupabase
      .from('song_history')
      .select('is_published, user_id')
      .eq('audio_url', filePath)
      .maybeSingle()

    let isAllowed = false

    if (trackData) {
      if (trackData.is_published) {
        isAllowed = true
      } else if (user && trackData.user_id === user.id) {
        isAllowed = true
      }
    }

    // If still not allowed, check if the current logged-in user is an administrator
    if (!isAllowed && user) {
      const { data: profile } = await userSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.is_admin) {
        isAllowed = true
      }
    }

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Initialize admin client with the service role key to bypass storage RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const adminSupabase = createAdminClient(supabaseUrl, supabaseKey)

    const { data, error } = await adminSupabase.storage
      .from('tracks')
      .createSignedUrl(filePath, 3600)

    if (error) {
      console.error('Error generating signed URL on server:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (err: any) {
    console.error('Server signed-url route error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
