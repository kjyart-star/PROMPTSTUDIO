'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * 와이드 모니터에서 스튜디오 탭이 가운데 고정폭으로 남지 않게 한다.
 * 부모 폭이 1440px 를 넘으면 폭에 비례해 안쪽 전체(글자·간격·컨트롤·썸네일)를
 * 키운다(최대 1.45배, 1440 이하는 1배) — 마스터링 콘솔(--ms-zoom)과 같은 공식이다.
 * CSS zoom 은 안쪽 높이도 같은 비율로 줄여 계산하므로 fill 이면 판 높이를 그대로 채운다.
 */
const BASE = 1440
const MAX = 1.45

export function WideFit({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const apply = () => {
      const z = Math.min(MAX, Math.max(1, Math.round((parent.clientWidth / BASE) * 100) / 100))
      const v = z === 1 ? '' : String(z)
      if (el.style.zoom !== v) el.style.zoom = v
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={`w-full ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
      {children}
    </div>
  )
}
