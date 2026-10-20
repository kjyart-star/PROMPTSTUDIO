'use client'

/**
 * 떠 있는 플러그인 창 — 제목줄(접기·닫기, 끌어서 이동) · 프리셋/바이패스 줄 · 그래프 · 「이름 · 슬라이더 · 값」 표.
 * 여러 개를 동시에 열 수 있다.
 */
import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { MATCH_FREQS, type ChainParams, type SlotId } from '@/lib/mastering/dsp'
import { SLOT_LABEL, defaultChain } from '@/lib/mastering/presets'
import { fmtValue, quantize, toNorm, fromNorm } from './controls'
import { EqGraph, TransferCurve, SatCurve } from './Plugins'
import { SCHEMA, getPath, setPath, resetSlot, type Row } from './paramSchema'
import type { MasteringEngine } from './engine'

export interface WinState { slot: SlotId; x: number; y: number; z: number; collapsed: boolean }

type Num = Extract<Row, { kind: 'num' }>

function HSlider({ row, value, onChange, disabled }: { row: Num; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; t: number } | null>(null)
  const scale = row.scale ?? 'lin', step = row.step ?? 0.1
  const t = Math.min(1, Math.max(0, toNorm(value, row.min, row.max, scale)))
  const zero = row.min < 0 && row.max > 0 && scale === 'lin' ? toNorm(0, row.min, row.max, scale) : 0
  const setFromX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const nt = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    onChange(quantize(fromNorm(nt, row.min, row.max, scale), step, row.min, row.max))
    return nt
  }
  return (
    <div
      ref={ref}
      className="ms-hs"
      role="slider"
      aria-label={row.label}
      aria-valuemin={row.min}
      aria-valuemax={row.max}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      title="끌거나 눌러 조절 · Shift 미세 · 더블클릭 기본값"
      onPointerDown={e => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const nt = e.shiftKey ? t : setFromX(e.clientX)
        drag.current = { x: e.clientX, t: nt }
      }}
      onPointerMove={e => {
        const d = drag.current
        if (!d || disabled) return
        const w = ref.current!.getBoundingClientRect().width
        d.t = Math.min(1, Math.max(0, d.t + ((e.clientX - d.x) / w) * (e.shiftKey ? 0.1 : 1)))
        d.x = e.clientX
        onChange(quantize(fromNorm(d.t, row.min, row.max, scale), step, row.min, row.max))
      }}
      onPointerUp={() => { drag.current = null }}
      onDoubleClick={() => !disabled && onChange(row.def)}
      onKeyDown={e => {
        if (disabled) return
        const k = e.shiftKey ? 0.002 : 0.02
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(quantize(fromNorm(Math.min(1, t + k), row.min, row.max, scale), step, row.min, row.max)) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(quantize(fromNorm(Math.max(0, t - k), row.min, row.max, scale), step, row.min, row.max)) }
      }}
    >
      <div className="fill" style={{ left: `${Math.min(zero, t) * 100}%`, width: `${Math.abs(t - zero) * 100}%` }} />
      <div className="thumb" style={{ left: `${t * 100}%` }} />
    </div>
  )
}

function ValueCell({ row, value, onChange }: { row: Num; value: number; onChange: (v: number) => void }) {
  const [edit, setEdit] = useState<string | null>(null)
  const text = row.fmt ? row.fmt(value)
    : row.unit === 'Hz' ? (value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`)
    : `${fmtValue(value, row.unit, row.step ?? 0.1)}${row.unit ? ` ${row.unit}` : ''}`
  if (edit !== null) {
    return (
      <input autoFocus value={edit} onChange={e => setEdit(e.target.value)} onBlur={() => setEdit(null)} aria-label={`${row.label} 값 입력`}
        onKeyDown={e => {
          if (e.key === 'Enter') { let v = parseFloat(edit); if (/k$/i.test(edit.trim())) v *= 1000; if (Number.isFinite(v)) onChange(quantize(v, row.step ?? 0.1, row.min, row.max)); setEdit(null) }
          if (e.key === 'Escape') setEdit(null)
        }}
        className="ms-input mono w-full" />
    )
  }
  return <button type="button" className="val text-left hover:text-white" onClick={() => setEdit(String(value))} title="눌러서 직접 입력">{text}</button>
}

export function ParamTable({ slot, p, set }: { slot: SlotId; p: ChainParams; set: (fn: (p: ChainParams) => ChainParams) => void }) {
  return (
    <div className="ms-ptable">
      {SCHEMA[slot].map((row, i) => {
        if (row.kind === 'section') return <div key={i} className="sec">{row.label}</div>
        const v = getPath(p, row.path)
        const upd = (nv: unknown) => set(c => setPath(c, row.path, nv))
        return (
          <React.Fragment key={i}>
            <span className="lbl" title={row.label}>{row.label}</span>
            {row.kind === 'num' && <HSlider row={row} value={Number(v)} onChange={upd} />}
            {row.kind === 'num' && <ValueCell row={row} value={Number(v)} onChange={upd} />}
            {row.kind === 'bool' && (
              <>
                <div><button type="button" className="ms-btn" aria-pressed={!!v} onClick={() => upd(!v)} style={v ? { borderColor: 'var(--m-green-dim)', color: 'var(--m-green)' } : undefined}>{v ? row.on : row.off}</button></div>
                <span />
              </>
            )}
            {row.kind === 'select' && (
              <>
                <select className="ms-select" value={String(v)} aria-label={row.label}
                  onChange={e => { const o = row.options.find(x => String(x.value) === e.target.value); if (o) upd(o.value) }}>
                  {row.options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                </select>
                <span className="val">{row.options.find(o => o.value === v)?.label}</span>
              </>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const pick = {
  comp: (m: NonNullable<MasteringEngine['meters']>) => m.compGr,
  limiter: (m: NonNullable<MasteringEngine['meters']>) => m.limGr,
  gate: (m: NonNullable<MasteringEngine['meters']>) => m.gateGr,
  deesser: (m: NonNullable<MasteringEngine['meters']>) => m.deessGr,
  multiband: (m: NonNullable<MasteringEngine['meters']>) => Math.min(...m.mbGr),
} as Partial<Record<SlotId, (m: NonNullable<MasteringEngine['meters']>) => number>>

function Graph({ slot, p, set }: { slot: SlotId; p: ChainParams; set: (fn: (p: ChainParams) => ChainParams) => void }) {
  if (slot === 'eq') return <EqGraph eq={p.eq} onChange={fn => set(c => ({ ...c, eq: fn(c.eq) }))} />
  if (slot === 'comp') return <div className="flex justify-center"><TransferCurve threshold={p.comp.threshold} ratio={p.comp.ratio} knee={p.comp.knee} makeup={p.comp.makeup} /></div>
  if (slot === 'saturation') return <div className="flex justify-center"><SatCurve drive={p.saturation.drive} mode={p.saturation.mode} /></div>
  if (slot === 'match') {
    const W = 400, H = 90
    const x = (i: number) => (i / (MATCH_FREQS.length - 1)) * W
    const y = (db: number) => H / 2 - (db / 12) * (H / 2 - 6)
    const has = p.match.curve.some(v => Math.abs(v) > 0.01)
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px] block rounded bg-[var(--m-well)]" preserveAspectRatio="none" aria-label="매칭 곡선">
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#3a3d42" />
          {has && <polyline fill="none" stroke="var(--m-green)" strokeWidth={2} vectorEffect="non-scaling-stroke" points={p.match.curve.map((v, i) => `${x(i)},${y((v * p.match.strength) / 100)}`).join(' ')} />}
        </svg>
        {!has && <p className="dim mt-1">곡선이 없어요. 아래 「레퍼런스」 탭에서 「레퍼런스 톤 맞추기」를 누르면 생겨요.</p>}
      </div>
    )
  }
  return null
}

export function PluginWindow({ w, p, set, engine, onMove, onClose, onFocus, onToggle }: {
  w: WinState
  p: ChainParams
  set: (fn: (p: ChainParams) => ChainParams) => void
  engine: MasteringEngine
  onMove: (x: number, y: number) => void
  onClose: () => void
  onFocus: () => void
  onToggle: () => void
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const bypass = p.bypass[w.slot]
  const gr = pick[w.slot]
  return (
    <div className="ms ms-win" style={{ left: w.x, top: w.y, zIndex: 60 + w.z, maxHeight: `max(220px, calc(100vh - ${Math.round(w.y)}px - 100px))` }} onPointerDown={onFocus} role="dialog" aria-label={`${SLOT_LABEL[w.slot]} 창`}>
      <div className="ms-win-title"
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { dx: e.clientX - w.x, dy: e.clientY - w.y }
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          onMove(Math.max(0, Math.min(window.innerWidth - 120, e.clientX - d.dx)), Math.max(0, Math.min(window.innerHeight - 40, e.clientY - d.dy)))
        }}
        onPointerUp={() => { drag.current = null }}
      >
        <button type="button" onClick={onToggle} aria-label={w.collapsed ? '펼치기' : '접기'} className="dim hover:text-white">{w.collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        <h3>마스터 · {SLOT_LABEL[w.slot]}</h3>
        <button type="button" onClick={onClose} aria-label={`${SLOT_LABEL[w.slot]} 창 닫기`} className="dim hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      {!w.collapsed && (
        <>
          <div className="ms-win-bar">
            <button type="button" className="ms-btn" onClick={() => set(c => resetSlot(c, w.slot, defaultChain()))} title="이 플러그인을 기본값으로">&lt;기본값&gt;</button>
            <button type="button" className="ms-btn" aria-pressed={bypass} onClick={() => set(c => ({ ...c, bypass: { ...c.bypass, [w.slot]: !c.bypass[w.slot] } }))}
              style={bypass ? { background: 'var(--m-amber)', color: '#1c1d1f', borderColor: 'var(--m-amber)' } : undefined}>
              바이패스
            </button>
            {gr && <MiniGr engine={engine} pick={gr} />}
          </div>
          <div className="ms-win-body">
            <div className="mb-2"><Graph slot={w.slot} p={p} set={set} /></div>
            <ParamTable slot={w.slot} p={p} set={set} />
          </div>
        </>
      )}
    </div>
  )
}

function MiniGr({ engine, pick: pk }: { engine: MasteringEngine; pick: (m: NonNullable<MasteringEngine['meters']>) => number }) {
  const bar = useRef<HTMLDivElement>(null)
  const txt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const gr = m && !engine.paused ? pk(m) : 0
      if (bar.current) bar.current.style.width = `${Math.min(100, (-gr / 18) * 100)}%`
      if (txt.current) txt.current.textContent = gr < -0.05 ? gr.toFixed(1) : '0.0'
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, pk])
  return (
    <div className="ml-auto flex items-center gap-2" title="게인 리덕션(dB)">
      <span className="dim">GR</span>
      <div className="relative w-20 h-2 rounded-sm bg-[var(--m-well)] overflow-hidden"><div ref={bar} className="absolute right-0 top-0 bottom-0 bg-[var(--m-amber)]" style={{ width: 0 }} /></div>
      <span ref={txt} className="mono w-9 text-right">0.0</span>
    </div>
  )
}
