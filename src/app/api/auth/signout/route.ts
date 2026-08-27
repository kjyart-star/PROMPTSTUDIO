import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withBase } from '@/lib/basePath'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  const { origin } = new URL(request.url)
  if (error) {
    console.error('SignOut error:', error)
  }

  return NextResponse.redirect(`${origin}${withBase('/')}`, {
    status: 303,
  })
}
