import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * 마스터링본 업로드 주소 발급.
 *
 * 마스터링은 브라우저에서 끝나고, 결과 파일만 `tracks` 버킷에 올린다. 그 버킷은 사용자 세션으로는
 * 쓰기가 막혀 있어(관리자 정책) 서버가 서비스 키로 서명 업로드 주소를 만들어 준다.
 * 경로는 서버가 정한다 — 클라이언트는 확장자만 고른다.
 */
const TYPES: Record<string, string> = { wav: 'audio/wav', mp3: 'audio/mpeg' }

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

    const { ext } = await request.json().catch(() => ({}))
    if (typeof ext !== 'string' || !TYPES[ext]) {
      return NextResponse.json({ error: 'wav 또는 mp3 만 올릴 수 있어요.' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const path = `audio/mastered-${crypto.randomUUID()}.${ext}`
    const { data, error } = await admin.storage.from('tracks').createSignedUploadUrl(path)
    if (error) throw error
    return NextResponse.json({ path, token: data.token, contentType: TYPES[ext] })
  } catch (err) {
    console.error('mastering-upload error:', err)
    return NextResponse.json({ error: '업로드 주소를 만들지 못했어요.' }, { status: 500 })
  }
}
