import { NextResponse } from 'next/server'
import { fetchSuitePrices, getSuiteBalance } from '@/lib/credits/suite'

export const dynamic = 'force-dynamic'

/**
 * 스위트 공용 지갑 잔액 + 이 서비스의 단가표. 화면은 이 값만 보고 그린다.
 *
 * 단가는 이 저장소에 적어 두지 않고 **워커의 공개 단가 API**에서 그때그때 읽는다 —
 * 사본을 들고 있으면 워커 단가가 바뀌었을 때 화면만 옛 숫자를 말한다(2026-09-07).
 */
export async function GET() {
  const [result, prices] = await Promise.all([getSuiteBalance(), fetchSuitePrices()])

  if (!result.ok) {
    if (result.kind === 'unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json(
      { error: '크레딧 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ balance: result.balance, prices })
}
