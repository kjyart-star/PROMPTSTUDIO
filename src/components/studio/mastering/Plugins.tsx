'use client'

/** 인서트 슬롯별 플러그인 패널 */
import React, { useEffect, useRef } from 'react'
import {
  compCurve, eqResponseDb, saturate, softClip, MATCH_FREQS,
  type ChainParams, type SatMode, type MsBandSet, type DynBandParams, type EqParams, type EqBandParams, type EqShelfParams, type EqPassParams, type MbBandParams, type SlotId,
} from '@/lib/mastering/dsp'
import { DEFAULT_EQ, EQ_TONE_PRESETS } from '@/lib/mastering/presets'
import { Knob, NumField, Fader, Led, Segmented, MONO } from './controls'
import type { MasteringEngine } from './engine'

export type Setter = (fn: (p: ChainParams) => ChainParams) => void

const GRAPH_FS = 48000
const F_MIN = 20, F_MAX = 20000, G_RANGE = 18

// ───────────────────────── EQ ─────────────────────────

type BandKey = 'hpf' | 'lf' | 'lmf' | 'mf' | 'hmf' | 'hf' | 'lpf'
const BANDS: { key: BandKey; label: string; color: string }[] = [
  { key: 'hpf', label: 'HPF', color: '#9ca3af' },
  { key: 'lf', label: 'LF', color: '#ef4444' },
  { key: 'lmf', label: 'LMF', color: '#f59e0b' },
  { key: 'mf', label: 'MF', color: '#84cc16' },
  { key: 'hmf', label: 'HMF', color: '#14ad82' },
  { key: 'hf', label: 'HF', color: '#347dd7' },
  { key: 'lpf', label: 'LPF', color: '#9ca3af' },
]

export function EqGraph({ eq, onChange, bare }: { eq: EqParams; onChange: (fn: (e: EqParams) => EqParams) => void; /** 배경 없이(아래 스펙트럼이 보이게) */ bare?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef<BandKey | null>(null)
  const eqRef = useRef(eq)
  useEffect(() => { eqRef.current = eq }, [eq])

  const geom = (w: number, h: number) => ({
    fx: (f: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w,
    xf: (x: number) => F_MIN * Math.pow(F_MAX / F_MIN, Math.min(1, Math.max(0, x / w))),
    gy: (g: number) => h / 2 - (g / G_RANGE) * (h / 2 - 8),
    yg: (y: number) => ((h / 2 - y) / (h / 2 - 8)) * G_RANGE,
  })

  const handlePos = (k: BandKey, e: EqParams): [number, number] => {
    const b = e[k] as EqBandParams & EqPassParams
    if (k === 'hpf' || k === 'lpf') return [b.freq, 0]
    return [b.freq, b.gain]
  }

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const { fx, gy } = geom(w, h)
    g.font = '9px ui-monospace, monospace'
    g.strokeStyle = '#242424'; g.fillStyle = '#5f5f5f'
    for (const f of [30, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      const x = fx(f)
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke()
      g.textAlign = 'center'; g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 3)
    }
    for (const d of [-12, -6, 0, 6, 12]) {
      const y = gy(d)
      g.strokeStyle = d === 0 ? '#3a3a3a' : '#242424'
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke()
      g.textAlign = 'left'; g.fillText(d > 0 ? `+${d}` : String(d), 3, y - 2)
    }
    // 응답 곡선
    g.beginPath()
    for (let x = 0; x <= w; x += 2) {
      const f = F_MIN * Math.pow(F_MAX / F_MIN, x / w)
      const db = eqResponseDb(eq, f, GRAPH_FS)
      const y = gy(Math.max(-G_RANGE - 6, Math.min(G_RANGE + 6, db)))
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.strokeStyle = 'rgb(20,173,130)'; g.lineWidth = 2; g.stroke()
    g.lineTo(w, gy(0)); g.lineTo(0, gy(0)); g.closePath()
    g.fillStyle = 'rgba(12,153,101,0.12)'; g.fill()
    g.lineWidth = 1
    // 핸들
    for (const b of BANDS) {
      const band = eq[b.key] as { on: boolean }
      const [f, gn] = handlePos(b.key, eq)
      const x = fx(f), y = gy(gn)
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2)
      g.fillStyle = band.on ? b.color : '#2a2a2a'
      g.globalAlpha = band.on ? 0.9 : 0.6
      g.fill(); g.globalAlpha = 1
      g.strokeStyle = '#0d0d0d'; g.stroke()
      g.fillStyle = '#e4e4e4'; g.textAlign = 'center'
      g.fillText(b.label, Math.min(w - 12, Math.max(12, x)), y - 9)
    }
  }, [eq])

  const pick = (e: React.PointerEvent<HTMLCanvasElement>): BandKey | null => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    const { fx, gy } = geom(r.width, r.height)
    let best: BandKey | null = null, bd = 18
    for (const b of BANDS) {
      const [f, gn] = handlePos(b.key, eqRef.current)
      const d = Math.hypot(fx(f) - (e.clientX - r.left), gy(gn) - (e.clientY - r.top))
      if (d < bd) { bd = d; best = b.key }
    }
    return best
  }

  return (
    <canvas
      ref={ref}
      className={bare ? 'absolute inset-0 w-full h-full block cursor-crosshair touch-none' : 'w-full h-[170px] block rounded-md bg-[#0b0b0b] border border-white/5 cursor-crosshair touch-none'}
      onPointerDown={e => {
        const k = pick(e)
        if (!k) return
        drag.current = k
        e.currentTarget.setPointerCapture(e.pointerId)
        onChange(p => ({ ...p, [k]: { ...p[k], on: true } }))
      }}
      onPointerMove={e => {
        const k = drag.current
        if (!k) return
        const r = e.currentTarget.getBoundingClientRect()
        const { xf, yg } = geom(r.width, r.height)
        const f = Math.round(xf(e.clientX - r.left))
        const gn = Math.round(Math.max(-G_RANGE, Math.min(G_RANGE, yg(e.clientY - r.top))) * 10) / 10
        onChange(p => (k === 'hpf' || k === 'lpf'
          ? { ...p, [k]: { ...p[k], freq: f } }
          : { ...p, [k]: { ...p[k], freq: f, gain: gn } }))
      }}
      onPointerUp={() => { drag.current = null }}
      onDoubleClick={e => {
        const k = pick(e as unknown as React.PointerEvent<HTMLCanvasElement>)
        if (k) onChange(p => ({ ...p, [k]: structuredClone(DEFAULT_EQ[k]) }))
      }}
      title="점을 끌어 주파수·게인 조절 · 더블클릭하면 그 밴드 초기화"
    />
  )
}

function EqPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const eq = p.eq
  const upd = (fn: (e: EqParams) => EqParams) => set(c => ({ ...c, eq: fn(c.eq) }))
  const band = <K extends BandKey>(k: K, patch: Partial<EqParams[K]>) => upd(e => ({ ...e, [k]: { ...e[k], ...patch } }))
  return (
    <div className="flex gap-3 min-w-0">
      <Fader label="입력" value={eq.input} min={-18} max={18} def={0} unit="dB" onChange={v => upd(e => ({ ...e, input: v }))} height={190} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <EqGraph eq={eq} onChange={upd} />
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}>
          {BANDS.map(b => {
            const isPass = b.key === 'hpf' || b.key === 'lpf'
            const bp = eq[b.key] as EqBandParams & EqPassParams & EqShelfParams
            const def = DEFAULT_EQ[b.key] as EqBandParams & EqPassParams & EqShelfParams
            return (
              <div key={b.key} className="rounded-md bg-black/30 border border-white/5 p-1.5 flex flex-col items-center gap-1.5 min-w-0">
                <div className="flex items-center gap-1 w-full justify-between">
                  <span className="text-[10px] font-bold" style={{ color: b.color }}>{b.label}</span>
                  <Led on={bp.on} onClick={() => band(b.key, { on: !bp.on } as never)} title={bp.on ? '이 밴드 끄기' : '이 밴드 켜기'} />
                </div>
                <Knob label="주파수" value={bp.freq} min={20} max={20000} def={def.freq} step={1} unit="Hz" scale="log" size={34} color={b.color} disabled={!bp.on}
                  onChange={v => band(b.key, { freq: v } as never)} />
                {isPass ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-zinc-400">기울기</span>
                    <select
                      value={bp.slope}
                      onChange={e => band(b.key, { slope: Number(e.target.value) as EqPassParams['slope'] } as never)}
                      className="h-6 rounded-md bg-black/50 border border-white/10 text-[11px] text-zinc-100 px-1"
                      style={MONO}
                      disabled={!bp.on}
                    >
                      {[12, 24, 36, 48].map(s => <option key={s} value={s}>{s}dB</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <Knob label="게인" value={bp.gain} min={-18} max={18} def={0} unit="dB" size={34} bipolar color={b.color} disabled={!bp.on}
                      onChange={v => band(b.key, { gain: v } as never)} />
                    <Knob label="Q" value={bp.q} min={0.1} max={10} def={def.q} step={0.01} scale="log" size={30} color={b.color} disabled={!bp.on}
                      onChange={v => band(b.key, { q: v } as never)} />
                    {(b.key === 'lf' || b.key === 'hf') && (
                      <Segmented size="xs" value={bp.shape} onChange={v => band(b.key, { shape: v } as never)}
                        options={[{ value: 'shelf', label: '셸프' }, { value: 'bell', label: '벨' }]} />
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented size="xs" value={eq.mode} onChange={v => upd(e => ({ ...e, mode: v }))}
            options={[{ value: 'min', label: '최소 위상' }, { value: 'linear', label: '리니어 페이즈' }]} />
          <span className="text-[10px] text-zinc-500">톤 프리셋</span>
          {EQ_TONE_PRESETS.map(t => (
            <button key={t.id} type="button"
              onClick={() => upd(e => ({ ...e, lf: { ...e.lf, gain: t.gains[0] }, lmf: { ...e.lmf, gain: t.gains[1] }, mf: { ...e.mf, gain: t.gains[2] }, hmf: { ...e.hmf, gain: t.gains[3] }, hf: { ...e.hf, gain: t.gains[4] } }))}
              className="h-6 px-2 rounded-md border border-white/10 bg-black/40 text-[11px] text-zinc-300 hover:text-white hover:border-white/25">
              {t.label}
            </button>
          ))}
          <div className="ml-auto">
            <NumField label="거친 고역 다듬기" value={eq.deharsh} min={0} max={100} def={0} step={1} unit="%" width={110}
              onChange={v => upd(e => ({ ...e, deharsh: v }))} />
          </div>
        </div>
      </div>
      <Fader label="출력" value={eq.output} min={-18} max={18} def={0} unit="dB" onChange={v => upd(e => ({ ...e, output: v }))} height={190} />
    </div>
  )
}

// ───────────────────────── 컴프레서 ─────────────────────────

export function TransferCurve({ threshold, ratio, knee, makeup = 0 }: { threshold: number; ratio: number; knee: number; makeup?: number }) {
  const S = 120, lo = -60
  const map = (db: number) => ((db - lo) / -lo) * S
  let d = ''
  for (let x = lo; x <= 0; x += 1) {
    const y = compCurve(x, threshold, ratio, knee) + makeup
    d += `${x === lo ? 'M' : 'L'} ${map(x).toFixed(1)} ${(S - map(Math.max(lo, Math.min(0, y)))).toFixed(1)} `
  }
  return (
    <svg width={S} height={S} className="rounded-md bg-[#0b0b0b] border border-white/5 shrink-0" aria-label="압축 곡선">
      {[-48, -36, -24, -12].map(v => (
        <g key={v}>
          <line x1={map(v)} y1={0} x2={map(v)} y2={S} stroke="#222" />
          <line x1={0} y1={S - map(v)} x2={S} y2={S - map(v)} stroke="#222" />
        </g>
      ))}
      <line x1={0} y1={S} x2={S} y2={0} stroke="#333" strokeDasharray="3 3" />
      <line x1={map(threshold)} y1={0} x2={map(threshold)} y2={S} stroke="#f59e0b" strokeOpacity={0.4} />
      <path d={d} stroke="rgb(20,173,130)" strokeWidth={2} fill="none" />
    </svg>
  )
}

export function GrBar({ engine, pick, label }: { engine: MasteringEngine; pick: (m: NonNullable<MasteringEngine['meters']>) => number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const txt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const gr = m && !engine.paused ? pick(m) : 0
      if (ref.current) ref.current.style.height = `${Math.min(100, (-gr / 18) * 100)}%`
      if (txt.current) txt.current.textContent = gr < -0.05 ? gr.toFixed(1) : '0.0'
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, pick])
  return (
    <div className="flex flex-col items-center gap-1 w-10 shrink-0">
      <span className="text-[10px] text-zinc-400 whitespace-nowrap">{label}</span>
      <div className="relative w-3 h-[100px] rounded bg-black/60 border border-white/10 overflow-hidden">
        <div ref={ref} className="absolute top-0 left-0 right-0 bg-amber-500" style={{ height: 0 }} />
      </div>
      <span ref={txt} className="text-[10px] text-zinc-200" style={MONO}>0.0</span>
    </div>
  )
}

const pickComp = (m: NonNullable<MasteringEngine['meters']>) => m.compGr
const pickLim = (m: NonNullable<MasteringEngine['meters']>) => m.limGr
const pickMb = [0, 1, 2].map(i => (m: NonNullable<MasteringEngine['meters']>) => m.mbGr[i])

function CompPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const c = p.comp
  const u = (patch: Partial<typeof c>) => set(x => ({ ...x, comp: { ...x.comp, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <TransferCurve threshold={c.threshold} ratio={c.ratio} knee={c.knee} makeup={c.makeup} />
      <div className="flex flex-wrap gap-2">
        <Knob label="스레숄드" value={c.threshold} min={-60} max={0} def={-18} unit="dB" onChange={v => u({ threshold: v })} />
        <Knob label="레이쇼" value={c.ratio} min={1} max={20} def={2} step={0.1} scale="log" format={v => `${v.toFixed(1)}:1`} onChange={v => u({ ratio: v })} />
        <Knob label="어택" value={c.attack} min={0.1} max={200} def={20} step={0.1} unit="ms" scale="log" onChange={v => u({ attack: v })} />
        <Knob label="릴리스" value={c.release} min={10} max={2000} def={200} step={1} unit="ms" scale="log" onChange={v => u({ release: v })} />
        <Knob label="니" value={c.knee} min={0} max={24} def={6} unit="dB" onChange={v => u({ knee: v })} />
        <Knob label="메이크업" value={c.makeup} min={-12} max={24} def={0} unit="dB" bipolar onChange={v => u({ makeup: v })} />
        <Knob label="믹스" value={c.mix} min={0} max={100} def={100} step={1} unit="%" onChange={v => u({ mix: v })} />
        <div className="flex flex-col justify-center"><Led on={c.autoMakeup} onClick={() => u({ autoMakeup: !c.autoMakeup })} label="자동 메이크업" title="줄어든 음량의 절반을 자동으로 되돌려요" /></div>
      </div>
      <GrBar engine={engine} pick={pickComp} label="리덕션" />
    </div>
  )
}

// ───────────────────────── 멀티밴드 ─────────────────────────

function MultibandPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const mb = p.multiband
  const ub = (i: number, patch: Partial<MbBandParams>) => set(x => {
    const bands = x.multiband.bands.map((b, k) => (k === i ? { ...b, ...patch } : b)) as typeof mb.bands
    return { ...x, multiband: { ...x.multiband, bands } }
  })
  const names = ['저역', '중역', '고역']
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <NumField label="저/중 경계" value={mb.lowX} min={40} max={1000} def={120} step={1} unit="Hz" scale="log" width={84}
          onChange={v => set(x => ({ ...x, multiband: { ...x.multiband, lowX: Math.min(v, x.multiband.highX * 0.8) } }))} />
        <NumField label="중/고 경계" value={mb.highX} min={500} max={16000} def={4000} step={1} unit="Hz" scale="log" width={84}
          onChange={v => set(x => ({ ...x, multiband: { ...x.multiband, highX: Math.max(v, x.multiband.lowX * 1.25) } }))} />
        <span className="text-[10px] text-zinc-500 pb-1">경계는 위상 맞춤 크로스오버(24dB/oct)로 나눠, 압축이 없으면 원음과 같아요.</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        {mb.bands.map((b, i) => (
          <div key={i} className="rounded-md bg-black/30 border border-white/5 p-2 flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5 gap-1">
                <span className="text-[11px] font-bold text-zinc-200 whitespace-nowrap">{names[i]}</span>
                <div className="flex gap-1">
                  <Led on={b.on} onClick={() => ub(i, { on: !b.on })} label="켬" />
                  <Led on={b.solo} onClick={() => ub(i, { solo: !b.solo })} label="솔로" tone="solo" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Knob size={34} label="스레숄드" value={b.threshold} min={-60} max={0} def={-20} unit="dB" disabled={!b.on} onChange={v => ub(i, { threshold: v })} />
                <Knob size={34} label="레이쇼" value={b.ratio} min={1} max={10} def={2} step={0.1} scale="log" format={v => `${v.toFixed(1)}:1`} disabled={!b.on} onChange={v => ub(i, { ratio: v })} />
                <Knob size={34} label="어택" value={b.attack} min={0.1} max={200} def={20} step={0.1} unit="ms" scale="log" disabled={!b.on} onChange={v => ub(i, { attack: v })} />
                <Knob size={34} label="릴리스" value={b.release} min={10} max={2000} def={200} step={1} unit="ms" scale="log" disabled={!b.on} onChange={v => ub(i, { release: v })} />
                <Knob size={34} label="게인" value={b.gain} min={-12} max={12} def={0} unit="dB" bipolar disabled={!b.on} onChange={v => ub(i, { gain: v })} />
              </div>
            </div>
            <GrBar engine={engine} pick={pickMb[i]} label="GR" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── 스테레오 ─────────────────────────

function StereoPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const s = p.stereo
  const u = (patch: Partial<typeof s>) => set(x => ({ ...x, stereo: { ...x.stereo, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex gap-2">
        <Knob size={52} label="스테레오 폭" value={s.width} min={0} max={200} def={100} step={1} unit="%" onChange={v => u({ width: v })} />
        <Knob label="미드" value={s.mid} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u({ mid: v })} />
        <Knob label="사이드" value={s.side} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u({ side: v })} />
        <Knob label="저역 모노" value={s.bassMono} min={0} max={300} def={0} step={1} unit="Hz" format={v => (v < 1 ? '끔' : `${Math.round(v)}`)} onChange={v => u({ bassMono: v < 20 ? 0 : v })} />
      </div>
      <p className="text-[11px] text-zinc-500 max-w-[280px] leading-relaxed">
        폭 0% 는 모노, 100% 는 원래 그대로예요. 저역 모노를 켜면 그 주파수 아래는 가운데로 모여 킥·베이스가 단단해져요.
        오른쪽 위상 상관 미터가 0 아래로 내려가면 폭을 줄여 주세요.
      </p>
    </div>
  )
}

// ───────────────────────── 새추레이션 ─────────────────────────

const SAT_MODES: { value: SatMode; label: string }[] = [
  { value: 'tape', label: '테이프' }, { value: 'tapeWarm', label: '테이프(따뜻)' }, { value: 'tube', label: '진공관' },
  { value: 'triode', label: '3극관' }, { value: 'transformer', label: '트랜스포머' }, { value: 'clip', label: '소프트 클립' },
]

export function SatCurve({ drive, mode }: { drive: number; mode: SatMode }) {
  const S = 110
  const g = Math.pow(10, drive / 20)
  let d = ''
  for (let i = 0; i <= 60; i++) {
    const x = -1 + (i / 60) * 2
    const y = saturate(x * g, mode) / Math.max(1, saturate(g, mode))
    d += `${i ? 'L' : 'M'} ${((x + 1) / 2) * S} ${S - ((Math.max(-1, Math.min(1, y)) + 1) / 2) * S} `
  }
  return (
    <svg width={S} height={S} className="rounded-md bg-[#0b0b0b] border border-white/5 shrink-0" aria-label="왜곡 곡선">
      <line x1={0} y1={S} x2={S} y2={0} stroke="#333" strokeDasharray="3 3" />
      <path d={d} stroke="rgb(20,173,130)" strokeWidth={2} fill="none" />
    </svg>
  )
}

function SaturationPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const s = p.saturation
  const u = (patch: Partial<typeof s>) => set(x => ({ ...x, saturation: { ...x.saturation, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <SatCurve drive={s.drive} mode={s.mode} />
      <div className="flex flex-col gap-2">
        <Segmented value={s.mode} onChange={v => u({ mode: v })}
          options={SAT_MODES} />
        <div className="flex gap-2">
          <Knob size={48} label="드라이브" value={s.drive} min={0} max={24} def={3} unit="dB" onChange={v => u({ drive: v })} />
          <Knob label="믹스" value={s.mix} min={0} max={100} def={50} step={1} unit="%" onChange={v => u({ mix: v })} />
          <Knob label="출력" value={s.output} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u({ output: v })} />
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── 리미터 ─────────────────────────

function LimiterPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const l = p.limiter
  const u = (patch: Partial<typeof l>) => set(x => ({ ...x, limiter: { ...x.limiter, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Fader label="게인" value={l.gain} min={-12} max={24} def={0} unit="dB" onChange={v => u({ gain: v })} height={130} />
      <Fader label="천장" value={l.ceiling} min={-6} max={0} def={-1} step={0.1} unit="dB" onChange={v => u({ ceiling: v })} height={130} />
      <div className="flex flex-col gap-3">
        <Knob size={44} label="릴리스" value={l.release} min={1} max={1000} def={80} step={1} unit="ms" scale="log" onChange={v => u({ release: v })} />
        <Led on={l.truePeak} onClick={() => u({ truePeak: !l.truePeak })} label="트루 피크" title="샘플 사이에서 생기는 피크까지 막아요(4배 보간 근사)" />
      </div>
      <GrBar engine={engine} pick={pickLim} label="리덕션" />
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">
        게인으로 밀어 넣고, 천장 위로는 절대 넘지 않게 막아요. 위쪽의 「자동 맞춤」은 이 게인을 타깃 라우드니스에 맞춰 줘요.
      </p>
    </div>
  )
}

export function PluginPanel({ slot, p, set, engine }: { slot: SlotId; p: ChainParams; set: Setter; engine: MasteringEngine }) {
  switch (slot) {
    case 'eq': return <EqPanel p={p} set={set} />
    case 'comp': return <CompPanel p={p} set={set} engine={engine} />
    case 'multiband': return <MultibandPanel p={p} set={set} engine={engine} />
    case 'stereo': return <StereoPanel p={p} set={set} />
    case 'saturation': return <SaturationPanel p={p} set={set} />
    case 'limiter': return <LimiterPanel p={p} set={set} engine={engine} />
    case 'gate': return <GatePanel p={p} set={set} engine={engine} />
    case 'mseq': return <MsEqPanel p={p} set={set} />
    case 'dyneq': return <DynEqPanel p={p} set={set} engine={engine} />
    case 'deesser': return <DeesserPanel p={p} set={set} engine={engine} />
    case 'match': return <MatchPanel p={p} set={set} />
    case 'transient': return <TransientPanel p={p} set={set} engine={engine} />
    case 'imager': return <ImagerPanel p={p} set={set} />
    case 'clipper': return <ClipperPanel p={p} set={set} />
  }
}

const SAT_LABEL: Record<SatMode, string> = { tape: '테이프', tapeWarm: '테이프(따뜻)', tube: '진공관', triode: '3극관', transformer: '트랜스포머', clip: '소프트 클립' }

/** 슬롯 카드 한 줄 요약 */
export function slotSummary(slot: SlotId, p: ChainParams): string {
  switch (slot) {
    case 'eq': {
      const act = (['lf', 'lmf', 'mf', 'hmf', 'hf'] as const).filter(k => p.eq[k].on && Math.abs(p.eq[k].gain) >= 0.1).length
      return `${act}밴드${p.eq.mode === 'linear' ? ' · 리니어' : ''}${p.eq.hpf.on ? ` · HPF ${Math.round(p.eq.hpf.freq)}` : ''}`
    }
    case 'comp': return `${p.comp.threshold.toFixed(0)}dB · ${p.comp.ratio.toFixed(1)}:1`
    case 'multiband': return `${Math.round(p.multiband.lowX)} / ${p.multiband.highX >= 1000 ? (p.multiband.highX / 1000).toFixed(1) + 'k' : Math.round(p.multiband.highX)}Hz`
    case 'stereo': return `폭 ${p.stereo.width}%${p.stereo.bassMono ? ` · 모노 ${Math.round(p.stereo.bassMono)}Hz` : ''}`
    case 'saturation': return `${SAT_LABEL[p.saturation.mode]} · ${p.saturation.drive.toFixed(1)}dB`
    case 'limiter': return `+${p.limiter.gain.toFixed(1)}dB · 천장 ${p.limiter.ceiling.toFixed(1)}`
    case 'gate': return `${p.gate.threshold.toFixed(0)}dB · ${p.gate.ratio.toFixed(1)}:1`
    case 'mseq': return `미드 ${countMs(p.mseq.mid)} · 사이드 ${countMs(p.mseq.side)}`
    case 'dyneq': return `${p.dyneq.bands.filter(b => b.on).length}밴드`
    case 'deesser': return `${(p.deesser.freq / 1000).toFixed(1)}k · ${p.deesser.threshold.toFixed(0)}dB`
    case 'match': return p.match.curve.some(v => Math.abs(v) > 0.01) ? `강도 ${p.match.strength}%` : '곡선 없음'
    case 'transient': return `어택 ${p.transient.attack} · 서스테인 ${p.transient.sustain}`
    case 'imager': return p.imager.widths.map(w => `${w}`).join(' / ') + '%'
    case 'clipper': return `${p.clipper.threshold.toFixed(1)}dB · 부드럽게 ${p.clipper.softness}%`
  }
}

const countMs = (b: MsBandSet) => [b.low.gain, b.b1.gain, b.b2.gain, b.high.gain].filter(g => Math.abs(g) >= 0.1).length

// ───────────────────────── 게이트 / 익스팬더 ─────────────────────────

const pickGate = (m: NonNullable<MasteringEngine['meters']>) => m.gateGr
const pickDeess = (m: NonNullable<MasteringEngine['meters']>) => m.deessGr
const pickTrans = (m: NonNullable<MasteringEngine['meters']>) => -Math.abs(m.transientDb)
const pickDyn = [0, 1, 2, 3].map(i => (m: NonNullable<MasteringEngine['meters']>) => -Math.abs(m.dyneqGr[i] ?? 0))

function GatePanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const g = p.gate
  const u = (patch: Partial<typeof g>) => set(x => ({ ...x, gate: { ...x.gate, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex flex-wrap gap-2">
        <Knob label="스레숄드" value={g.threshold} min={-90} max={-10} def={-60} unit="dB" onChange={v => u({ threshold: v })} />
        <Knob label="레이쇼" value={g.ratio} min={1} max={20} def={2} step={0.1} scale="log" format={v => `1:${v.toFixed(1)}`} onChange={v => u({ ratio: v })} />
        <Knob label="최대 감쇠" value={g.range} min={0} max={80} def={20} unit="dB" onChange={v => u({ range: v })} />
        <Knob label="어택" value={g.attack} min={0.1} max={50} def={1} step={0.1} unit="ms" scale="log" onChange={v => u({ attack: v })} />
        <Knob label="홀드" value={g.hold} min={0} max={500} def={50} step={1} unit="ms" onChange={v => u({ hold: v })} />
        <Knob label="릴리스" value={g.release} min={5} max={2000} def={200} step={1} unit="ms" scale="log" onChange={v => u({ release: v })} />
      </div>
      <GrBar engine={engine} pick={pickGate} label="감쇠" />
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">스레숄드보다 작은 소리를 더 작게 만들어요. 레이쇼 1:2 정도면 부드러운 익스팬더, 크게 하면 게이트처럼 끊겨요.</p>
    </div>
  )
}

// ───────────────────────── M/S EQ ─────────────────────────

function MsEqPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const side = (which: 'mid' | 'side', label: string, color: string) => {
    const b = p.mseq[which]
    const u = (k: keyof MsBandSet, patch: Record<string, number>) => set(x => ({ ...x, mseq: { ...x.mseq, [which]: { ...x.mseq[which], [k]: { ...x.mseq[which][k], ...patch } } } }))
    return (
      <div className="rounded-md bg-black/30 border border-white/5 p-2">
        <div className="text-[11px] font-bold mb-1.5" style={{ color }}>{label}</div>
        <div className="flex flex-wrap gap-1">
          <Knob size={34} color={color} label="저역 셸프" value={b.low.gain} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u('low', { gain: v })} />
          <Knob size={30} color={color} label="주파수" value={b.low.freq} min={30} max={500} def={120} step={1} unit="Hz" scale="log" onChange={v => u('low', { freq: v })} />
          <Knob size={34} color={color} label="벨 1" value={b.b1.gain} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u('b1', { gain: v })} />
          <Knob size={30} color={color} label="주파수" value={b.b1.freq} min={100} max={5000} def={400} step={1} unit="Hz" scale="log" onChange={v => u('b1', { freq: v })} />
          <Knob size={34} color={color} label="벨 2" value={b.b2.gain} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u('b2', { gain: v })} />
          <Knob size={30} color={color} label="주파수" value={b.b2.freq} min={500} max={16000} def={3000} step={1} unit="Hz" scale="log" onChange={v => u('b2', { freq: v })} />
          <Knob size={34} color={color} label="고역 셸프" value={b.high.gain} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u('high', { gain: v })} />
          <Knob size={30} color={color} label="주파수" value={b.high.freq} min={2000} max={18000} def={10000} step={1} unit="Hz" scale="log" onChange={v => u('high', { freq: v })} />
        </div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {side('mid', '미드 (가운데 — 보컬·킥·베이스)', '#14ad82')}
      {side('side', '사이드 (양옆 — 공간·악기 폭)', '#347dd7')}
    </div>
  )
}

// ───────────────────────── 다이내믹 EQ ─────────────────────────

function DynEqPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const ub = (i: number, patch: Partial<DynBandParams>) => set(x => ({ ...x, dyneq: { bands: x.dyneq.bands.map((b, k) => (k === i ? { ...b, ...patch } : b)) } }))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-zinc-500">소리가 스레숄드를 넘을 때만 그 대역을 움직여요 — 가끔 튀는 공진·치찰·저역 뭉침에 좋아요.</p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {p.dyneq.bands.map((b, i) => (
          <div key={i} className="rounded-md bg-black/30 border border-white/5 p-2 flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-bold text-zinc-200">밴드 {i + 1}</span>
                <Led on={b.on} onClick={() => ub(i, { on: !b.on })} label="켬" />
                <Segmented size="xs" value={b.mode} onChange={v => ub(i, { mode: v })} options={[{ value: 'cut', label: '넘으면 깎기' }, { value: 'boost', label: '넘으면 올리기' }]} />
              </div>
              <div className="flex flex-wrap gap-1">
                <Knob size={32} label="주파수" value={b.freq} min={20} max={20000} def={1000} step={1} unit="Hz" scale="log" disabled={!b.on} onChange={v => ub(i, { freq: v })} />
                <Knob size={32} label="Q" value={b.q} min={0.3} max={8} def={1.2} step={0.01} scale="log" disabled={!b.on} onChange={v => ub(i, { q: v })} />
                <Knob size={32} label="스레숄드" value={b.threshold} min={-60} max={0} def={-24} unit="dB" disabled={!b.on} onChange={v => ub(i, { threshold: v })} />
                <Knob size={32} label="레이쇼" value={b.ratio} min={1} max={10} def={3} step={0.1} scale="log" format={v => `${v.toFixed(1)}:1`} disabled={!b.on} onChange={v => ub(i, { ratio: v })} />
                <Knob size={32} label="최대" value={b.range} min={0} max={12} def={4} unit="dB" disabled={!b.on} onChange={v => ub(i, { range: v })} />
                <Knob size={32} label="고정 게인" value={b.gain} min={-12} max={12} def={0} unit="dB" bipolar disabled={!b.on} onChange={v => ub(i, { gain: v })} />
                <Knob size={32} label="어택" value={b.attack} min={0.1} max={100} def={10} step={0.1} unit="ms" scale="log" disabled={!b.on} onChange={v => ub(i, { attack: v })} />
                <Knob size={32} label="릴리스" value={b.release} min={10} max={1000} def={120} step={1} unit="ms" scale="log" disabled={!b.on} onChange={v => ub(i, { release: v })} />
              </div>
            </div>
            <GrBar engine={engine} pick={pickDyn[i]} label="변화" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── 디에서 ─────────────────────────

function DeesserPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const d = p.deesser
  const u = (patch: Partial<typeof d>) => set(x => ({ ...x, deesser: { ...x.deesser, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex flex-wrap gap-2">
        <Knob size={46} label="주파수" value={d.freq} min={2000} max={14000} def={6500} step={1} unit="Hz" scale="log" onChange={v => u({ freq: v })} />
        <Knob label="스레숄드" value={d.threshold} min={-60} max={0} def={-28} unit="dB" onChange={v => u({ threshold: v })} />
        <Knob label="최대 감쇠" value={d.range} min={0} max={18} def={6} unit="dB" onChange={v => u({ range: v })} />
        <div className="flex flex-col justify-center"><Led on={d.listen} onClick={() => u({ listen: !d.listen })} label="감지 소리 듣기" tone="warn" title="디에서가 감지하는 대역만 들려줘요 — 주파수를 맞출 때" /></div>
      </div>
      <GrBar engine={engine} pick={pickDeess} label="감쇠" />
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">「ㅅ·ㅊ」 같은 치찰음이 튈 때만 그 위 고역을 내려요. 감지 소리 듣기를 켜고 주파수를 치찰음이 가장 크게 들리는 곳에 맞추세요.</p>
    </div>
  )
}

// ───────────────────────── 매칭 EQ ─────────────────────────

function MatchPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const m = p.match
  const W = 520, H = 120
  const x = (i: number) => (i / (MATCH_FREQS.length - 1)) * W
  const y = (db: number) => H / 2 - (db / 12) * (H / 2 - 6)
  const pts = m.curve.map((v, i) => `${x(i)},${y((v * m.strength) / 100)}`).join(' ')
  const has = m.curve.some(v => Math.abs(v) > 0.01)
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[120px] rounded-md bg-[#0b0b0b] border border-white/5" preserveAspectRatio="none" aria-label="매칭 곡선">
        {[-6, 0, 6].map(d => <line key={d} x1={0} x2={W} y1={y(d)} y2={y(d)} stroke={d === 0 ? '#3a3a3a' : '#222'} />)}
        {has && <polyline points={pts} fill="none" stroke="rgb(20,173,130)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="flex flex-wrap items-center gap-3">
        <Knob label="강도" value={m.strength} min={0} max={100} def={70} step={1} unit="%" onChange={v => set(c => ({ ...c, match: { ...c.match, strength: v } }))} />
        <button type="button" onClick={() => set(c => ({ ...c, match: { ...c.match, curve: c.match.curve.map(() => 0) } }))} disabled={!has}
          className="h-7 px-2.5 rounded-md border border-white/10 bg-black/40 text-[11px] text-zinc-300 hover:text-white disabled:opacity-40">곡선 지우기</button>
        <p className="text-[11px] text-zinc-500 max-w-[360px]">{has ? '레퍼런스 곡과의 스펙트럼 차이로 만든 곡선이에요. 리니어 페이즈라 위상이 바뀌지 않아요(지연 약 45ms).' : '곡선이 없어요. 아래 「레퍼런스」 탭에서 레퍼런스 곡을 불러와 「레퍼런스 톤 맞추기」를 누르세요.'}</p>
      </div>
    </div>
  )
}

// ───────────────────────── 트랜지언트 ─────────────────────────

function TransientPanel({ p, set, engine }: { p: ChainParams; set: Setter; engine: MasteringEngine }) {
  const t = p.transient
  const u = (patch: Partial<typeof t>) => set(x => ({ ...x, transient: { ...x.transient, ...patch } }))
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Knob size={52} label="어택" value={t.attack} min={-100} max={100} def={0} step={1} unit="%" bipolar onChange={v => u({ attack: v })} />
      <Knob size={52} label="서스테인" value={t.sustain} min={-100} max={100} def={0} step={1} unit="%" bipolar onChange={v => u({ sustain: v })} />
      <Knob label="출력" value={t.output} min={-12} max={12} def={0} unit="dB" bipolar onChange={v => u({ output: v })} />
      <GrBar engine={engine} pick={pickTrans} label="변화" />
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">어택을 올리면 킥·스네어가 앞으로 튀어나오고, 서스테인을 내리면 잔향·꼬리가 짧아져 단단해져요.</p>
    </div>
  )
}

// ───────────────────────── 대역별 폭 ─────────────────────────

function ImagerPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const im = p.imager
  const names = ['저역', '중역', '고역']
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-end">
        <NumField label="저/중 경계" value={im.lowX} min={40} max={1000} def={150} step={1} unit="Hz" scale="log" width={84}
          onChange={v => set(x => ({ ...x, imager: { ...x.imager, lowX: Math.min(v, x.imager.highX * 0.8) } }))} />
        <NumField label="중/고 경계" value={im.highX} min={500} max={16000} def={4000} step={1} unit="Hz" scale="log" width={84}
          onChange={v => set(x => ({ ...x, imager: { ...x.imager, highX: Math.max(v, x.imager.lowX * 1.25) } }))} />
      </div>
      <div className="flex flex-wrap gap-4">
        {names.map((n, i) => (
          <Fader key={n} label={n} value={im.widths[i]} min={0} max={200} def={100} step={1} unit="%" height={110}
            onChange={v => set(x => ({ ...x, imager: { ...x.imager, widths: x.imager.widths.map((w, k) => (k === i ? v : w)) } }))} />
        ))}
        <p className="text-[11px] text-zinc-500 max-w-[280px] leading-relaxed self-center">대역마다 넓이를 따로 정해요. 저역은 좁게(모노 쪽), 고역은 넓게 두면 단단하면서 시원한 이미지가 돼요.</p>
      </div>
    </div>
  )
}

// ───────────────────────── 소프트 클리퍼 ─────────────────────────

function ClipperPanel({ p, set }: { p: ChainParams; set: Setter }) {
  const c = p.clipper
  const u = (patch: Partial<typeof c>) => set(x => ({ ...x, clipper: { ...x.clipper, ...patch } }))
  const S = 110
  let d = ''
  for (let i = 0; i <= 60; i++) {
    const xv = -1.5 + (i / 60) * 3
    const yv = softClip(xv, Math.pow(10, c.threshold / 20), c.softness / 100)
    d += `${i ? 'L' : 'M'} ${((xv + 1.5) / 3) * S} ${S - ((yv + 1.5) / 3) * S} `
  }
  return (
    <div className="flex flex-wrap items-start gap-4">
      <svg width={S} height={S} className="rounded-md bg-[#0b0b0b] border border-white/5 shrink-0" aria-label="클리핑 곡선">
        <line x1={0} y1={S} x2={S} y2={0} stroke="#333" strokeDasharray="3 3" />
        <path d={d} stroke="rgb(20,173,130)" strokeWidth={2} fill="none" />
      </svg>
      <Knob size={48} label="스레숄드" value={c.threshold} min={-12} max={0} def={-0.5} unit="dB" onChange={v => u({ threshold: v })} />
      <Knob label="부드럽게" value={c.softness} min={0} max={100} def={40} step={1} unit="%" onChange={v => u({ softness: v })} />
      <Knob label="출력" value={c.output} min={-6} max={6} def={0} unit="dB" bipolar onChange={v => u({ output: v })} />
      <p className="text-[11px] text-zinc-500 max-w-[260px] leading-relaxed">리미터 앞에서 짧은 피크를 먼저 둥글게 잘라, 리미터가 덜 일하게 해요. 펌핑 없이 소리가 커져요.</p>
    </div>
  )
}
