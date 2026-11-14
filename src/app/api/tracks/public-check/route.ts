import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isPublicTrackKey, validTrackKey } from '@/lib/publicTrack'

// CDN 워커(cookiemusic-cdn·cookiemusic-media)가 음원을 내주기 전에 부르는 공개 판정. 200=공개 곡, 404=그 밖의 전부.
// 응답에 곡 정보는 없다. 인증 없음(CDN 이 부른다).
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')
  if (!validTrackKey(key)) return NextResponse.json({ ok: false }, { status: 404 })
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!service) return NextResponse.json({ ok: false }, { status: 503 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, { auth: { persistSession: false } })
  try {
    const ok = await isPublicTrackKey(db, key)
    return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
