'use client'

/** 인서트 슬롯별 플러그인 패널 */
import React, { useEffect, useRef } from 'react'
import {
  compCurve, eqResponseDb, saturate,
  type ChainParams, type EqParams, type EqBandParams, type EqShelfParams, type EqPassParams, type MbBandParams, type SlotId,
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

function EqGraph({ eq, onChange }: { eq: EqParams; onChange: (fn: (e: EqParams) => EqParams) => void }) {
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
      className="w-full h-[170px] block rounded-md bg-[#0b0b0b] border border-white/5 cursor-crosshair touch-none"
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

function TransferCurve({ threshold, ratio, knee, makeup = 0 }: { threshold: number; ratio: number; knee: number; makeup?: number }) {
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

function GrBar({ engine, pick, label }: { engine: MasteringEngine; pick: (m: NonNullable<MasteringEngine['meters']>) => number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const txt = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const gr = m && !engine.audio.paused ? pick(m) : 0
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

function SatCurve({ drive, mode }: { drive: number; mode: 'tape' | 'tube' | 'clip' }) {
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
          options={[{ value: 'tape', label: '테이프' }, { value: 'tube', label: '진공관' }, { value: 'clip', label: '소프트 클립' }]} />
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
  }
}

/** 슬롯 카드 한 줄 요약 */
export function slotSummary(slot: SlotId, p: ChainParams): string {
  switch (slot) {
    case 'eq': {
      const act = (['lf', 'lmf', 'mf', 'hmf', 'hf'] as const).filter(k => p.eq[k].on && Math.abs(p.eq[k].gain) >= 0.1).length
      return `${act}밴드 조정${p.eq.hpf.on ? ` · HPF ${Math.round(p.eq.hpf.freq)}Hz` : ''}`
    }
    case 'comp': return `${p.comp.threshold.toFixed(0)}dB · ${p.comp.ratio.toFixed(1)}:1`
    case 'multiband': return `${Math.round(p.multiband.lowX)} / ${p.multiband.highX >= 1000 ? (p.multiband.highX / 1000).toFixed(1) + 'k' : Math.round(p.multiband.highX)}Hz`
    case 'stereo': return `폭 ${p.stereo.width}%${p.stereo.bassMono ? ` · 저역 모노 ${Math.round(p.stereo.bassMono)}Hz` : ''}`
    case 'saturation': return `${{ tape: '테이프', tube: '진공관', clip: '소프트 클립' }[p.saturation.mode]} · ${p.saturation.drive.toFixed(1)}dB`
    case 'limiter': return `+${p.limiter.gain.toFixed(1)}dB · 천장 ${p.limiter.ceiling.toFixed(1)}`
  }
}
