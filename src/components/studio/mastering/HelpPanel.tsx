'use client'

/**
 * 「사용 설명서」 — 메뉴 줄 버튼 + 오른쪽에서 열리는 고정 패널(폭 420). 내용은 helpContent.ts.
 */
import React, { useEffect, useRef, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { withBase } from '@/lib/basePath'
import { DESTINATIONS } from '@/lib/mastering/destinations'
import { MODULE_LABEL } from './labels'
import {
  HELP_TABS, QUICK_STEPS, QUICK_IMG_COUNT, MODULE_HELP, moduleRecommend, METER_ITEMS, FAQ_ITEMS, TARGETS_NOTE, type HelpTabId,
} from './helpContent'

function StepImage({ n }: { n: number }) {
  const [ok, setOk] = useState(true)
  if (!ok || n > QUICK_IMG_COUNT) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBase(`/mastering/help/quick-${n}.webp`)} alt={`${n}단계 화면`} loading="lazy" onError={() => setOk(false)} className="w-full rounded-lg border border-[var(--m-line-soft)] mt-2" />
}

function Quick() {
  return (
    <ol className="flex flex-col gap-4 list-none p-0 m-0">
      {QUICK_STEPS.map(s => (
        <li key={s.n}>
          <h3 className="text-[13px] font-bold mb-1"><span className="mono text-[var(--m-green)] mr-1.5">{s.n}</span>{s.title}</h3>
          <p className="text-[12px] leading-relaxed dim m-0">{s.body}</p>
          <StepImage n={s.n} />
        </li>
      ))}
    </ol>
  )
}

function Modules() {
  return (
    <ul className="flex flex-col gap-3 list-none p-0 m-0">
      {MODULE_HELP.map(m => (
        <li key={m.slot} className="rounded-lg border border-[var(--m-line-soft)] bg-[var(--m-panel)] p-2.5">
          <h3 className="text-[13px] font-bold mb-1">{MODULE_LABEL[m.slot]}</h3>
          <p className="text-[12px] leading-relaxed m-0">{m.what}</p>
          <p className="text-[12px] leading-relaxed dim m-0 mt-1"><b>언제:</b> {m.when}</p>
          <p className="text-[12px] leading-relaxed m-0 mt-1 text-[var(--m-green)]"><b>추천값:</b> {moduleRecommend(m.slot)}</p>
        </li>
      ))}
    </ul>
  )
}

function Meters() {
  return (
    <dl className="flex flex-col gap-3 m-0">
      {METER_ITEMS.map(m => (
        <div key={m.name}>
          <dt className="text-[13px] font-bold">{m.name}</dt>
          <dd className="text-[12px] leading-relaxed dim m-0 mt-0.5">{m.body}</dd>
        </div>
      ))}
    </dl>
  )
}

function Targets() {
  return (
    <div>
      <p className="text-[12px] dim leading-relaxed mt-0 mb-2">{TARGETS_NOTE}</p>
      <ul className="flex flex-col gap-2 list-none p-0 m-0" aria-label="목표 음량 표">
        {DESTINATIONS.map(d => {
          const sure = d.verified.lufs && d.verified.tp
          return (
            <li key={d.id} data-row="dest" className="rounded-lg border border-[var(--m-line-soft)] bg-[var(--m-panel)] p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-[13px] font-bold m-0">{d.label}</h3>
                <span className="text-[11px]" style={{ color: sure ? 'var(--m-green)' : 'var(--m-amber)' }}>{sure ? '공식 기준 확인' : '미확인·보수적 값'}</span>
              </div>
              <p className="text-[12px] dim m-0 mt-0.5">{d.plain}</p>
              <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-[12px] m-0 mt-1.5">
                <div><dt className="faint text-[10px]">목표 음량</dt><dd className="mono m-0">{d.lufs} LUFS</dd></div>
                <div><dt className="faint text-[10px]">트루피크</dt><dd className="mono m-0">{d.tp} dB</dd></div>
                <div><dt className="faint text-[10px]">형식</dt><dd className="mono m-0">{d.format.toUpperCase()}</dd></div>
                <div><dt className="faint text-[10px]">비트</dt><dd className="mono m-0">{d.bits}bit</dd></div>
                <div><dt className="faint text-[10px]">샘플레이트</dt><dd className="mono m-0">{d.rate / 1000} kHz</dd></div>
                <div><dt className="faint text-[10px]">디더</dt><dd className="mono m-0">{d.dither && d.bits === 16 ? '노이즈 셰이핑' : '없음'}</dd></div>
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Faq() {
  return (
    <div className="flex flex-col gap-3">
      {FAQ_ITEMS.map(f => (
        <section key={f.q}>
          <h3 className="text-[13px] font-bold mb-1">{f.q}</h3>
          <p className="text-[12px] leading-relaxed dim m-0">{f.a}</p>
        </section>
      ))}
    </div>
  )
}

const BODY: Record<HelpTabId, () => React.ReactElement> = { quick: Quick, modules: Modules, meters: Meters, targets: Targets, faq: Faq }

export function HelpButton() {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={btn} type="button" className="ms-menubtn inline-flex items-center gap-1" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <BookOpen className="w-3.5 h-3.5" /> 사용 설명서
      </button>
      {open && <HelpPanel onClose={() => { setOpen(false); btn.current?.focus() }} />}
    </>
  )
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTabId>('quick')
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  const Body = BODY[tab]
  return (
    <aside role="dialog" aria-label="사용 설명서" className="fixed top-0 right-0 bottom-0 z-[90] flex flex-col overflow-hidden border-l border-[var(--m-line)] bg-[var(--m-bg)] text-[var(--m-text)] shadow-2xl"
      style={{ width: 'min(420px, 100vw)', borderRadius: '8px 0 0 8px', colorScheme: 'dark' }}>
      <div className="flex items-center justify-between px-3 h-11 shrink-0 border-b border-[var(--m-line-soft)] bg-[var(--m-panel)]">
        <h2 className="text-[14px] font-bold m-0 inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> 사용 설명서</h2>
        <button ref={closeRef} type="button" aria-label="닫기" onClick={onClose} className="dim hover:text-white p-1"><X className="w-4 h-4" /></button>
      </div>
      <nav className="flex flex-wrap gap-1.5 p-2.5 shrink-0 border-b border-[var(--m-line-soft)]" role="tablist" aria-label="목차">
        {HELP_TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="ms-chipbtn">{t.label}</button>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar break-words" role="tabpanel">
        <Body />
      </div>
    </aside>
  )
}
