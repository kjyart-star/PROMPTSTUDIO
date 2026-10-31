import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isStudioOpen, setStudioOpen, resetStudioOpenCache } from '@/lib/studio/openSwitch'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return !!profile?.is_admin
}

/** 스튜디오 공개 스위치 읽기·쓰기 — 관리자만 */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  resetStudioOpenCache()
  return NextResponse.json({ open: await isStudioOpen() })
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (typeof body.open !== 'boolean') return NextResponse.json({ error: 'open(boolean) is required' }, { status: 400 })
  if (!(await setStudioOpen(body.open))) return NextResponse.json({ error: '저장하지 못했어요.' }, { status: 500 })
  return NextResponse.json({ open: body.open })
}
