import { NextResponse } from 'next/server'
import { POST as sunoGenerate } from '@/app/api/suno/generate/route'
import { requireAiAccess } from '@/lib/auth/aiGate'

export async function POST(request: Request) {
  try {
    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('music/generate')
    if (!gate.ok) return gate.response

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
