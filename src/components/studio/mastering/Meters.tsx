'use client'

/**
 * 오른쪽 미터 열 — 입력/출력 피크·RMS, LUFS(모멘터리·단기·통합), 트루 피크,
 * 게인 리덕션, 스펙트럼, 상관(위상) 미터. 화면 갱신은 rAF 로 캔버스에 직접 그린다.
 */
import React, { useEffect, useRef } from 'react'
import type { MasteringEngine } from './engine'
import { MONO } from './controls'

const DB_MIN = -60

const lin2db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -200)
const fmt = (v: number, d = 1) => (Number.isFinite(v) && v > -150 ? v.toFixed(d) : '-∞')

function levelColor(db: number) {
  if (db > -1) return '#ef4444'
  if (db > -6) return '#f59e0b'
  return 'rgb(12,153,101)'
}

function setupCanvas(c: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1
  const w = c.clientWidth, h = c.clientHeight
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
  }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { g, w, h }
}

/** 세그먼트 막대 (세로) */
function drawSegBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, db: number, rmsDb: number, holdDb: number) {
  const segs = 40
  const sh = h / segs
  for (let i = 0; i < segs; i++) {
    const segDb = DB_MIN + ((i + 1) / segs) * -DB_MIN
    const yy = y + h - (i + 1) * sh
    const lit = db >= segDb - (-DB_MIN / segs)
    g.fillStyle = lit ? levelColor(segDb) : '#1f1f1f'
    g.globalAlpha = lit ? (rmsDb >= segDb ? 1 : 0.55) : 1
    g.fillRect(x, yy + 0.5, w, sh - 1)
  }
  g.globalAlpha = 1
  if (holdDb > DB_MIN) {
    const t = (holdDb - DB_MIN) / -DB_MIN
    g.fillStyle = levelColor(holdDb)
    g.fillRect(x, y + h - t * h, w, 2)
  }
}

export function MeterColumn({ engine, targetLufs, ceiling, playing }: { engine: MasteringEngine; targetLufs: number; ceiling: number; playing: boolean }) {
  const lvRef = useRef<HTMLCanvasElement>(null)
  const ldRef = useRef<HTMLCanvasElement>(null)
  const spRef = useRef<HTMLCanvasElement>(null)
  const crRef = useRef<HTMLCanvasElement>(null)
  const grRef = useRef<HTMLCanvasElement>(null)
  const goRef = useRef<HTMLCanvasElement>(null)
  const txt = useRef<Record<string, HTMLSpanElement | null>>({})
  const propsRef = useRef({ targetLufs, ceiling, playing })
  useEffect(() => { propsRef.current = { targetLufs, ceiling, playing } }, [targetLufs, ceiling, playing])

  useEffect(() => {
    let raf = 0
    const hold = { v: [-200, -200, -200, -200], t: [0, 0, 0, 0] }
    const disp = [-200, -200, -200, -200]
    let lastTxt = 0
    let freqPost: Float32Array<ArrayBuffer> | null = null
    let freqPre: Float32Array<ArrayBuffer> | null = null
    let tdL: Float32Array<ArrayBuffer> | null = null
    let tdR: Float32Array<ArrayBuffer> | null = null
    const setT = (k: string, v: string, color?: string) => {
      const el = txt.current[k]
      if (!el) return
      if (el.textContent !== v) el.textContent = v
      if (color) el.style.color = color
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const { targetLufs: tgt, ceiling: ceil, playing: on } = propsRef.current

      // 레벨 미터
      if (lvRef.current) {
        const { g, w, h } = setupCanvas(lvRef.current)
        g.clearRect(0, 0, w, h)
        const vals = m ? [m.inLevel.peakL, m.inLevel.peakR, m.outLevel.peakL, m.outLevel.peakR].map(lin2db) : [-200, -200, -200, -200]
        const rms = m ? [m.inLevel.rmsL, m.inLevel.rmsR, m.outLevel.rmsL, m.outLevel.rmsR].map(lin2db) : [-200, -200, -200, -200]
        const top = 4, bh = h - 18
        const bw = 9, gap = 3
        const groupW = bw * 2 + gap
        const xs = [6, 6 + bw + gap, w - 6 - groupW, w - 6 - bw]
        for (let i = 0; i < 4; i++) {
          const v = on ? vals[i] : -200
          disp[i] = v > disp[i] ? v : disp[i] - 1.2
          if (v >= hold.v[i]) { hold.v[i] = v; hold.t[i] = now } else if (now - hold.t[i] > 1500) hold.v[i] -= 0.6
          drawSegBar(g, xs[i], top, bw, bh, disp[i], on ? rms[i] : -200, hold.v[i])
        }
        // 눈금
        g.fillStyle = '#6b6b6b'
        g.font = '9px ui-monospace, monospace'
        g.textAlign = 'center'
        for (const d of [0, -6, -12, -24, -40, -60]) {
          const y = top + bh - ((d - DB_MIN) / -DB_MIN) * bh
          g.fillText(String(d), w / 2, y + 3)
        }
        g.fillText('입력', xs[0] + groupW / 2, h - 2)
        g.fillText('출력', xs[2] + groupW / 2, h - 2)
      }

      // 라우드니스 막대 (M / S) + 타깃선
      if (ldRef.current) {
        const { g, w, h } = setupCanvas(ldRef.current)
        g.clearRect(0, 0, w, h)
        const lo = -40, hi = 0
        const y = (v: number) => h - 14 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - 18)
        const bars: [number, string][] = [[m?.momentary ?? -Infinity, 'M'], [m?.shortTerm ?? -Infinity, 'S'], [m?.integrated ?? -Infinity, 'I']]
        const bw = (w - 30) / 3
        bars.forEach(([v, label], i) => {
          const x = 4 + i * (bw + 6)
          g.fillStyle = '#1f1f1f'
          g.fillRect(x, 4, bw, h - 18)
          if (Number.isFinite(v)) {
            const over = v > tgt + 1
            g.fillStyle = over ? '#f59e0b' : i === 2 ? '#347dd7' : 'rgb(12,153,101)'
            g.fillRect(x, y(v), bw, h - 14 - y(v))
          }
          g.fillStyle = '#8a8a8a'
          g.font = '9px ui-monospace, monospace'
          g.textAlign = 'center'
          g.fillText(label, x + bw / 2, h - 3)
        })
        g.strokeStyle = '#e4e4e4'
        g.setLineDash([3, 3])
        g.beginPath(); g.moveTo(2, y(tgt)); g.lineTo(w - 22, y(tgt)); g.stroke()
        g.setLineDash([])
        g.fillStyle = '#9a9a9a'; g.textAlign = 'left'
        for (const d of [0, -10, -20, -30, -40]) g.fillText(String(d), w - 20, y(d) + 3)
      }

      // 게인 리덕션
      if (grRef.current) {
        const { g, w, h } = setupCanvas(grRef.current)
        g.clearRect(0, 0, w, h)
        const rows: [string, number][] = [
          ['컴프', m?.compGr ?? 0], ['저역', m?.mbGr[0] ?? 0], ['중역', m?.mbGr[1] ?? 0], ['고역', m?.mbGr[2] ?? 0], ['리미터', m?.limGr ?? 0],
        ]
        const rh = h / rows.length
        g.font = '9px ui-monospace, monospace'
        rows.forEach(([label, gr], i) => {
          const yy = i * rh
          g.fillStyle = '#8a8a8a'; g.textAlign = 'left'
          g.fillText(label, 0, yy + rh / 2 + 3)
          const x0 = 38, bw = w - x0 - 34
          g.fillStyle = '#1f1f1f'; g.fillRect(x0, yy + 3, bw, rh - 6)
          const t = Math.min(1, Math.max(0, -gr / 12))
          g.fillStyle = '#f59e0b'
          g.fillRect(x0, yy + 3, bw * (on ? t : 0), rh - 6)
          g.fillStyle = '#c4c4c4'; g.textAlign = 'right'
          g.fillText(on && gr < -0.05 ? gr.toFixed(1) : '0.0', w, yy + rh / 2 + 3)
        })
      }

      // 스펙트럼
      if (spRef.current && engine.postAnalyser && engine.preAnalyser && engine.ctx) {
        const { g, w, h } = setupCanvas(spRef.current)
        g.clearRect(0, 0, w, h)
        const an = engine.postAnalyser, pre = engine.preAnalyser
        if (!freqPost || freqPost.length !== an.frequencyBinCount) { freqPost = new Float32Array(an.frequencyBinCount); freqPre = new Float32Array(pre.frequencyBinCount) }
        an.getFloatFrequencyData(freqPost); pre.getFloatFrequencyData(freqPre!)
        const nyq = engine.ctx.sampleRate / 2
        const fx = (f: number) => (Math.log(f / 20) / Math.log(20000 / 20)) * w
        const dy = (db: number) => h - ((Math.max(-96, Math.min(0, db)) + 96) / 96) * h
        g.strokeStyle = '#262626'; g.lineWidth = 1
        g.font = '9px ui-monospace, monospace'; g.fillStyle = '#5a5a5a'; g.textAlign = 'center'
        for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
          const x = fx(f)
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke()
          g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 2)
        }
        const path = (data: Float32Array) => {
          g.beginPath()
          const cols = Math.floor(w / 2)
          for (let c = 0; c <= cols; c++) {
            // 1/6 옥타브 정도로 묶어 매끄럽게
            const f = 20 * Math.pow(1000, c / cols)
            const f0 = f / 1.06, f1 = f * 1.06
            const b0 = Math.max(1, Math.floor((f0 / nyq) * data.length)), b1 = Math.min(data.length - 1, Math.ceil((f1 / nyq) * data.length))
            let mx = -200
            for (let b = b0; b <= b1; b++) if (data[b] > mx) mx = data[b]
            const x = fx(f), y = dy(mx + 10)
            if (c === 0) g.moveTo(x, y); else g.lineTo(x, y)
          }
        }
        if (on) {
          path(freqPre!)
          g.strokeStyle = 'rgba(200,200,200,0.35)'; g.lineWidth = 1; g.stroke()
          path(freqPost)
          g.lineTo(w, h); g.lineTo(0, h); g.closePath()
          g.fillStyle = 'rgba(12,153,101,0.28)'; g.fill()
          path(freqPost)
          g.strokeStyle = 'rgb(20,173,130)'; g.lineWidth = 1.5; g.stroke()
        }
      }

      // 고니오미터(벡터스코프): 세로 = 미드, 가로 = 사이드
      if (goRef.current) {
        const { g, w, h } = setupCanvas(goRef.current)
        g.fillStyle = 'rgba(13,13,13,0.35)'
        g.fillRect(0, 0, w, h)
        g.strokeStyle = '#262626'
        g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2)
        g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke()
        g.font = '9px ui-monospace, monospace'; g.fillStyle = '#5a5a5a'
        g.textAlign = 'left'; g.fillText('L', 3, 10); g.textAlign = 'right'; g.fillText('R', w - 3, 10)
        if (on && engine.anL && engine.anR) {
          if (!tdL || tdL.length !== engine.anL.fftSize) { tdL = new Float32Array(engine.anL.fftSize); tdR = new Float32Array(engine.anR.fftSize) }
          engine.anL.getFloatTimeDomainData(tdL); engine.anR.getFloatTimeDomainData(tdR!)
          g.fillStyle = 'rgba(20,173,130,0.55)'
          const sc = Math.min(w, h) * 0.45
          for (let i = 0; i < tdL.length; i += 2) {
            const l = tdL[i], r = tdR![i]
            const x = w / 2 + ((r - l) / Math.SQRT2) * sc
            const y = h / 2 - ((l + r) / Math.SQRT2) * sc
            g.fillRect(x, y, 1.2, 1.2)
          }
        }
      }

      // 상관 미터
      if (crRef.current) {
        const { g, w, h } = setupCanvas(crRef.current)
        g.clearRect(0, 0, w, h)
        g.fillStyle = '#1f1f1f'; g.fillRect(0, 4, w, h - 16)
        g.fillStyle = '#3a3a3a'; g.fillRect(w / 2 - 0.5, 2, 1, h - 12)
        const c = on && m ? m.correlation : 0
        const x = ((c + 1) / 2) * w
        g.fillStyle = c < 0 ? '#ef4444' : c < 0.3 ? '#f59e0b' : 'rgb(12,153,101)'
        g.fillRect(Math.min(w / 2, x), 6, Math.abs(x - w / 2), h - 20)
        g.fillStyle = '#e4e4e4'; g.fillRect(x - 1, 2, 2, h - 12)
        g.font = '9px ui-monospace, monospace'; g.fillStyle = '#8a8a8a'
        g.textAlign = 'left'; g.fillText('-1', 0, h - 1)
        g.textAlign = 'center'; g.fillText('0', w / 2, h - 1)
        g.textAlign = 'right'; g.fillText('+1', w, h - 1)
      }

      // 숫자 (10Hz)
      if (now - lastTxt > 100) {
        lastTxt = now
        setT('m', fmt(m?.momentary ?? -Infinity))
        setT('s', fmt(m?.shortTerm ?? -Infinity))
        const integ = m?.integrated ?? -Infinity
        setT('i', fmt(integ), Number.isFinite(integ) && Math.abs(integ - tgt) <= 1 ? '#34d399' : '#e4e4e4')
        const tp = m?.truePeakMax ?? -Infinity
        setT('tp', fmt(tp), tp > ceil + 0.05 ? '#ef4444' : '#e4e4e4')
        setT('corr', m ? m.correlation.toFixed(2) : '—')
        setT('lra', m && m.lra > 0 ? m.lra.toFixed(1) : '—')
        setT('psr', m && Number.isFinite(m.psr) && m.psr < 60 ? m.psr.toFixed(1) : '—')
        setT('plr', m && Number.isFinite(m.plr) && m.plr < 60 ? m.plr.toFixed(1) : '—')
        setT('inpk', fmt(lin2db(Math.max(m?.inLevel.peakL ?? 0, m?.inLevel.peakR ?? 0))))
        setT('outpk', fmt(lin2db(Math.max(m?.outLevel.peakL ?? 0, m?.outLevel.peakR ?? 0))))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine])

  const reg = (k: string) => (el: HTMLSpanElement | null) => { txt.current[k] = el }

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <Section title="레벨">
        <canvas ref={lvRef} className="w-full h-[150px] block" />
        <div className="grid grid-cols-2 text-[10px] text-zinc-500 mt-1" style={MONO}>
          <span>입력 <span ref={reg('inpk')} className="text-zinc-200">-∞</span></span>
          <span className="text-right">출력 <span ref={reg('outpk')} className="text-zinc-200">-∞</span></span>
        </div>
      </Section>
      <Section title="라우드니스" right={<span className="text-[10px] text-zinc-500" style={MONO}>타깃 {targetLufs}</span>}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <canvas ref={ldRef} className="w-full h-[110px] block" />
          <div className="flex flex-col justify-between text-right" style={MONO}>
            <Readout label="통합" k="i" reg={reg} big />
            <Readout label="단기" k="s" reg={reg} />
            <Readout label="순간" k="m" reg={reg} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/5 text-[10px]" style={MONO}>
          <span className="text-zinc-500">트루 피크 최대</span>
          <span><span ref={reg('tp')} className="text-zinc-100 text-[12px]">-∞</span><span className="text-zinc-500 ml-1">dBTP</span></span>
        </div>
      </Section>
      <Section title="다이내믹">
        <div className="grid grid-cols-3 gap-1 text-center" style={MONO}>
          <MiniStat label="LRA" k="lra" unit="LU" reg={reg} />
          <MiniStat label="PSR" k="psr" unit="dB" reg={reg} />
          <MiniStat label="PLR" k="plr" unit="dB" reg={reg} />
        </div>
      </Section>
      <Section title="게인 리덕션">
        <canvas ref={grRef} className="w-full h-[80px] block" />
      </Section>
      <Section title="스펙트럼">
        <canvas ref={spRef} className="w-full h-[96px] block" />
      </Section>
      <Section title="고니오미터">
        <canvas ref={goRef} className="w-full aspect-square max-h-[180px] block" />
      </Section>
      <Section title="위상 상관" right={<span ref={reg('corr')} className="text-[11px] text-zinc-200" style={MONO}>—</span>}>
        <canvas ref={crRef} className="w-full h-[26px] block" />
      </Section>
    </div>
  )
}

function MiniStat({ label, k, unit, reg }: { label: string; k: string; unit: string; reg: (k: string) => (el: HTMLSpanElement | null) => void }) {
  return (
    <div className="rounded bg-black/40 py-1">
      <div className="text-[9px] text-zinc-500">{label}</div>
      <span ref={reg(k)} className="text-[12px] text-zinc-100">—</span>
      <span className="text-[8px] text-zinc-500 ml-0.5">{unit}</span>
    </div>
  )
}

function Readout({ label, k, reg, big }: { label: string; k: string; reg: (k: string) => (el: HTMLSpanElement | null) => void; big?: boolean }) {
  return (
    <div className="leading-tight">
      <div className="text-[9px] text-zinc-500">{label}</div>
      <span ref={reg(k)} className={big ? 'text-[18px] font-semibold text-white' : 'text-[13px] text-zinc-200'}>-∞</span>
      <span className="text-[9px] text-zinc-500 ml-0.5">LUFS</span>
    </div>
  )
}

export function Section({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-white/[0.07] bg-[#121212] p-2 ${className ?? ''}`}>
      <header className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] font-semibold tracking-wide text-zinc-400">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}
