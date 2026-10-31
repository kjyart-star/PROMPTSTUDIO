'use client'
/**
 * 미리보기 위 직접 편집: 요소를 눌러 고르고, 끌어서 옮기고, 모서리 손잡이로 크기를 바꾼다.
 * 가운데 맞춤 안내선과 스냅이 있고, 재생 중에도 그대로 조정한다(그림은 미리보기 쪽이 계속 그린다).
 * 요소 박스는 그리기 코드가 매 프레임 채우는 hits(캔버스 픽셀)를 읽는다.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Box, ElAdjust, ElKey, Layout } from '@/lib/cinema/types'
import { EL_LABEL } from '@/lib/cinema/layout'

export type AdjustPhase = 'start' | 'move' | 'end'

const SNAP_PX = 8

export function EditOverlay({ hitsRef, canvasW, canvasH, selected, layout, onSelect, onAdjust }: {
  hitsRef: RefObject<Partial<Record<ElKey, Box>> | null>
  canvasW: number; canvasH: number
  selected: ElKey | null
  layout: Layout
  onSelect: (k: ElKey | null) => void
  onAdjust: (k: ElKey, adj: ElAdjust, phase: AdjustPhase) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })
  const drag = useRef<null | { mode: 'move' | 'resize'; key: ElKey; sx: number; sy: number; start: ElAdjust; cx: number; cy: number; d0: number; box: Box }>(null)

  // 선택 테두리를 매 프레임 요소 박스에 맞춘다(재생 중 움직이는 요소도 따라간다)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = boxRef.current, root = rootRef.current
      const b = selected ? hitsRef.current?.[selected] : undefined
      if (el && root) {
        if (b) {
          const kx = root.clientWidth / canvasW, ky = root.clientHeight / canvasH
          el.style.display = 'block'
          el.style.left = `${b.x * kx - 3}px`; el.style.top = `${b.y * ky - 3}px`
          el.style.width = `${b.w * kx + 6}px`; el.style.height = `${b.h * ky + 6}px`
        } else el.style.display = 'none'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selected, canvasW, canvasH, hitsRef])

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * canvasW, y: ((e.clientY - r.top) / r.height) * canvasH, kx: canvasW / r.width }
  }

  const pick = (x: number, y: number): ElKey | null => {
    const hits = hitsRef.current ?? {}
    let best: ElKey | null = null, area = Infinity
    for (const [k, b] of Object.entries(hits) as [ElKey, Box][]) {
      if (!b) continue
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && b.w * b.h < area) { best = k; area = b.w * b.h }
    }
    return best
  }

  const onDown = (e: React.PointerEvent, handle = false) => {
    e.stopPropagation()
    const p = toCanvas(e)
    const key = handle && selected ? selected : pick(p.x, p.y)
    if (!key) { onSelect(null); return }
    if (key !== selected) onSelect(key)
    const b = hitsRef.current?.[key]
    if (!b) return
    const start = { ...(layout[key] ?? {}) }
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    drag.current = { mode: handle ? 'resize' : 'move', key, sx: p.x, sy: p.y, start, cx, cy, d0: Math.max(4, Math.hypot(p.x - cx, p.y - cy)), box: b }
    rootRef.current?.setPointerCapture(e.pointerId)
    onAdjust(key, start, 'start')
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const p = toCanvas(e)
    if (d.mode === 'move') {
      let ddx = p.x - d.sx, ddy = p.y - d.sy
      // 화면 가운데 스냅
      const snap = SNAP_PX * p.kx
      const ncx = d.cx + ddx, ncy = d.cy + ddy
      const v = Math.abs(ncx - canvasW / 2) < snap, h = Math.abs(ncy - canvasH / 2) < snap
      if (v) ddx = canvasW / 2 - d.cx
      if (h) ddy = canvasH / 2 - d.cy
      setGuides(g => (g.v === v && g.h === h ? g : { v, h }))
      onAdjust(d.key, { ...d.start, dx: (d.start.dx ?? 0) + ddx / canvasW, dy: (d.start.dy ?? 0) + ddy / canvasH }, 'move')
    } else {
      const k = Math.hypot(p.x - d.cx, p.y - d.cy) / d.d0
      onAdjust(d.key, { ...d.start, scale: Math.min(4, Math.max(0.3, (d.start.scale ?? 1) * k)) }, 'move')
    }
  }
  const onUp = () => {
    const d = drag.current; drag.current = null
    setGuides({ v: false, h: false })
    if (d) onAdjust(d.key, d.start, 'end')
  }

  return (
    <div ref={rootRef} className="absolute inset-0 cursor-default select-none touch-none" onPointerDown={e => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      data-testid="cinema-edit-overlay" aria-label="미리보기에서 요소를 눌러 고르고 끌어서 옮겨요">
      {guides.v && <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-pink-400/90" />}
      {guides.h && <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-pink-400/90" />}
      <div ref={boxRef} className="absolute border-[1.5px] border-emerald-400 rounded-[3px] cursor-move" style={{ display: 'none', boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }}>
        {selected && <span className="pointer-events-none absolute -top-5 left-0 rounded bg-emerald-400 px-1.5 text-[10px] font-bold text-black whitespace-nowrap">{EL_LABEL[selected]}</span>}
        {(['nw', 'ne', 'sw', 'se'] as const).map(c => (
          <span key={c} onPointerDown={e => onDown(e, true)}
            className={`absolute w-2.5 h-2.5 bg-white border-[1.5px] border-emerald-400 rounded-[2px] ${c[0] === 'n' ? '-top-1.5' : '-bottom-1.5'} ${c[1] === 'w' ? '-left-1.5' : '-right-1.5'} ${c === 'nw' || c === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} />
        ))}
      </div>
    </div>
  )
}
