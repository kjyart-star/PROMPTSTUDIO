import { NextResponse } from 'next/server'
import { POST as sunoGenerate } from '@/app/api/suno/generate/route'

export async function POST(request: Request) {
  try {
    const clonedReq = request.clone()
    const body = await clonedReq.json()
    const modelProvider = body.modelProvider || 'suno'

    if (modelProvider === 'suno') {
      return sunoGenerate(request)
    } else {
      return NextResponse.json({ error: `${modelProvider} API 연동 준비 중입니다.` }, { status: 501 })
    }
  } catch (err: any) {
    console.error('API POST music/generate error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
