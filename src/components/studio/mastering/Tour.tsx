'use client'

/**
 * 화면 둘러보기 — 「전문 설정」을 처음 펼치면 5단계(트랙 → 체인 → 모듈 패널 → 미터 → 내보내기)로 안내한다.
 * 대상 요소(data-tour)를 재서 테두리로 강조하고(화면을 어둡게 하지 않음) 옆에 말풍선을 띄운다.
 * 떠 있는 창을 쓰지 않는 원칙의 유일한 예외가 이 말풍선이다. 메뉴 줄 「?」 버튼으로 언제든 다시 본다.
 */
import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const LS_TOUR = 'cm.mastering.tour.v1'

const STEPS: { id: string; title: string; body: string }[] = [
  { id: 'timeline', title: '트랙', body: '곡의 파형이에요. 누르면 그 위치부터 듣고, 끌면 반복 구간을 정해요. 회색은 원본, 녹색은 마스터예요.' },
  { id: 'chain', title: '체인', body: '소리가 위에서 아래로 이 모듈들을 지나요. 이름을 누르면 설정이 열리고, 동그라미를 누르면 켜고 꺼요.' },
  { id: 'panel', title: '모듈 패널', body: '고른 모듈의 그래프와 값이 파형 바로 아래에 열려요. 「이 모듈은?」을 누르면 짧은 설명이 나와요.' },
  { id: 'meters', title: '미터', body: '지금 음량과 가장 큰 순간을 보여 줘요. 녹색은 목표 안, 주황은 조금 벗어남, 빨강은 넘침이에요.' },
  { id: 'export', title: '내보내기', body: '어디에 쓸 곡인지 고르면 목표 음량이 맞춰져요. 「파일로 받기」로 저장해요.' },
]

const FALLBACK: Record<string, string> = { meters: '.ms-right' }

function isDone() {
  try { return localStorage.getItem(LS_TOUR) === 'done' } catch { return false }
}

function findTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`) ?? (FALLBACK[id] ? document.querySelector<HTMLElement>(FALLBACK[id]) : null)
}

export function Tour({ expanded }: { expanded: boolean }) {
  const [step, setStep] = useState<number | null>(null)
  const [autoChecked, setAutoChecked] = useState(false)
  // 처음 펼친 순간 한 번만 자동으로 연다(렌더 중 상태 맞추기)
  if (expanded && !autoChecked) {
    setAutoChecked(true)
    if (!isDone()) setStep(0)
  }
  return (
    <>
      <button type="button" className="ms-menubtn" aria-label="둘러보기" title="화면 둘러보기" onClick={() => setStep(0)}>?</button>
      {step !== null && <TourBubble step={step} setStep={setStep} />}
    </>
  )
}

function TourBubble({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  useEffect(() => {
    const place = () => {
      const b = box.current, r = ring.current
      if (!b || !r) return
      const el = findTarget(s.id)
      const vw = window.innerWidth, vh = window.innerHeight
      const bw = b.offsetWidth || 320, bh = b.offsetHeight || 160
      if (!el) {
        r.style.display = 'none'
        b.style.left = `${Math.max(8, (vw - bw) / 2)}px`; b.style.top = '72px'
        return
      }
      const t = el.getBoundingClientRect()
      r.style.display = 'block'
      r.style.left = `${t.left - 3}px`; r.style.top = `${t.top - 3}px`
      r.style.width = `${t.width + 6}px`; r.style.height = `${t.height + 6}px`
      let top = t.bottom + 12
      if (top + bh > vh - 8) top = t.top - bh - 12
      if (top < 8) top = Math.min(vh - bh - 8, Math.max(8, t.top + 12))
      const left = Math.min(vw - bw - 8, Math.max(8, t.left + 12))
      b.style.left = `${left}px`; b.style.top = `${top}px`
    }
    findTarget(s.id)?.scrollIntoView?.({ block: 'nearest' })
    place()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStep(null) }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [s.id, setStep])

  const never = () => {
    try { localStorage.setItem(LS_TOUR, 'done') } catch {}
    setStep(null)
  }
  return (
    <>
      <div ref={ring} className="ms-tourring" aria-hidden />
      <div ref={box} className="ms-tour" role="dialog" aria-label="둘러보기" aria-modal="false">
        <div className="flex items-center gap-2">
          <span className="mono faint text-[11px]">{step + 1} / {STEPS.length}</span>
          <h4>{s.title}</h4>
          <button type="button" className="ml-auto dim hover:text-white" aria-label="둘러보기 닫기" onClick={() => setStep(null)}><X className="w-4 h-4" /></button>
        </div>
        <p>{s.body}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="ms-btn" onClick={never}>다시 보지 않기</button>
          <span className="ml-auto" />
          <button type="button" className="ms-btn" disabled={step === 0} onClick={() => setStep(step - 1)}>이전</button>
          <button type="button" className="ms-btn go" onClick={() => (last ? never() : setStep(step + 1))}>{last ? '마치기' : '다음'}</button>
        </div>
      </div>
    </>
  )
}
