import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Secondary admin verification. Validates the logged-in user is an admin
 * AND that the supplied secondary password matches a server-only env var.
 * The password is never shipped to the client bundle.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const expected = process.env.ADMIN_SECONDARY_PASSWORD
    if (!expected) {
      console.error('ADMIN_SECONDARY_PASSWORD is not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { id, password } = body ?? {}

    if (id === 'admin' && typeof password === 'string' && password === expected) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
