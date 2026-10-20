'use client'

/**
 * 모듈 패널(타임라인 바로 아래 가로 전체 폭 도킹) — 머리줄 32px(이름 · 기본값 · 템플릿 값 · 바이패스 · 접기 · 닫기)
 * · 「이 모듈은?」 · 왼쪽 큰 그래프 + 오른쪽 밴드별/섹션별 파라미터 열(작은 노브). 한 번에 하나만 열린다. 떠 있는 창은 없다.
 */
import React, { useEffect, useRef, useState } from 'react'
import { RotateCcw, Wand2, X, ChevronDown, CircleHelp } from 'lucide-react'
import { MATCH_FREQS, type ChainParams, type SlotId } from '@/lib/mastering/dsp'
import { defaultChain } from '@/lib/mastering/presets'
import { fmtValue, quantize, toNorm, fromNorm, Knob } from './controls'
import { EqGraph, TransferCurve, SatCurve } from './Plugins'
import { SCHEMA, getPath, setPath, resetSlot, paramColumns, type Row, type ParamRow } from './paramSchema'
import { moduleHelp, dangerFix } from './moduleHelp'
import { MODULE_LABEL, GR_PICK, kindColor } from './labels'
import { useUi } from './actions'
import type { MasteringEngine } from './engine'

type Num = Extract<Row, { kind: 'num' }>
type Meters = NonNullable<MasteringEngine['meters']>
type Set = (fn: (p: ChainParams) => ChainParams) => void

function HSlider({ row, value, onChange, disabled }: { row: Num; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; t: number } | null>(null)
  const scale = row.scale ?? 'lin', step = row.step ?? 0.1
  const t = Math.min(1, Math.max(0, toNorm(value, row.min, row.max, scale)))
  const zero = row.min < 0 && row.max > 0 && scale === 'lin' ? toNorm(0, row.min, row.max, scale) : 0
  const setFromX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const nt = Math.min(1, Math.max(0, (clientX - r.left) / (r.width || 1)))
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
      title={`${row.help ? `${row.help}\n` : ''}끌거나 눌러 조절 · Shift 미세 · 더블클릭 기본값`}
      onPointerDown={e => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const nt = e.shiftKey ? t : setFromX(e.clientX)
        drag.current = { x: e.clientX, t: nt }
      }}
      onPointerMove={e => {
        const d = drag.current
        if (!d || disabled) return
        const w = ref.current!.getBoundingClientRect().width || 1
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

function ValueCell({ row, value, onChange, changed }: { row: Num; value: number; onChange: (v: number) => void; changed?: boolean }) {
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
  return <button type="button" className={`val text-left hover:text-white ${changed ? 'changed' : ''}`} onClick={() => setEdit(String(value))} title={changed ? '템플릿 값에서 바뀜 — 눌러서 직접 입력' : '눌러서 직접 입력'}>{text}</button>
}

/** 파라미터 표 — 넓으면 두 열로 */
export function ParamTable({ slot, p, set }: { slot: SlotId; p: ChainParams; set: Set }) {
  const tpl = useUi(s => s.templateParams)
  return (
    <div className="ms-ptable">
      {SCHEMA[slot].map((row, i) => {
        if (row.kind === 'section') return <div key={i} className="sec">{row.label}</div>
        const v = getPath(p, row.path)
        const upd = (nv: unknown) => set(c => setPath(c, row.path, nv))
        const changed = !!tpl && getPath(tpl, row.path) !== v
        return (
          <div key={i} className="ms-prow">
            <span className="lbl" title={row.help ? `${row.label} — ${row.help}` : row.label}>{row.label}</span>
            {row.kind === 'num' && <HSlider row={row} value={Number(v)} onChange={upd} />}
            {row.kind === 'num' && <ValueCell row={row} value={Number(v)} onChange={upd} changed={changed} />}
            {row.kind === 'bool' && (
              <>
                <div><button type="button" className={`ms-btn ${changed ? 'changed' : ''}`} aria-pressed={!!v} title={changed ? `템플릿 값에서 바뀜 · ${row.help ?? ''}` : row.help} onClick={() => upd(!v)} style={v ? { borderColor: 'var(--m-green-dim)', color: 'var(--m-green)' } : undefined}>{v ? row.on : row.off}</button></div>
                <span />
              </>
            )}
            {row.kind === 'select' && (
              <>
                <select className="ms-select" value={String(v)} aria-label={row.label} title={row.help}
                  onChange={e => { const o = row.options.find(x => String(x.value) === e.target.value); if (o) upd(o.value) }}>
                  {row.options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                </select>
                <span className={changed ? 'val changed' : 'val'}>{changed ? '바뀜' : ''}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 캔버스 크기 맞추기 — 그리기 문맥이 없으면(테스트 환경 등) null */
function ctx2d(c: HTMLCanvasElement) {
  const g = c.getContext('2d')
  if (!g) return null
  const dpr = window.devicePixelRatio || 1
  const w = c.clientWidth, h = c.clientHeight
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { g, w, h }
}

/** EQ 곡선 + 실시간 스펙트럼(처리 전 회색 · 처리 후 녹색) */
export function EqWithSpectrum({ p, set, engine, height = 200 }: { p: ChainParams; set: Set; engine: MasteringEngine; height?: number }) {
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    let post: Float32Array<ArrayBuffer> | null = null, pre: Float32Array<ArrayBuffer> | null = null
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const c = cv.current
      if (!c) return
      const r = ctx2d(c)
      if (!r) return
      const { g, w, h } = r
      g.fillStyle = '#121314'; g.fillRect(0, 0, w, h)
      const an = engine.postAnalyser, pa = engine.preAnalyser
      if (!an || !pa || !engine.ctx || engine.paused) return
      if (!post || post.length !== an.frequencyBinCount) { post = new Float32Array(an.frequencyBinCount); pre = new Float32Array(pa.frequencyBinCount) }
      an.getFloatFrequencyData(post); pa.getFloatFrequencyData(pre!)
      const nyq = engine.ctx.sampleRate / 2
      const fx = (f: number) => (Math.log(f / 20) / Math.log(1000)) * w
      const dy = (db: number) => h - ((Math.max(-96, Math.min(0, db)) + 96) / 96) * h
      const path = (d: Float32Array) => {
        g.beginPath()
        const cols = Math.floor(w / 2)
        for (let k = 0; k <= cols; k++) {
          const f = 20 * Math.pow(1000, k / cols)
          const b0 = Math.max(1, Math.floor((f / 1.06 / nyq) * d.length)), b1 = Math.min(d.length - 1, Math.ceil((f * 1.06 / nyq) * d.length))
          let mx = -200
          for (let b = b0; b <= b1; b++) if (d[b] > mx) mx = d[b]
          if (k === 0) g.moveTo(fx(f), dy(mx + 10)); else g.lineTo(fx(f), dy(mx + 10))
        }
      }
      path(pre!); g.strokeStyle = 'rgba(170,175,182,0.35)'; g.lineWidth = 1; g.stroke()
      path(post); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fillStyle = 'rgba(82,210,126,0.12)'; g.fill()
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])
  return (
    <div className="relative rounded-lg overflow-hidden border border-[var(--m-line-soft)]" style={{ height }}>
      <canvas ref={cv} className="absolute inset-0 w-full h-full block" aria-hidden />
      <EqGraph bare eq={p.eq} onChange={fn => set(c => ({ ...c, eq: fn(c.eq) }))} />
    </div>
  )
}

/** 최근 10초 게인 리덕션 그래프 — 리미터는 들어옴/나감 레벨과 천장도 함께 */
function GrGraph({ engine, pick: pk, ceiling, height = 200 }: { engine: MasteringEngine; pick: (m: Meters) => number; ceiling?: number; height?: number }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const inTxt = useRef<HTMLSpanElement>(null)
  const outTxt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0, last = 0
    const N = 300 // 30회/초 × 10초
    const hist = new Float32Array(N)
    let head = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 33) return
      last = now
      const m = engine.meters
      const on = !engine.paused
      hist[head] = m && on ? Math.min(0, pk(m)) : 0
      head = (head + 1) % N
      const db = (x: number) => (x > 1e-6 ? 20 * Math.log10(x) : -Infinity)
      const f = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-∞')
      if (inTxt.current) inTxt.current.textContent = f(m && on ? db(Math.max(m.inLevel.peakL, m.inLevel.peakR)) : -Infinity)
      if (outTxt.current) {
        const o = m && on ? db(Math.max(m.outLevel.peakL, m.outLevel.peakR)) : -Infinity
        outTxt.current.textContent = f(o)
        outTxt.current.style.color = ceiling !== undefined && Number.isFinite(o) && o > ceiling + 0.05 ? 'var(--m-red)' : 'var(--m-text)'
      }
      const c = cv.current
      if (!c) return
      const r = ctx2d(c)
      if (!r) return
      const { g, w, h } = r
      g.fillStyle = '#121314'; g.fillRect(0, 0, w, h)
      const Y = (v: number) => (Math.min(18, -v) / 18) * (h - 14)
      g.strokeStyle = '#26282b'; g.fillStyle = '#868b93'; g.font = '10px ui-monospace, monospace'; g.textAlign = 'left'
      for (const d of [0, -3, -6, -12]) { const y = Y(d) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillText(`${d}`, 3, y + 10) }
      g.fillText('10초 전', 3, h - 2); g.textAlign = 'right'; g.fillText('지금', w - 3, h - 2)
      g.beginPath(); g.moveTo(0, 0)
      for (let i = 0; i < N; i++) g.lineTo((i / (N - 1)) * w, Y(hist[(head + i) % N]))
      g.lineTo(w, 0); g.closePath()
      g.fillStyle = 'rgba(240,164,58,0.35)'; g.fill()
      g.strokeStyle = '#f0a43a'; g.lineWidth = 1.5; g.stroke(); g.lineWidth = 1
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, ceiling, pk])
  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      <canvas ref={cv} className="w-full block rounded-lg border border-[var(--m-line-soft)]" style={{ height }} aria-label="최근 10초 게인 리덕션" />
      {ceiling !== undefined && (
        <div className="flex gap-4 text-[11px]">
          <span className="dim" title="리미터로 들어오는 소리의 최고 높이">들어옴 <span ref={inTxt} className="mono text-[var(--m-text)]">-∞</span> dB</span>
          <span className="dim" title="리미터를 지난 소리의 최고 높이 — 천장을 넘으면 빨강">나감 <span ref={outTxt} className="mono">-∞</span> dB</span>
          <span className="dim">천장 <span className="mono text-[var(--m-text)]">{ceiling.toFixed(1)}</span> dB</span>
        </div>
      )}
    </div>
  )
}

/** 넓이 시각화 — 막대(100% = 원래 그대로) */
function WidthBars({ rows }: { rows: [string, number][] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: '52px 1fr 44px' }} aria-label="넓이">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="text-[11px] dim">{k}</span>
          <div className="relative h-3 rounded-md bg-[var(--m-well)] overflow-hidden">
            <span className="absolute top-0 bottom-0 bg-[#b07be8]/70" style={{ left: `${50 - Math.min(200, v) / 4}%`, width: `${Math.min(200, v) / 2}%` }} />
            <span className="absolute top-[-2px] bottom-[-2px] left-[25%] w-px bg-[var(--m-line)]" />
            <span className="absolute top-[-2px] bottom-[-2px] left-[75%] w-px bg-[var(--m-line)]" />
          </div>
          <span className="mono text-[11px] text-right">{Math.round(v)}%</span>
        </React.Fragment>
      ))}
    </div>
  )
}

/** 간단 시각화 — 값마다 가운데(0)에서 뻗는 막대 */
function ValueBars({ rows }: { rows: { label: string; v: number; min: number; max: number; unit: string }[] }) {
  return (
    <div className="grid gap-x-2 gap-y-1.5 items-center" style={{ gridTemplateColumns: 'minmax(64px, auto) 1fr 56px' }} aria-label="값 막대">
      {rows.map(r => {
        const zero = r.min < 0 ? -r.min / (r.max - r.min) : 0
        const t = (Math.min(r.max, Math.max(r.min, r.v)) - r.min) / (r.max - r.min)
        return (
          <React.Fragment key={r.label}>
            <span className="text-[11px] dim whitespace-nowrap">{r.label}</span>
            <div className="ms-bar">
              {r.min < 0 && <span className="mid" />}
              <span className="v" style={{ left: `${Math.min(zero, t) * 100}%`, width: `${Math.abs(t - zero) * 100}%`, background: 'var(--m-green)' }} />
            </div>
            <span className="mono text-[11px] text-right">{r.v > 0 && r.min < 0 ? '+' : ''}{r.v.toFixed(r.unit === '%' ? 0 : 1)} {r.unit}</span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

const GRAPH_H = 200

function Graph({ slot, p, set, engine }: { slot: SlotId; p: ChainParams; set: Set; engine: MasteringEngine }) {
  const gr = GR_PICK[slot]
  if (slot === 'eq') return <EqWithSpectrum p={p} set={set} engine={engine} height={GRAPH_H} />
  if (slot === 'limiter') return <GrGraph engine={engine} pick={GR_PICK.limiter!} ceiling={p.limiter.ceiling} height={GRAPH_H - 26} />
  if (slot === 'comp') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1.5 flex-none"><TransferCurve threshold={p.comp.threshold} ratio={p.comp.ratio} knee={p.comp.knee} makeup={p.comp.makeup} /><p className="text-[11px] dim leading-relaxed max-w-[120px]">대각선보다 아래로 꺾인 만큼 큰 소리를 눌러요.</p></div>
        <GrGraph engine={engine} pick={gr!} height={GRAPH_H - 10} />
      </div>
    )
  }
  if (slot === 'multiband') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          {['저역', '중역', '고역'].map((nm, i) => (
            <div key={nm} className="flex flex-col items-center gap-1">
              <TransferCurve threshold={p.multiband.bands[i].threshold} ratio={p.multiband.bands[i].ratio} knee={6} makeup={p.multiband.bands[i].gain} />
              <span className="text-[11px] dim">{nm}</span>
            </div>
          ))}
        </div>
        <GrGraph engine={engine} pick={gr!} height={80} />
      </div>
    )
  }
  if (slot === 'saturation') return <div className="flex items-center gap-3"><SatCurve drive={p.saturation.drive} mode={p.saturation.mode} /><p className="text-[11px] dim leading-relaxed">곡선이 위아래로 둥글게 휠수록 색이 진해져요.</p></div>
  if (slot === 'stereo') return <WidthBars rows={[['전체', p.stereo.width]]} />
  if (slot === 'imager') return <WidthBars rows={[['저역', p.imager.widths[0]], ['중역', p.imager.widths[1]], ['고역', p.imager.widths[2]]]} />
  if (slot === 'match') {
    const W = 400, H = 90
    const x = (i: number) => (i / (MATCH_FREQS.length - 1)) * W
    const y = (db: number) => H / 2 - (db / 12) * (H / 2 - 6)
    const has = p.match.curve.some(v => Math.abs(v) > 0.01)
    return (
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px] block rounded-lg bg-[var(--m-well)]" preserveAspectRatio="none" aria-label="매칭 곡선">
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#3a3d42" />
          {has && <polyline fill="none" stroke="var(--m-green)" strokeWidth={2} vectorEffect="non-scaling-stroke" points={p.match.curve.map((v, i) => `${x(i)},${y((v * p.match.strength) / 100)}`).join(' ')} />}
        </svg>
        {!has && <p className="dim mt-1">곡선이 없어요. 왼쪽 도구의 「레퍼런스」에서 「레퍼런스 톤 맞추기」를 누르면 생겨요.</p>}
      </div>
    )
  }
  if (gr) return <GrGraph engine={engine} pick={gr} height={GRAPH_H - 10} />
  // 그 외(가운데·양옆 다듬기 · 타격감 · 부드러운 깎기) — dB·% 값 막대
  const rows = SCHEMA[slot].filter((r): r is Num => r.kind === 'num' && (r.unit === 'dB' || r.unit === '%') && r.min < r.max)
  const pre = slot === 'mseq' ? (r: Num) => `${r.path.includes('.mid.') ? '미드' : '사이드'} ${r.label}` : (r: Num) => r.label
  return <ValueBars rows={rows.map(r => ({ label: pre(r), v: Number(getPath(p, r.path)), min: r.min, max: r.max, unit: r.unit ?? '' }))} />
}

/** 도킹 패널 머리줄(32px 한 줄) — 모듈·도구 공통 */
export function DockHead({ title, color, folded, onFold, onClose, children, lead }: {
  title: string
  color?: string
  /** 제목 바로 옆 한 줄(좁으면 말줄임) */
  lead?: React.ReactNode
  folded?: boolean
  onFold?: () => void
  onClose?: () => void
  children?: React.ReactNode
}) {
  return (
    <header className="ms-dockhead">
      {color && <span className="dot" style={{ background: color }} />}
      <h3>{title}</h3>
      {lead && <div className="lead">{lead}</div>}
      <div className="acts">
        {children}
        {onFold && (
          <button type="button" className="ms-btn" aria-expanded={!folded} onClick={onFold} title={folded ? '패널 펼치기' : '패널을 제목 줄만 남기고 접기'}>
            {folded ? '펼치기' : '접기'} <ChevronDown className="w-3.5 h-3.5" style={folded ? { transform: 'rotate(180deg)' } : undefined} />
          </button>
        )}
        {onClose && <button type="button" className="ms-btn" onClick={onClose} aria-label="패널 닫기" title="닫기"><X className="w-3.5 h-3.5" /></button>}
      </div>
    </header>
  )
}

/** 「이 모듈은?」 — 머리줄 안 한 줄(ModuleHelpLine) + 펼치면 아래에 무엇을·언제·추천 시작값·흔한 실수(ModuleHelpBody) */
function ModuleHelpLine({ slot, open, onToggle }: { slot: SlotId; open: boolean; onToggle: () => void }) {
  const h = moduleHelp(slot)
  return (
    <div className="ms-modhelp">
      <div className="line">
        <button type="button" className="q" aria-expanded={open} onClick={onToggle}>
          <CircleHelp className="w-3.5 h-3.5" /> 이 모듈은?
        </button>
        <span className="dim min-w-0">{h.what}</span>
      </div>
    </div>
  )
}

function ModuleHelpBody({ slot }: { slot: SlotId }) {
  const h = moduleHelp(slot)
  return (
    <div className="ms-modhelp">
        <dl aria-label="모듈 도움말">
          <dt>무엇을</dt><dd>{h.what}</dd>
          <dt>언제 쓰나요</dt><dd>{h.when}</dd>
          <dt>추천 시작값</dt><dd>{h.start}</dd>
          <dt>흔한 실수</dt><dd>{h.mistake}</dd>
        </dl>
    </div>
  )
}

const shortLabel = (label: string, col: string) => (label === col ? '켬' : col && label.startsWith(`${col} `) ? label.slice(col.length + 1) : label)

function ParamCell({ row, col, p, set, recommend }: { row: ParamRow; col: string; p: ChainParams; set: Set; recommend: Set }) {
  const tpl = useUi(s => s.templateParams)
  const v = getPath(p, row.path)
  const upd = (nv: unknown) => set(c => setPath(c, row.path, nv))
  const changed = !!tpl && getPath(tpl, row.path) !== v
  const short = shortLabel(row.label, col)
  const tip = `${row.label}${row.help ? ` — ${row.help}` : ''}${changed ? '\n템플릿 값에서 바뀜' : ''}`
  if (row.kind === 'bool') {
    return (
      <button type="button" className={`ms-ptog ${changed ? 'changed' : ''}`} aria-pressed={!!v} aria-label={col ? `${col} ${short}` : short} title={tip} onClick={() => upd(!v)}>
        <span className="led" />{short === '켬' ? (v ? '켬' : '끔') : short}
      </button>
    )
  }
  if (row.kind === 'select') {
    return (
      <label className={`ms-psel ${changed ? 'changed' : ''}`} title={tip}>
        <span>{short}</span>
        <select className="ms-select" value={String(v)} aria-label={row.label}
          onChange={e => { const o = row.options.find(x => String(x.value) === e.target.value); if (o) upd(o.value) }}>
          {row.options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      </label>
    )
  }
  const d = dangerFix(row.path, v, p)
  return (
    <div className={`ms-pcell ${d ? 'warn' : ''} ${changed ? 'changed' : ''}`} role="group" aria-label={row.label} title={d ? `${tip}\n주의: ${d.why}` : tip}>
      <Knob label={short} value={Number(v)} min={row.min} max={row.max} def={row.def} step={row.step ?? 0.1} unit={row.unit} scale={row.scale}
        format={row.fmt} onChange={upd} size={28} color={d ? 'var(--m-amber)' : 'var(--m-green)'} bipolar={row.min < 0 && row.max > 0} />
      {d && (
        <button type="button" className="ms-rec" title={`${d.why} — ${row.label}을(를) ${d.fix}${row.unit ? ` ${row.unit}` : ''}(으)로`}
          onClick={() => recommend(c => setPath(c, row.path, d.fix))}>추천값</button>
      )}
    </div>
  )
}

/** 파라미터 열 — 밴드·섹션마다 한 열(켬·모양 같은 스위치 위, 노브 아래) */
function ParamColumns({ slot, p, set, recommend }: { slot: SlotId; p: ChainParams; set: Set; recommend: Set }) {
  const cols = paramColumns(slot)
  return (
    <div className={`ms-pcols ${slot === 'eq' ? 'eq' : cols.length > 1 ? 'sec' : 'flat'}`} role="group" aria-label="파라미터">
      {cols.map(c => (
        <div key={c.label || 'all'} className="ms-pcol">
          {c.label && <div className="ms-pcolhead">{c.label}</div>}
          {c.rows.some(r => r.kind !== 'num') && (
            <div className="sw">{c.rows.filter(r => r.kind !== 'num').map(r => <ParamCell key={r.path} row={r} col={c.label} p={p} set={set} recommend={recommend} />)}</div>
          )}
          <div className="kn">{c.rows.filter(r => r.kind === 'num').map(r => <ParamCell key={r.path} row={r} col={c.label} p={p} set={set} recommend={recommend} />)}</div>
        </div>
      ))}
    </div>
  )
}

export function ModulePanel({ slot, p, set, engine, heading, onClose, folded, onFold, recommend }: {
  slot: SlotId
  p: ChainParams
  set: (fn: (p: ChainParams) => ChainParams) => void
  engine: MasteringEngine
  /** 제목(기본 「마스터 · 모듈 이름」) */
  heading?: string
  onClose?: () => void
  /** 접힘 — 제목 줄만 남는다 */
  folded?: boolean
  onFold?: () => void
  /** 「추천값」 버튼이 쓰는 변경(실행 취소 이름을 따로 남길 때) */
  recommend?: Set
}) {
  const bypass = p.bypass[slot]
  const gr = GR_PICK[slot]
  const templateParams = useUi(s => s.templateParams)
  // 도움말 펼침 — 모듈을 바꾸면 접힌다
  const [helpFor, setHelpFor] = useState<SlotId | null>(null)
  const helpOpen = helpFor === slot
  return (
    <section className={`ms-modpanel ${folded ? 'folded' : ''}`} aria-label="모듈 패널">
      <DockHead title={heading ?? `마스터 · ${MODULE_LABEL[slot]}`} color={kindColor(slot)} folded={folded} onFold={onFold} onClose={onClose}
        lead={folded ? undefined : <ModuleHelpLine slot={slot} open={helpOpen} onToggle={() => setHelpFor(helpOpen ? null : slot)} />}>
        {gr && !folded && <MiniGr engine={engine} pick={gr} />}
        <button type="button" className="ms-btn" onClick={() => set(c => resetSlot(c, slot, defaultChain()))} title="이 모듈을 처음 기본값으로"><RotateCcw className="w-3.5 h-3.5" /> 기본값</button>
        <button type="button" className="ms-btn" disabled={!templateParams} title={templateParams ? '이 모듈만 마지막 템플릿(자동 마스터링) 값으로' : '스타일을 한 번 적용하면 쓸 수 있어요'}
          onClick={() => templateParams && set(c => ({ ...resetSlot(c, slot, templateParams), bypass: { ...c.bypass, [slot]: templateParams.bypass[slot] } }))}>
          <Wand2 className="w-3.5 h-3.5" /> 템플릿 값으로 되돌리기
        </button>
        <button type="button" className="ms-btn" aria-pressed={bypass} onClick={() => set(c => ({ ...c, bypass: { ...c.bypass, [slot]: !c.bypass[slot] } }))}
          title={bypass ? '지금 이 모듈을 거치지 않아요 — 눌러서 다시 켜기' : '이 모듈을 거치지 않게 잠깐 꺼요'}
          style={bypass ? { background: 'var(--m-amber)', color: '#1c1d1f', borderColor: 'var(--m-amber)' } : undefined}>
          바이패스
        </button>
      </DockHead>
      {!folded && (
        <>
          {helpOpen && <ModuleHelpBody slot={slot} />}
          <div className="ms-modbody">
            <div className={`ms-modgraph ${bypass ? 'opacity-50' : ''}`}><Graph slot={slot} p={p} set={set} engine={engine} /></div>
            <ParamColumns slot={slot} p={p} set={set} recommend={recommend ?? set} />
          </div>
        </>
      )}
    </section>
  )
}


function MiniGr({ engine, pick: pk }: { engine: MasteringEngine; pick: (m: Meters) => number }) {
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
    <div className="flex items-center gap-2 mr-1" title="게인 리덕션 — 지금 소리를 누르고 있는 양(dB)">
      <span className="dim text-[11px]">누름</span>
      <div className="relative w-16 h-2 rounded-md bg-[var(--m-well)] overflow-hidden"><div ref={bar} className="absolute right-0 top-0 bottom-0 bg-[var(--m-amber)]" style={{ width: 0 }} /></div>
      <span ref={txt} className="mono w-8 text-right">0.0</span>
    </div>
  )
}
