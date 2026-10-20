'use client'

/**
 * 파형 + 타임라인 + 마커(메모리 로케이션) + 반복 구간.
 * 클릭: 그 위치로 이동 · 드래그: 반복 구간 지정 · 마커 깃발 클릭: 이동.
 * 확대하면 이 영역만 가로로 스크롤된다.
 */
import React, { useEffect, useRef } from 'react'
import { MONO } from './controls'

export interface Marker { id: string; time: number; name: string }
export interface LoopRange { start: number; end: number }

export function fmtClock(t: number, withMs = true) {
  if (!Number.isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 1000)
  return withMs ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function Timeline({
  peaks, duration, audio, markers, loop, loopOn, zoom, onSeek, onLoop, processedPeaks,
}: {
  peaks: Float32Array | null
  processedPeaks?: Float32Array | null
  duration: number
  audio: HTMLAudioElement
  markers: Marker[]
  loop: LoopRange | null
  loopOn: boolean
  zoom: number
  onSeek: (t: number) => void
  onLoop: (r: LoopRange | null) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const wave = useRef<HTMLCanvasElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x0: number; t0: number; moved: boolean } | null>(null)

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
      // 눈금 (초)
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
      if (processedPeaks) drawPeaks(processedPeaks, 'rgba(52,125,215,0.55)')
      if (peaks) drawPeaks(peaks, 'rgba(20,173,130,0.85)')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [peaks, processedPeaks, duration, zoom])

  // 재생 헤드 (rAF)
  useEffect(() => {
    let raf = 0
    const loopFn = () => {
      raf = requestAnimationFrame(loopFn)
      const el = head.current, c = wave.current
      if (!el || !c || !duration) return
      const x = (audio.currentTime / duration) * c.clientWidth
      el.style.transform = `translateX(${x}px)`
      // 재생 중 헤드가 보이는 범위를 벗어나면 따라간다
      const w = wrap.current
      if (w && !audio.paused && zoom > 1 && (x < w.scrollLeft || x > w.scrollLeft + w.clientWidth - 40)) w.scrollLeft = Math.max(0, x - 40)
    }
    raf = requestAnimationFrame(loopFn)
    return () => cancelAnimationFrame(raf)
  }, [audio, duration, zoom])

  const timeAt = (clientX: number) => {
    const c = wave.current!
    const r = c.getBoundingClientRect()
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration))
  }

  const pct = (t: number) => `${(t / Math.max(duration, 1e-6)) * 100}%`

  return (
    <div ref={wrap} className="relative w-full overflow-x-auto overflow-y-hidden rounded-md bg-[#0b0b0b] border border-white/5 custom-scrollbar">
      <div className="relative" style={{ width: `${zoom * 100}%`, height: 150 }}>
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
        {markers.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSeek(m.time)}
            className="absolute top-0 h-full group"
            style={{ left: pct(m.time) }}
            title={`${m.name} · ${fmtClock(m.time)}`}
          >
            <span className="absolute top-0 left-0 w-px h-full bg-sky-400/70" />
            <span className="absolute top-0 left-0 px-1 h-[16px] leading-[16px] rounded-r bg-sky-500 text-[9px] font-bold text-black whitespace-nowrap" style={MONO}>
              {i + 1}
            </span>
          </button>
        ))}
        <div ref={head} className="absolute top-0 left-0 h-full w-px bg-white pointer-events-none shadow-[0_0_4px_white]" />
      </div>
    </div>
  )
}
