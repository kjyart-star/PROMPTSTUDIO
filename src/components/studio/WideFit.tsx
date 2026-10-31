'use client'

import type { ReactNode } from 'react'

/**
 * 와이드 모니터에서 스튜디오 탭이 화면 폭·높이를 채우게 하는 래퍼.
 * 글자·컨트롤은 키우지 않는다(수노처럼 어떤 폭에서도 1배, 촘촘한 밀도 유지).
 * fill 이면 판 높이를 그대로 채운다.
 */
export function WideFit({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return <div className={`w-full ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}>{children}</div>
}
