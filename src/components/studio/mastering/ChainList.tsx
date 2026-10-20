'use client'

/**
 * 전문 설정(펼침) — 왼쪽 열 「체인」(신호 흐름 순서대로 14 모듈) · 「도구」 목록, 도구 패널, 상태 줄.
 * 모듈·도구를 누르면 타임라인 바로 아래 도킹 패널(useDock)에 열린다 — 3열 본문 가운데는 늘 스타일 패널.
 */
import React, { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { GripVertical, Gauge } from 'lucide-react'
import { ALL_SLOTS, type SlotId } from '@/lib/mastering/dsp'
import { useMastering } from './store'
import { useUi, autoInputGain, getEngine } from './actions'
import { slotSummary } from './Plugins'
import { MODULE_LABEL, SLOT_HELP, GR_PICK, KINDS, kindColor } from './labels'
import { fmtClock } from './Timeline'
import { TemplatesPanel, AnalysisPanel, ReferencePanel, EditPanel, AlbumPanel, StemsPanel, ExportPanel, AutoNotes } from './Panels'
import { DockHead } from './ModulePanel'
import type { ViewCtx } from './Shell'
import type { MasteringEngine } from './engine'

export type ToolId = 'reference' | 'analysis' | 'edit' | 'album' | 'stems' | 'markers' | 'templates' | 'export'
export const TOOLS: { id: ToolId; label: string; help: string }[] = [
  { id: 'reference', label: '레퍼런스', help: '좋아하는 곡과 비교하고 톤을 따라가요' },
  { id: 'analysis', label: '분석', help: '음량·피크·스펙트럼·클리핑 위치를 자세히 봐요' },
  { id: 'edit', label: '편집 · 페이드 · 오토메이션', help: '앞뒤 자르기, 페이드, 구간 처리, 시간에 따라 값 바꾸기' },
  { id: 'album', label: '앨범', help: '여러 곡 순서·간격·음량을 맞추고 한꺼번에 내보내요' },
  { id: 'stems', label: '스템', help: '보컬·드럼처럼 나뉜 파일을 섞어 마스터링해요' },
  { id: 'markers', label: '마커', help: '곡 안의 위치를 표시하고 이름을 붙여요' },
  { id: 'templates', label: '템플릿 · 자동', help: '장르·용도·질감 템플릿 40종과 분석 자동 마스터링' },
  { id: 'export', label: '내보내기 · 태그', help: '파일 형식, 태그·커버, 내보낸 파일 재측정 리포트, 여러 곡 ZIP' },
]

export type CenterView = { kind: 'style' } | { kind: 'slot'; slot: SlotId } | { kind: 'tool'; tool: ToolId }
export type DockView = { kind: 'slot'; slot: SlotId } | { kind: 'tool'; tool: ToolId }

/** 타임라인 아래 도킹 패널 상태 — 무엇이 열렸는지 · 접혔는지 · 체인 목록이 화면에 있는지(없으면 패널도 숨김) */
export const useDock = create<{ view: DockView | null; folded: boolean; chain: boolean; set: (p: Partial<{ view: DockView | null; folded: boolean; chain: boolean }>) => void }>(set => ({
  view: null, folded: false, chain: false, set: p => set(p),
}))
/** 체인 목록 최대 높이 — 넘치면 목록 안에서 세로로 스크롤 */
export const CHAIN_LIST_MAX_H = 240

const openDock = (view: DockView) => useDock.getState().set({ view, folded: false })

/** view·onOpen 은 예전 가운데 패널용 — 이제 모듈·도구는 도킹 패널(useDock)에 열린다 */
export function ChainList({ engine }: { engine: MasteringEngine; view?: CenterView; onOpen?: (v: CenterView) => void }) {
  const view = useDock(s => s.view)
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const srcA = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const hasTrack = useMastering(s => !!s.activeId)
  const tpl = useUi(s => s.templateParams)
  const [drag, setDrag] = useState<SlotId | null>(null)
  const grRefs = useRef<Partial<Record<SlotId, HTMLSpanElement | null>>>({})

  // 체인 목록이 보일 때만 도킹 패널을 보인다(접힘·믹서 보기에서는 숨김)
  useEffect(() => {
    useDock.getState().set({ chain: true })
    return () => useDock.getState().set({ chain: false })
  }, [])

  // 게인 리덕션 미니 막대 — rAF 하나로 모든 행을 갱신
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      for (const k of Object.keys(GR_PICK) as SlotId[]) {
        const el = grRefs.current[k]
        if (!el) continue
        const gr = m && !engine.paused ? GR_PICK[k]!(m) : 0
        el.style.width = `${Math.min(100, (-gr / 12) * 100)}%`
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  const dropOn = (onto: SlotId) => {
    if (!drag || drag === onto) return
    setParams(p => { const o = p.order.filter(s => s !== drag); o.splice(o.indexOf(onto), 0, drag); return { ...p, order: o } }, 'order')
  }
  const toggle = (s: SlotId) => setParams(p => ({ ...p, bypass: { ...p.bypass, [s]: !p.bypass[s] } }), `bypass:${s}`)

  return (
    <div className="flex flex-col gap-1" aria-label="체인" data-tour="chain">
      <div className="ms-colhead">체인 <span className="font-normal faint">위에서 아래로 소리가 흘러요</span></div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 px-1 pb-1">
        {KINDS.map(k => <span key={k.id} className="text-[10px] dim inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: k.color }} />{k.label}</span>)}
      </div>
      <ol className="ms-chainlist flex flex-col gap-[3px]" data-testid="chain-list" style={{ maxHeight: CHAIN_LIST_MAX_H, overflowY: 'auto', overflowX: 'hidden' }}>
        {params.order.map(s => {
          const on = !params.bypass[s]
          const selected = view?.kind === 'slot' && view.slot === s
          const changed = !!tpl && (tpl.bypass[s] !== params.bypass[s] || JSON.stringify(tpl[s]) !== JSON.stringify(params[s]))
          return (
            <li key={s} className={`ms-mod ${selected ? 'sel' : ''} ${drag === s ? 'drag' : ''} ${on ? '' : 'off'}`}
              draggable onDragStart={e => { setDrag(s); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { if (drag) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); dropOn(s); setDrag(null) }}
              onDragEnd={() => setDrag(null)}>
              <button type="button" className="led" aria-pressed={on} aria-label={`${MODULE_LABEL[s]} ${on ? '끄기' : '켜기'}`} title={on ? '켜짐 — 눌러서 끄기' : '꺼짐 — 눌러서 켜기'} onClick={() => toggle(s)} />
              <button type="button" className="name" aria-label={`${MODULE_LABEL[s]} 설정 열기`} aria-current={selected || undefined} title={SLOT_HELP[s]} onClick={() => openDock({ kind: 'slot', slot: s })}>
                <span className="t"><span className="kdot" style={{ background: kindColor(s) }} />{MODULE_LABEL[s]}{changed && <span className="chg" title="템플릿 값에서 바뀜" aria-label="템플릿 값에서 바뀜">●</span>}</span>
                <span className="d">{slotSummary(s, params)}</span>
              </button>
              {GR_PICK[s] && <span className="gr" title="지금 누르고 있는 양"><span ref={el => { grRefs.current[s] = el }} /></span>}
              <GripVertical className="w-3.5 h-3.5 faint flex-none cursor-grab" aria-hidden />
            </li>
          )
        })}
      </ol>
      <div className="ms-mod" style={{ cursor: 'default' }}>
        <span className="text-[11px] dim" title="체인으로 들어가는 소리 크기 — 보통 -18 LUFS 근처가 좋아요">입력</span>
        <input type="range" min={-24} max={24} step={0.5} value={params.inputTrim} aria-label="입력 크기" className="flex-1 min-w-0 accent-[var(--m-green)]"
          onChange={e => setParams(p => ({ ...p, inputTrim: Number(e.target.value) }), 'inputTrim')} onDoubleClick={() => setParams(p => ({ ...p, inputTrim: 0 }), 'inputTrim')} />
        <span className="mono text-[11px] w-10 text-right">{params.inputTrim > 0 ? '+' : ''}{params.inputTrim.toFixed(1)}</span>
        <button type="button" className="ms-btn" onClick={autoInputGain} disabled={!hasTrack || !srcA} title="체인 입력을 -18 LUFS 근처로 맞춰요"><Gauge className="w-3.5 h-3.5" /> 맞춤</button>
      </div>
    </div>
  )
}

/** view·onOpen 은 예전 가운데 패널용(받기만 한다) */
export const ToolList: React.FC<{ view?: CenterView; onOpen?: (v: CenterView) => void }> = () => {
  const view = useDock(s => s.view)
  return (
    <div className="flex flex-col gap-1" aria-label="도구">
      <div className="ms-colhead">도구</div>
      <div className="grid grid-cols-2 gap-[3px]">
        {TOOLS.map(t => (
          <button key={t.id} type="button" className="ms-tool" aria-pressed={view?.kind === 'tool' && view.tool === t.id} title={t.help} onClick={() => openDock({ kind: 'tool', tool: t.id })}>{t.label}</button>
        ))}
      </div>
    </div>
  )
}

export function ToolPanel({ tool, ctx, folded, onFold, onClose }: { tool: ToolId; ctx: ViewCtx; folded?: boolean; onFold?: () => void; onClose?: () => void }) {
  const t = TOOLS.find(x => x.id === tool)!
  if (folded) return <section className="ms-modpanel folded" aria-label="도구 패널"><DockHead title={t.label} folded onFold={onFold} onClose={onClose} /></section>
  return (
    <section className="ms-modpanel tool" aria-label="도구 패널">
      <DockHead title={t.label} onFold={onFold} onClose={onClose}><span className="text-[11px] dim truncate max-w-[420px] hidden lg:inline">{t.help}</span></DockHead>
      <div className="ms-toolbody">
      {tool === 'reference' && <ReferencePanel onPickLibrary={ctx.openReferencePicker} />}
      {tool === 'analysis' && <AnalysisPanel />}
      {tool === 'edit' && <EditPanel autoTarget={ctx.autoTarget} setAutoTarget={ctx.setAutoTarget} />}
      {tool === 'album' && <AlbumPanel />}
      {tool === 'stems' && <StemsPanel />}
      {tool === 'markers' && <MemoryLocations />}
      {tool === 'templates' && <><AutoNotes /><TemplatesPanel /></>}
      {tool === 'export' && <ExportPanel />}
      </div>
    </section>
  )
}

function MemoryLocations() {
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId))
  const update = useMastering(s => s.updateTrack)
  if (!t) return <p className="dim">곡을 먼저 열어 주세요.</p>
  const set = (m: typeof t.markers) => update(t.id, x => ({ ...x, markers: m }), 'markers')
  return (
    <table className="text-[12px] w-full max-w-[640px]">
      <thead><tr className="dim text-left"><th className="font-normal w-8">#</th><th className="font-normal">이름</th><th className="font-normal w-28">위치</th><th className="w-28" /></tr></thead>
      <tbody>
        {t.markers.map((m, i) => (
          <tr key={m.id} className="border-t border-[var(--m-line-soft)]">
            <td className="mono text-[var(--m-yellow)]">{i + 1}</td>
            <td><input value={m.name} onChange={e => set(t.markers.map(x => (x.id === m.id ? { ...x, name: e.target.value } : x)))} className="ms-input w-full" aria-label={`마커 ${i + 1} 이름`} /></td>
            <td className="mono">{fmtClock(m.time)}</td>
            <td className="text-right whitespace-nowrap">
              <button type="button" className="ms-btn mr-1" onClick={() => getEngine()?.seek(m.time)}>이동</button>
              <button type="button" className="ms-btn" onClick={() => set(t.markers.filter(x => x.id !== m.id))}>지우기</button>
            </td>
          </tr>
        ))}
        {!t.markers.length && <tr><td colSpan={4} className="faint py-2">마커가 없어요. 재생 중 M 키를 누르거나 전송 줄의 깃발을 누르세요. 파형 위 번호 깃발을 끌면 옮겨져요.</td></tr>}
      </tbody>
    </table>
  )
}

const UNDO_MAP: Record<string, string> = { order: '모듈 순서', auto: '자동 맞춤', automaster: '다시 분석', template: '스타일', markers: '마커', target: '목표 음량', inputTrim: '입력 맞춤', preset: '프리셋', reset: '초기화', match: '톤 맞추기', recommend: '추천값', excite: '선명하게' }
function undoLabel(k: string) {
  if (k.startsWith('slot:')) return MODULE_LABEL[k.slice(5) as SlotId] ?? '모듈'
  if (k.startsWith('bypass:')) return `${MODULE_LABEL[k.slice(7) as SlotId] ?? ''} 켬/끔`
  return UNDO_MAP[k.split(':')[0]] ?? '편집'
}

export function StatusLine({ engine }: { engine: MasteringEngine }) {
  const params = useMastering(s => s.params)
  const tracks = useMastering(s => s.tracks.length)
  const active = useMastering(s => s.tracks.find(t => t.id === s.activeId) ?? null)
  const lastKey = useMastering(s => s.lastKey)
  useUi(s => s.busy) // 바쁨이 끝나면 지연 값도 다시 그린다
  const latencyMs = engine.meters ? (engine.meters.latency / (engine.ctx?.sampleRate ?? 48000)) * 1000 : 0
  return (
    <div className="ms-status">
      <span className="truncate">{active ? `${engine.ctx?.sampleRate ?? 48000} Hz 재생 · 곡 ${tracks}개 · 처리 지연 ${latencyMs.toFixed(1)} ms · 켜진 모듈 ${ALL_SLOTS.filter(s => !params.bypass[s]).length}/${ALL_SLOTS.length}` : '곡 없음'}</span>
      <span>{lastKey ? `마지막 변경: ${undoLabel(lastKey)}` : ''}</span>
    </div>
  )
}
