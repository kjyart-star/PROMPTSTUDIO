import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { id } = resolvedParams

    if (!id) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const { data: channel, error: checkError } = await supabase
      .from('artists')
      .select('owner_user_id')
      .eq('id', id)
      .single()

    if (checkError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    if (channel.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('artists')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting channel:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API DELETE channel error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
