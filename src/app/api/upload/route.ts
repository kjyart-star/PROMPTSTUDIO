import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json()
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. 유저 권한 검증
    const { data: { user } } = await supabase.auth.getUser()
    console.log('=== UPLOAD ROUTE DIAGNOSTIC ===')
    console.log('User ID:', user?.id)
    console.log('User Email:', user?.email)
    
    if (!user) {
      console.log('Upload denied: Unauthorized (no user)')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profileData?.is_admin) {
      console.log('Upload denied: Forbidden (not admin)')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. 고유 경로 생성
    const fileExt = filename.split('.').pop()
    const uniqueId = crypto.randomUUID()
    const filePath = `audio/${uniqueId}.${fileExt}`

    // 3. 서명 업로드 URL 발급 (60초 유효)
    const { data, error } = await supabase.storage
      .from('tracks')
      .createSignedUploadUrl(filePath)

    if (error) throw error

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: filePath,
      token: data.token,
    })
  } catch (err: any) {
    console.error('Error generating signed upload URL:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
