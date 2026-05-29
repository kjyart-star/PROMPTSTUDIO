import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aggregateCharts } from '@/lib/charts/aggregate'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodType = searchParams.get('period_type') || 'daily'
    const dateParam = searchParams.get('date')

    if (periodType !== 'daily' && periodType !== 'weekly' && periodType !== 'monthly') {
      return NextResponse.json({ error: 'invalid period_type' }, { status: 400 })
    }

    const targetDate = dateParam ? new Date(dateParam) : new Date()
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'invalid date format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const isLocal = process.env.NODE_ENV === 'development'
    let isAuthorized = isLocal

    if (user && !isAuthorized) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      isAuthorized = roleData?.role === 'admin'
    }

    const cronHeader = request.headers.get('x-cron-auth')
    if (cronHeader && cronHeader === process.env.CRON_SECRET) {
      isAuthorized = true
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await aggregateCharts(periodType, targetDate)

    return NextResponse.json({
      ok: true,
      period_type: periodType,
      date: targetDate.toISOString().split('T')[0],
      method: result.method
    })
  } catch (err: any) {
    console.error('Error in chart cron API:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
