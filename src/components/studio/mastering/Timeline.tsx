'use client'

/**
 * 파형 + 타임라인 + 마커(드래그로 이동) + 반복 구간 + 자르기·페이드 표시 + 오토메이션 레인.
 * 파형 클릭: 이동 · 파형 드래그: 반복 구간 · 마커 깃발 드래그: 이동, 클릭: 그 위치로.
 * 오토메이션 레인: 빈 곳 클릭 = 점 추가, 점 드래그 = 이동, 점 더블클릭 = 삭제.
 * 확대하면 이 영역만 가로로 스크롤된다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { evalAuto, fadeShape, type AutoPoint, type AutoTarget, type EditParams } from '@/lib/mastering/dsp'
import type { ClipEvent } from '@/lib/mastering/analyze'
import { MONO } from './controls'
import type { MasteringEngine } from './engine'
import type { Marker } from './store'

export type { Marker }
export interface LoopRange { start: number; end: number }

export const AUTO_RANGE: Record<AutoTarget, { min: number; max: number; def: number; label: string }> = {
  volume: { min: -24, max: 12, def: 0, label: '볼륨' },
  'eq.lf': { min: -12, max: 12, def: 0, label: 'EQ 저역 게인' },
  'eq.lmf': { min: -12, max: 12, def: 0, label: 'EQ 저중역 게인' },
  'eq.mf': { min: -12, max: 12, def: 0, label: 'EQ 중역 게인' },
  'eq.hmf': { min: -12, max: 12, def: 0, label: 'EQ 중고역 게인' },
  'eq.hf': { min: -12, max: 12, def: 0, label: 'EQ 고역 게인' },
  'limiter.gain': { min: -12, max: 24, def: 0, label: '리미터 게인' },
}

export function fmtClock(t: number, withMs = true) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 1000)
  return withMs ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function Timeline({
  peaks, processedPeaks, duration, engine, markers, onMarkers, loop, loopOn, zoom, onSeek, onLoop,
  edit, onEdit, autoTarget, autoBase, clips, height = 150,
}: {
  peaks: Float32Array | null
  processedPeaks?: Float32Array | null
  duration: number
  engine: MasteringEngine
  markers: Marker[]
  onMarkers: (m: Marker[]) => void
  loop: LoopRange | null
  loopOn: boolean
  zoom: number
  onSeek: (t: number) => void
  onLoop: (r: LoopRange | null) => void
  edit: EditParams
  onEdit: (fn: (e: EditParams) => EditParams, key?: string) => void
  autoTarget: AutoTarget | null
  /** 오토메이션 점이 없을 때 기준값(그 파라미터의 지금 값) */
  autoBase: number
  clips?: ClipEvent[]
  /** 파형 영역 높이(px) */
  height?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const wave = useRef<HTMLCanvasElement>(null)
  const lane = useRef<HTMLCanvasElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x0: number; t0: number; moved: boolean } | null>(null)
  const markerDrag = useRef<{ id: string; x0: number; moved: boolean } | null>(null)
  const [dragMarker, setDragMarker] = useState<{ id: string; time: number } | null>(null)
  const ptDrag = useRef<number | null>(null)

  // 파형 그리기
  useEffect(() => {
    const c = wave.current
    if (!c) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const top = 18, wh = h - top - 2, mid = top + wh / 2
      g.fillStyle = '#121212'; g.fillRect(0, 0, w, top)
      if (duration > 0) {
        const pxPerSec = w / duration
        const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300]
        const step = steps.find(s => s * pxPerSec >= 70) ?? 600
        g.font = '9px ui-monospace, monospace'; g.fillStyle = '#777'; g.strokeStyle = '#2a2a2a'
        for (let t = 0; t <= duration; t += step) {
          const x = Math.round(t * pxPerSec) + 0.5
          g.beginPath(); g.moveTo(x, top - 6); g.lineTo(x, h); g.stroke()
          g.fillText(fmtClock(t, false), x + 3, 11)
        }
      }
      g.strokeStyle = '#2f2f2f'; g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke()
      const drawPeaks = (pk: Float32Array, color: string) => {
        const n = pk.length / 2
        g.fillStyle = color
        for (let x = 0; x < w; x++) {
          const b0 = Math.floor((x / w) * n), b1 = Math.max(b0 + 1, Math.floor(((x + 1) / w) * n))
          let mn = 0, mx = 0
          for (let b = b0; b < b1 && b < n; b++) { if (pk[b * 2] < mn) mn = pk[b * 2]; if (pk[b * 2 + 1] > mx) mx = pk[b * 2 + 1] }
          g.fillRect(x, mid - mx * (wh / 2), 1, Math.max(1, (mx - mn) * (wh / 2)))
        }
      }
      // 전후 겹침: 원본은 뒤에 희미한 회색, 처리본은 앞에 선명한 녹색
      if (peaks) drawPeaks(peaks, processedPeaks ? 'rgba(170,175,182,0.32)' : 'rgba(170,175,182,0.6)')
      if (processedPeaks) drawPeaks(processedPeaks, 'rgba(82,210,126,0.8)')
      if (duration > 0) {
        const X = (t: number) => (t / duration) * w
        // 잘라 낼 앞뒤는 어둡게
        const s = edit.start, e = edit.end > 0 ? edit.end : duration
        g.fillStyle = 'rgba(0,0,0,0.6)'
        if (s > 0) g.fillRect(0, top, X(s), wh)
        if (e < duration) g.fillRect(X(e), top, w - X(e), wh)
        // 페이드 곡선
        g.strokeStyle = '#facc15'; g.lineWidth = 1.5
        const fadeLine = (t0: number, dur: number, out: boolean) => {
          g.beginPath()
          for (let k = 0; k <= 40; k++) {
            const x = k / 40, t = t0 + x * dur
            const v = out ? fadeShape(1 - x, edit.fadeOut.curve) : fadeShape(x, edit.fadeIn.curve)
            const yy = top + wh - v * wh
            if (k === 0) g.moveTo(X(t), yy); else g.lineTo(X(t), yy)
          }
          g.stroke()
        }
        if (edit.fadeIn.dur > 0) fadeLine(s, edit.fadeIn.dur, false)
        if (edit.fadeOut.dur > 0) fadeLine(e - edit.fadeOut.dur, edit.fadeOut.dur, true)
        g.lineWidth = 1
        // 클리핑 위치
        if (clips?.length) {
          g.fillStyle = '#ef4444'
          for (const cl of clips) g.fillRect(X(cl.t), top, 2, 6)
        }
        // 구간만 처리
        if (edit.region) {
          g.strokeStyle = 'rgba(167,139,250,0.9)'; g.setLineDash([4, 3])
          g.strokeRect(X(edit.region.start), top + 1, X(edit.region.end) - X(edit.region.start), wh - 2)
          g.setLineDash([])
        }
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [peaks, processedPeaks, duration, zoom, edit, clips, height])

  // 오토메이션 레인
  const pts = useMemo<AutoPoint[]>(() => (autoTarget ? edit.automation[autoTarget] ?? [] : []), [autoTarget, edit.automation])
  const range = autoTarget ? AUTO_RANGE[autoTarget] : AUTO_RANGE.volume
  useEffect(() => {
    const c = lane.current
    if (!c) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      g.fillStyle = '#0e0e0e'; g.fillRect(0, 0, w, h)
      if (!autoTarget || !duration) return
      const Y = (v: number) => h - 4 - ((v - range.min) / (range.max - range.min)) * (h - 8)
      g.strokeStyle = '#2a2a2a'
      g.beginPath(); g.moveTo(0, Y(range.def)); g.lineTo(w, Y(range.def)); g.stroke()
      g.strokeStyle = '#f59e0b'; g.lineWidth = 1.5
      g.beginPath()
      for (let x = 0; x <= w; x += 2) {
        const v = evalAuto(pts, (x / w) * duration, autoBase)
        if (x === 0) g.moveTo(x, Y(v)); else g.lineTo(x, Y(v))
      }
      g.stroke(); g.lineWidth = 1
      g.fillStyle = '#fbbf24'
      for (const p of pts) { g.beginPath(); g.arc((p.t / duration) * w, Y(p.v), 4, 0, Math.PI * 2); g.fill() }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [pts, autoTarget, duration, zoom, autoBase, range])

  // 재생 헤드 (rAF)
  useEffect(() => {
    let raf = 0
    const loopFn = () => {
      raf = requestAnimationFrame(loopFn)
      const el = head.current, c = wave.current
      if (!el || !c || !duration) return
      const x = (engine.currentTime / duration) * c.clientWidth
      el.style.transform = `translateX(${x}px)`
      const w = wrap.current
      if (w && !engine.paused && zoom > 1 && (x < w.scrollLeft || x > w.scrollLeft + w.clientWidth - 40)) w.scrollLeft = Math.max(0, x - 40)
    }
    raf = requestAnimationFrame(loopFn)
    return () => cancelAnimationFrame(raf)
  }, [engine, duration, zoom])

  const timeAt = (clientX: number) => {
    const c = wave.current!
    const r = c.getBoundingClientRect()
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration))
  }
  const laneVal = (clientY: number) => {
    const c = lane.current!
    const r = c.getBoundingClientRect()
    const v = range.min + ((r.bottom - 4 - clientY) / (r.height - 8)) * (range.max - range.min)
    return Math.round(Math.min(range.max, Math.max(range.min, v)) * 10) / 10
  }
  const setPts = (list: AutoPoint[], key: string) => {
    if (!autoTarget) return
    onEdit(e => ({ ...e, automation: { ...e.automation, [autoTarget]: [...list].sort((a, b) => a.t - b.t) } }), key)
  }
  const hitPoint = (clientX: number, clientY: number) => {
    const c = lane.current!
    const r = c.getBoundingClientRect()
    const Y = (v: number) => r.top + r.height - 4 - ((v - range.min) / (range.max - range.min)) * (r.height - 8)
    return pts.findIndex(p => Math.hypot(r.left + (p.t / duration) * r.width - clientX, Y(p.v) - clientY) < 8)
  }

  const pct = (t: number) => `${(t / Math.max(duration, 1e-6)) * 100}%`

  return (
    <div ref={wrap} className="relative w-full overflow-x-auto overflow-y-hidden rounded-lg bg-[var(--m-well)] border border-[var(--m-line-soft)] custom-scrollbar">
      <div className="relative" style={{ width: `${zoom * 100}%` }}>
        <div className="relative" style={{ height }}>
          <canvas
            ref={wave}
            className="absolute inset-0 w-full h-full cursor-text touch-none"
            onPointerDown={e => {
              if (!duration) return
              e.currentTarget.setPointerCapture(e.pointerId)
              dragRef.current = { x0: e.clientX, t0: timeAt(e.clientX), moved: false }
            }}
            onPointerMove={e => {
              const d = dragRef.current
              if (!d) return
              if (Math.abs(e.clientX - d.x0) > 4) d.moved = true
              if (d.moved) {
                const t = timeAt(e.clientX)
                onLoop({ start: Math.min(d.t0, t), end: Math.max(d.t0, t) })
              }
            }}
            onPointerUp={e => {
              const d = dragRef.current
              dragRef.current = null
              if (!d) return
              if (!d.moved) onSeek(timeAt(e.clientX))
            }}
            aria-label="파형 — 클릭하면 이동, 드래그하면 반복 구간 지정"
          />
          {loop && (
            <div
              className={`absolute top-[18px] bottom-0 pointer-events-none border-x ${loopOn ? 'bg-amber-400/10 border-amber-400/70' : 'bg-white/5 border-white/25'}`}
              style={{ left: pct(loop.start), width: `calc(${pct(loop.end)} - ${pct(loop.start)})` }}
            />
          )}
          {markers.map((m, i) => {
            const t = dragMarker?.id === m.id ? dragMarker.time : m.time
            return (
              <div key={m.id} className="absolute top-0 h-full pointer-events-none" style={{ left: pct(t) }}>
                <span className="absolute top-0 left-0 w-px h-full bg-sky-400/70" />
                <button
                  type="button"
                  className="absolute top-0 left-0 px-1 h-[16px] leading-[16px] rounded-r bg-sky-500 text-[9px] font-bold text-black whitespace-nowrap pointer-events-auto cursor-ew-resize touch-none"
                  style={MONO}
                  title={`${m.name} · ${fmtClock(m.time)} — 클릭하면 이동, 끌면 위치 변경`}
                  aria-label={`마커 ${i + 1} ${m.name}`}
                  onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); markerDrag.current = { id: m.id, x0: e.clientX, moved: false } }}
                  onPointerMove={e => {
                    const d = markerDrag.current
                    if (!d) return
                    if (Math.abs(e.clientX - d.x0) > 3) d.moved = true
                    if (d.moved) setDragMarker({ id: m.id, time: timeAt(e.clientX) })
                  }}
                  onPointerUp={e => {
                    const d = markerDrag.current
                    markerDrag.current = null
                    if (!d) return
                    if (d.moved) onMarkers(markers.map(x => (x.id === m.id ? { ...x, time: timeAt(e.clientX) } : x)).sort((a, b) => a.time - b.time))
                    else onSeek(m.time)
                    setDragMarker(null)
                  }}
                >
                  {i + 1}
                </button>
              </div>
            )
          })}
          <div ref={head} className="absolute top-0 left-0 h-full w-px bg-white pointer-events-none shadow-[0_0_4px_white]" />
        </div>
        {autoTarget && (
          <canvas
            ref={lane}
            className="block w-full h-[64px] border-t border-white/10 cursor-crosshair touch-none"
            aria-label={`${range.label} 오토메이션 — 클릭으로 점 추가, 끌어서 이동, 더블클릭으로 삭제`}
            onPointerDown={e => {
              if (!duration) return
              e.currentTarget.setPointerCapture(e.pointerId)
              const hit = hitPoint(e.clientX, e.clientY)
              if (hit >= 0) { ptDrag.current = hit; return }
              const np = { t: timeAt(e.clientX), v: laneVal(e.clientY) }
              const list = [...pts, np].sort((a, b) => a.t - b.t)
              ptDrag.current = list.indexOf(np)
              setPts(list, `auto:${autoTarget}`)
            }}
            onPointerMove={e => {
              const i = ptDrag.current
              if (i === null) return
              const list = pts.map((p, k) => (k === i ? { t: timeAt(e.clientX), v: laneVal(e.clientY) } : p))
              setPts(list, `auto:${autoTarget}`)
              ptDrag.current = [...list].sort((a, b) => a.t - b.t).indexOf(list[i])
            }}
            onPointerUp={() => { ptDrag.current = null }}
            onDoubleClick={e => {
              const hit = hitPoint(e.clientX, e.clientY)
              if (hit >= 0) setPts(pts.filter((_, k) => k !== hit), `auto-del:${autoTarget}`)
            }}
          />
        )}
      </div>
    </div>
  )
}
