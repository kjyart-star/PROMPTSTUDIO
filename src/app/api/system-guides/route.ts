import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch all system (common) guidelines
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('system_guides')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching system guides:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    console.error('API GET system-guides error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Helper to verify if the user is an admin
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

// Helper to extract storage relative path from public URL
function getStoragePathFromUrl(url: string): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/system-guides/'
  const index = url.indexOf(marker)
  if (index !== -1) {
    return decodeURIComponent(url.substring(index + marker.length))
  }
  return null
}

// POST: Add a new system guideline (Admin only)
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
    const { title, body: guideBody, file_url, file_name } = body

    if (!title || !guideBody) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('system_guides')
      .insert({
        title,
        body: guideBody,
        file_url: file_url || null,
        file_name: file_name || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting system guide:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API POST system-guide error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT: Modify an existing system guideline (Admin only)
export async function PUT(request: Request) {
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
    const { id, title, body: guideBody, file_url, file_name } = body

    if (!id || !title || !guideBody) {
      return NextResponse.json({ error: 'ID, title and body are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('system_guides')
      .update({
        title,
        body: guideBody,
        file_url: file_url === undefined ? undefined : file_url,
        file_name: file_name === undefined ? undefined : file_name
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating system guide:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('API PUT system-guide error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: Remove a system guideline (Admin only)
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Storage에 업로드된 실물 파일이 있다면 먼저 제거
    const { data: guideData } = await supabase
      .from('system_guides')
      .select('file_url')
      .eq('id', id)
      .single()

    if (guideData?.file_url) {
      const storagePath = getStoragePathFromUrl(guideData.file_url)
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('system-guides')
          .remove([storagePath])
        if (storageError) {
          console.error('Failed to delete storage file:', storageError)
        }
      }
    }

    const { error } = await supabase
      .from('system_guides')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting system guide:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('API DELETE system-guide error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
