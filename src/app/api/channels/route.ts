import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()
  
  return !!data?.is_admin
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('artists')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ channels: data || [] })
  } catch (err: any) {
    console.error('API GET channels error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (security)
    // As per user instructions, only their account can create channels for now
    // const isAdmin = await checkAdmin(supabase, user.id)
    // if (!isAdmin) {
    //    return NextResponse.json({ error: 'Only administrators can create additional channels.' }, { status: 403 })
    // }

    const body = await request.json()
    const { 
      name, slug, bio, avatar_url, banner_url, 
      tags, plays, likes, followers, following 
    } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    const newChannel = {
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      bio: bio || '',
      avatar_url: avatar_url || null,
      banner_url: banner_url || null,
      tags: Array.isArray(tags) ? tags : [],
      plays: parseInt(plays) || 0,
      likes: parseInt(likes) || 0,
      followers: parseInt(followers) || 0,
      following: parseInt(following) || 0,
      owner_user_id: user.id,
      is_ai_generated: false
    }

    const { data, error } = await supabase
      .from('artists')
      .insert([newChannel])
      .select()
      .single()

    if (error) {
       console.error('Error creating channel:', error)
       return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, channel: data })
  } catch (err: any) {
    console.error('API POST channel error:', err)
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
    const { id, name, slug, bio, avatar_url, banner_url, tags } = body

    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    // Check ownership
    const { data: existingChannel } = await supabase
      .from('artists')
      .select('owner_user_id')
      .eq('id', id)
      .single()

    if (!existingChannel || existingChannel.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to edit this channel' }, { status: 403 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (bio !== undefined) updateData.bio = bio
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (banner_url !== undefined) updateData.banner_url = banner_url
    if (tags !== undefined && Array.isArray(tags)) updateData.tags = tags

    const { data, error } = await supabase
      .from('artists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
       console.error('Error updating channel:', error)
       return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, channel: data })
  } catch (err: any) {
    console.error('API PUT channel error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

