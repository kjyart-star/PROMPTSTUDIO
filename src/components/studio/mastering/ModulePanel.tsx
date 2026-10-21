'use client'

/**
 * 모듈 패널(타임라인 바로 아래 가로 전체 폭 도킹) — 머리줄 32px(이름 · 기본값 · 템플릿 값 · 바이패스 · 접기 · 닫기)
 * · 「이 모듈은?」 · 왼쪽 그래프(모듈 성격에 맞는 시각화) + 오른쪽 큰 노브 격자(파라미터당 컨트롤 하나).
 * 패널 높이는 내용에 맞춘다 — 빈 띠 없음. 한 번에 하나만 열린다. 떠 있는 창은 없다.
 */
import React, { useEffect, useRef, useState } from 'react'
import { RotateCcw, Wand2, X, ChevronDown, CircleHelp } from 'lucide-react'
import { MATCH_FREQS, msSections, coefsMagDb, softClip, type ChainParams, type SlotId, type MsBandSet } from '@/lib/mastering/dsp'
import { defaultChain } from '@/lib/mastering/presets'
import { Knob } from './controls'
import { EqGraph, TransferCurve, SatCurve } from './Plugins'
import { SCHEMA, getPath, setPath, resetSlot, paramColumns, type ParamRow } from './paramSchema'
import { moduleHelp, dangerFix } from './moduleHelp'
import { MODULE_LABEL, GR_PICK, kindColor } from './labels'
import { useUi } from './actions'
import type { MasteringEngine } from './engine'

type Meters = NonNullable<MasteringEngine['meters']>
type Set = (fn: (p: ChainParams) => ChainParams) => void

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

/** EQ 곡선 + 실시간 스펙트럼(처리 전 회색 · 처리 후 녹색). height 를 주지 않으면 부모 높이를 채운다 */
export function EqWithSpectrum({ p, set, engine, height }: { p: ChainParams; set: Set; engine: MasteringEngine; height?: number }) {
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
    <div className="relative rounded-lg overflow-hidden border border-[var(--m-line-soft)]" style={{ height: height ?? '100%', minHeight: height ? undefined : 150 }}>
      <canvas ref={cv} className="absolute inset-0 w-full h-full block" aria-hidden />
      <EqGraph bare eq={p.eq} onChange={fn => set(c => ({ ...c, eq: fn(c.eq) }))} />
    </div>
  )
}

/** 최근 10초 게인 리덕션 그래프(부모 높이를 채움) — 리미터는 들어옴/나감 레벨과 천장도 함께 */
function GrGraph({ engine, pick: pk, ceiling }: { engine: MasteringEngine; pick: (m: Meters) => number; ceiling?: number }) {
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
    <div className="ms-graphfill">
      <canvas ref={cv} className="block w-full flex-1 min-h-0 rounded-lg border border-[var(--m-line-soft)]" aria-label="최근 10초 게인 리덕션" />
      {ceiling !== undefined && (
        <div className="flex gap-4 text-[11px] pt-1.5 flex-none">
          <span className="dim" title="리미터로 들어오는 소리의 최고 높이">들어옴 <span ref={inTxt} className="mono text-[var(--m-text)]">-∞</span> dB</span>
          <span className="dim" title="리미터를 지난 소리의 최고 높이 — 천장을 넘으면 빨강">나감 <span ref={outTxt} className="mono">-∞</span> dB</span>
          <span className="dim">천장 <span className="mono text-[var(--m-text)]">{ceiling.toFixed(1)}</span> dB</span>
        </div>
      )}
    </div>
  )
}

const GRAPH_W = 320, GRAPH_H = 150

/** 타격감 — 드럼 한 타의 엔벨로프: 회색 = 처리 전, 녹색 = 어택·서스테인을 적용한 뒤 */
function TransientShape({ attack, sustain }: { attack: number; sustain: number }) {
  const W = GRAPH_W, H = GRAPH_H, pad = 6
  const N = 120
  const pre: string[] = [], post: string[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 5)
    // 어택 구간(앞 ~80ms)과 꼬리 구간의 가중치
    const aW = t < 0.05 ? 1 : Math.exp(-(t - 0.05) * 28)
    const sW = t < 0.05 ? 0 : 1 - aW
    const g = (attack / 100) * 9 * aW + (sustain / 100) * 7 * sW
    const lin = Math.pow(10, Math.max(-15, Math.min(12, g)) / 20)
    const y = (v: number) => H - pad - Math.min(1.9, v) * ((H - pad * 2) / 1.9)
    const x = pad + t * (W - pad * 2)
    pre.push(`${x.toFixed(1)},${y(env).toFixed(1)}`)
    post.push(`${x.toFixed(1)},${y(env * lin).toFixed(1)}`)
  }
  const base = `${pad},${H - pad}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ms-graphsvg" preserveAspectRatio="none" aria-label="타격 엔벨로프 — 처리 전후">
      <line x1={pad} x2={W - pad} y1={H - pad - (H - pad * 2) / 1.9} y2={H - pad - (H - pad * 2) / 1.9} stroke="#34373b" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <polygon points={`${base} ${pre.join(' ')} ${W - pad},${H - pad}`} fill="rgba(170,175,182,0.18)" />
      <polyline points={pre.join(' ')} fill="none" stroke="#9ea3aa" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <polyline points={post.join(' ')} fill="none" stroke="#52d27e" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** 부드러운 깎기 — 들어오는 레벨 → 나가는 레벨(점선 = 그대로, 녹색 = 깎은 뒤, 주황 = 스레숄드) */
function ClipShape({ threshold, softness }: { threshold: number; softness: number }) {
  const W = GRAPH_W, H = GRAPH_H, pad = 6
  const t = Math.pow(10, threshold / 20)
  const R = 1.5
  const X = (v: number) => pad + ((v + R) / (2 * R)) * (W - pad * 2)
  const Y = (v: number) => H - pad - ((v + R) / (2 * R)) * (H - pad * 2)
  let d = ''
  for (let i = 0; i <= 80; i++) {
    const x = -R + (i / 80) * 2 * R
    d += `${i ? 'L' : 'M'} ${X(x).toFixed(1)} ${Y(softClip(x, t, softness / 100)).toFixed(1)} `
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ms-graphsvg" preserveAspectRatio="none" aria-label="깎기 곡선">
      <line x1={X(-R)} y1={Y(-R)} x2={X(R)} y2={Y(R)} stroke="#42454a" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <line x1={pad} x2={W - pad} y1={Y(t)} y2={Y(t)} stroke="#f0a43a" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      <line x1={pad} x2={W - pad} y1={Y(-t)} y2={Y(-t)} stroke="#f0a43a" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="#52d27e" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** 스테레오 폭 — 반원 위에 대역마다 퍼지는 각도(100% = 원래, 바깥 호일수록 높은 대역) */
function StereoField({ bands, bassMono }: { bands: { label: string; width: number }[]; bassMono?: number }) {
  const W = GRAPH_W, H = GRAPH_H
  const cx = W / 2, cy = H - 18
  const rMax = Math.min(cx - 36, cy - 14)
  const arc = (r: number, span: number) => {
    const a = Math.min(90, (Math.max(0, Math.min(200, span)) / 100) * 45)
    const p = (deg: number) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)]
    const [x0, y0] = p(-a), [x1, y1] = p(a)
    return a < 0.5 ? '' : `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  const colors = ['#b07be8', '#52d27e', '#4f8fe8']
  const n = bands.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ms-graphsvg" aria-label="스테레오 폭">
      {[0.5, 1].map(k => <path key={k} d={`M ${cx - rMax * k} ${cy} A ${rMax * k} ${rMax * k} 0 0 1 ${cx + rMax * k} ${cy}`} fill="none" stroke="#34373b" />)}
      <line x1={cx} y1={cy} x2={cx} y2={cy - rMax} stroke="#34373b" strokeDasharray="2 3" />
      <line x1={cx} y1={cy} x2={cx - rMax * Math.SQRT1_2} y2={cy - rMax * Math.SQRT1_2} stroke="#42454a" strokeDasharray="2 3" />
      <line x1={cx} y1={cy} x2={cx + rMax * Math.SQRT1_2} y2={cy - rMax * Math.SQRT1_2} stroke="#42454a" strokeDasharray="2 3" />
      {bands.map((b, i) => {
        const r = rMax * (n === 1 ? 0.78 : 0.45 + (i / (n - 1)) * 0.5)
        return <path key={b.label} d={arc(r, b.width)} fill="none" stroke={colors[n === 1 ? 1 : i]} strokeWidth={n === 1 ? 10 : 7} strokeLinecap="round" />
      })}
      <text x={10} y={cy + 4} fill="#9ea3aa" fontSize={11}>L</text>
      <text x={W - 18} y={cy + 4} fill="#9ea3aa" fontSize={11}>R</text>
      <text x={cx} y={cy - rMax - 4} fill="#868b93" fontSize={10} textAnchor="middle">가운데</text>
      {bands.map((b, i) => (
        <text key={b.label} x={10 + i * 70} y={H - 4} fill={colors[n === 1 ? 1 : i]} fontSize={11}>{b.label} {Math.round(b.width)}%</text>
      ))}
      {bassMono !== undefined && bassMono >= 20 && <text x={W - 8} y={H - 4} fill="#9ea3aa" fontSize={11} textAnchor="end">{Math.round(bassMono)} Hz 아래 모노</text>}
    </svg>
  )
}

/** 미드/사이드 EQ 곡선 — 녹색 = 가운데(미드), 파랑 = 양옆(사이드), ±12 dB */
function MsEqCurve({ mid, side }: { mid: MsBandSet; side: MsBandSet }) {
  const W = GRAPH_W, H = GRAPH_H, fs = 48000, N = 96
  const line = (b: MsBandSet) => {
    const secs = msSections(b, fs)
    const pts: string[] = []
    for (let i = 0; i <= N; i++) {
      const f = 20 * Math.pow(1000, i / N)
      let db = 0
      for (const c of secs) db += coefsMagDb(c, f, fs)
      pts.push(`${((i / N) * W).toFixed(1)},${(H / 2 - (Math.max(-12, Math.min(12, db)) / 12) * (H / 2 - 8)).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const fx = (f: number) => (Math.log(f / 20) / Math.log(1000)) * W
  // 글자는 HTML 로(늘어나는 SVG 안에 두면 글자도 늘어난다)
  return (
    <div className="relative h-full min-h-[120px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="ms-graphsvg absolute inset-0" preserveAspectRatio="none" aria-label="미드·사이드 EQ 곡선">
        {[100, 1000, 10000].map(f => <line key={f} x1={fx(f)} x2={fx(f)} y1={0} y2={H} stroke="#26282b" vectorEffect="non-scaling-stroke" />)}
        {[-6, 6].map(d => <line key={d} x1={0} x2={W} y1={H / 2 - (d / 12) * (H / 2 - 8)} y2={H / 2 - (d / 12) * (H / 2 - 8)} stroke="#26282b" vectorEffect="non-scaling-stroke" />)}
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#42454a" vectorEffect="non-scaling-stroke" />
        <polyline points={line(side)} fill="none" stroke="#4f8fe8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <polyline points={line(mid)} fill="none" stroke="#52d27e" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute left-2 top-1 text-[11px] flex gap-3 pointer-events-none"><span style={{ color: '#52d27e' }}>미드</span><span style={{ color: '#4f8fe8' }}>사이드</span></div>
      <div className="absolute right-2 bottom-1 text-[10px] faint pointer-events-none">20 Hz – 20 kHz · ±12 dB</div>
    </div>
  )
}

function Graph({ slot, p, set, engine }: { slot: SlotId; p: ChainParams; set: Set; engine: MasteringEngine }) {
  const gr = GR_PICK[slot]
  if (slot === 'eq') return <EqWithSpectrum p={p} set={set} engine={engine} />
  if (slot === 'limiter') return <GrGraph engine={engine} pick={GR_PICK.limiter!} ceiling={p.limiter.ceiling} />
  if (slot === 'comp') {
    return (
      <div className="flex items-stretch gap-3 h-full min-h-0">
        <div className="flex flex-col gap-1.5 flex-none"><TransferCurve threshold={p.comp.threshold} ratio={p.comp.ratio} knee={p.comp.knee} makeup={p.comp.makeup} /><p className="text-[11px] dim leading-relaxed max-w-[120px]">대각선보다 아래로 꺾인 만큼 큰 소리를 눌러요.</p></div>
        <GrGraph engine={engine} pick={gr!} />
      </div>
    )
  }
  if (slot === 'multiband') {
    return (
      <div className="flex flex-col gap-2 h-full min-h-0">
        <div className="flex flex-wrap gap-3 flex-none">
          {['저역', '중역', '고역'].map((nm, i) => (
            <div key={nm} className="flex flex-col items-center gap-1">
              <TransferCurve threshold={p.multiband.bands[i].threshold} ratio={p.multiband.bands[i].ratio} knee={6} makeup={p.multiband.bands[i].gain} />
              <span className="text-[11px] dim">{nm}</span>
            </div>
          ))}
        </div>
        <GrGraph engine={engine} pick={gr!} />
      </div>
    )
  }
  if (slot === 'saturation') return <div className="flex items-center gap-3"><SatCurve drive={p.saturation.drive} mode={p.saturation.mode} /><p className="text-[11px] dim leading-relaxed">곡선이 위아래로 둥글게 휠수록 색이 진해져요.</p></div>
  if (slot === 'stereo') return <StereoField bands={[{ label: '전체', width: p.stereo.width }]} bassMono={p.stereo.bassMono} />
  if (slot === 'imager') return <StereoField bands={[{ label: '저역', width: p.imager.widths[0] }, { label: '중역', width: p.imager.widths[1] }, { label: '고역', width: p.imager.widths[2] }]} />
  if (slot === 'transient') return <TransientShape attack={p.transient.attack} sustain={p.transient.sustain} />
  if (slot === 'clipper') return <ClipShape threshold={p.clipper.threshold} softness={p.clipper.softness} />
  if (slot === 'mseq') return <MsEqCurve mid={p.mseq.mid} side={p.mseq.side} />
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
  return <GrGraph engine={engine} pick={gr!} />
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

/** 노브 크기 — 파라미터가 적은 모듈은 크게(60), 많은 모듈(EQ·다이내믹 EQ·M/S EQ·멀티밴드)은 44 */
export function knobSize(slot: SlotId) {
  const n = SCHEMA[slot].filter(r => r.kind === 'num').length
  return n > 10 ? 44 : n > 6 ? 52 : 60
}

function ParamCell({ row, col, p, set, recommend, size }: { row: ParamRow; col: string; p: ChainParams; set: Set; recommend: Set; size: number }) {
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
        format={row.fmt} onChange={upd} size={size} color={d ? 'var(--m-amber)' : 'var(--m-green)'} bipolar={row.min < 0 && row.max > 0} />
      {d && (
        <button type="button" className="ms-rec" title={`${d.why} — ${row.label}을(를) ${d.fix}${row.unit ? ` ${row.unit}` : ''}(으)로`}
          onClick={() => recommend(c => setPath(c, row.path, d.fix))}>추천값</button>
      )}
    </div>
  )
}

/** 파라미터 열 — 밴드·섹션마다 한 열(켬·모양 같은 스위치 위, 노브 아래). 파라미터당 컨트롤은 노브 하나 */
function ParamColumns({ slot, p, set, recommend }: { slot: SlotId; p: ChainParams; set: Set; recommend: Set }) {
  const cols = paramColumns(slot)
  const size = knobSize(slot)
  return (
    <div className={`ms-pcols ${slot === 'eq' ? 'eq' : cols.length > 1 ? 'sec' : 'flat'}`} role="group" aria-label="파라미터">
      {cols.map(c => (
        <div key={c.label || 'all'} className="ms-pcol">
          {c.label && <div className="ms-pcolhead">{c.label}</div>}
          {c.rows.some(r => r.kind !== 'num') && (
            <div className="sw">{c.rows.filter(r => r.kind !== 'num').map(r => <ParamCell key={r.path} row={r} col={c.label} p={p} set={set} recommend={recommend} size={size} />)}</div>
          )}
          <div className="kn">{c.rows.filter(r => r.kind === 'num').map(r => <ParamCell key={r.path} row={r} col={c.label} p={p} set={set} recommend={recommend} size={size} />)}</div>
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
          <div className={`ms-modbody ${slot === 'eq' ? 'eq' : ''}`}>
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
