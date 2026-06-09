import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  // 실제 요청 origin 계산 (Vercel/프록시 및 로컬 대응)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const isLocal = host?.includes('localhost') || host?.includes('127.0.0.1')
  const proto = request.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https')
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
