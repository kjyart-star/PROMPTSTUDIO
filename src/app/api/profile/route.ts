import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, banner_url, bio, tags, followers, following, plays, likes, handle, created_at, credits')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching full profile, falling back to basic columns:', error)
      // Fallback: try fetching only basic columns in case the schema extensions weren't applied
      const fallbackResult = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url, created_at, credits')
        .eq('id', user.id)
        .single()
      
      if (fallbackResult.error) {
        console.error('Error fetching basic profile:', fallbackResult.error)
        return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 })
      }
      data = fallbackResult.data
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API GET profile error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      display_name, 
      avatar_url, 
      banner_url, 
      bio, 
      tags, 
      followers, 
      following, 
      plays, 
      likes, 
      handle 
    } = body

    const updateData: any = {}
    if (display_name !== undefined) updateData.display_name = display_name
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (banner_url !== undefined) updateData.banner_url = banner_url
    if (bio !== undefined) updateData.bio = bio
    if (tags !== undefined) updateData.tags = tags
    if (followers !== undefined) updateData.followers = followers
    if (following !== undefined) updateData.following = following
    if (plays !== undefined) updateData.plays = plays
    if (likes !== undefined) updateData.likes = likes
    if (handle !== undefined) updateData.handle = handle

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data })
  } catch (err: any) {
    console.error('API PUT profile error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
