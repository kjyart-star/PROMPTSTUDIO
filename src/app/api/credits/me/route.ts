import { NextResponse } from 'next/server'
import { CREDIT_PRICES, getSuiteBalance } from '@/lib/credits/suite'

export const dynamic = 'force-dynamic'

/** 스위트 공용 지갑 잔액 + 이 서비스의 단가표. 화면은 이 값만 보고 그린다. */
export async function GET() {
  const result = await getSuiteBalance()

  if (!result.ok) {
    if (result.kind === 'unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json(
      { error: '크레딧 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ balance: result.balance, prices: CREDIT_PRICES })
}
