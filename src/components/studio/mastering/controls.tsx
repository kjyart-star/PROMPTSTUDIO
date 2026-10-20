'use client'

/**
 * 플러그인 창 조작부 — 노브·숫자 칸·페이더·토글.
 * 공통 동작: 위아래(또는 좌우) 드래그로 값 변경, Shift 누르면 10배 미세 조절,
 * 더블클릭하면 기본값, 값 글자를 클릭하면 직접 입력.
 */
import React, { useRef, useState } from 'react'

export const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
}

export type Scale = 'lin' | 'log'

export interface ParamProps {
  label: string
  value: number
  min: number
  max: number
  def: number
  step?: number
  unit?: string
  scale?: Scale
  format?: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

const toNorm = (v: number, min: number, max: number, scale: Scale) =>
  scale === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)
const fromNorm = (t: number, min: number, max: number, scale: Scale) =>
  scale === 'log' ? min * Math.pow(max / min, t) : min + t * (max - min)

export function fmtValue(v: number, unit?: string, step = 0.1): string {
  if (unit === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k` : `${Math.round(v)}`
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const s = v.toFixed(digits)
  return v > 0 && (unit === 'dB' || unit === 'LU') ? `+${s}` : s
}

function quantize(v: number, step: number, min: number, max: number) {
  const q = Math.round(v / step) * step
  return Math.min(max, Math.max(min, Number(q.toFixed(4))))
}

/** 드래그·더블클릭·직접 입력 공통 훅 */
function useParamDrag(p: ParamProps, axis: 'y' | 'xy') {
  const { value, min, max, def, step = 0.1, scale = 'lin', onChange, disabled } = p
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, t: toNorm(value, min, max, scale) }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const d = axis === 'y' ? s.y - e.clientY : s.y - e.clientY + (e.clientX - s.x)
    const range = e.shiftKey ? 1600 : 160
    // 움직인 만큼만 누적 — Shift 를 중간에 눌러도 값이 튀지 않는다
    s.t = Math.min(1, Math.max(0, s.t + d / range))
    s.x = e.clientX; s.y = e.clientY
    onChange(quantize(fromNorm(s.t, min, max, scale), step, min, max))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    start.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    const k = e.shiftKey ? 0.1 : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(quantize(value + step * k * (scale === 'log' ? Math.max(1, value * 0.02 / step) : 1), step, min, max)) }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(quantize(value - step * k * (scale === 'log' ? Math.max(1, value * 0.02 / step) : 1), step, min, max)) }
  }
  return {
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown,
    onDoubleClick: () => !disabled && onChange(def),
  }
}

/** 값 글자 — 클릭하면 입력 칸으로 바뀐다 */
function ValueText({ p, className }: { p: ParamProps; className?: string }) {
  const [edit, setEdit] = useState<string | null>(null)
  const { value, unit, step = 0.1, format, min, max, onChange } = p
  const text = format ? format(value) : fmtValue(value, unit, step)
  if (edit !== null) {
    return (
      <input
        autoFocus
        value={edit}
        onChange={e => setEdit(e.target.value)}
        onBlur={() => setEdit(null)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            let n = parseFloat(edit)
            if (/k$/i.test(edit.trim())) n *= 1000
            if (Number.isFinite(n)) onChange(quantize(n, step, min, max))
            setEdit(null)
          }
          if (e.key === 'Escape') setEdit(null)
        }}
        className="w-full bg-black/60 border border-[var(--cm-brand)] rounded px-1 text-center text-[11px] text-white outline-none"
        style={MONO}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => !p.disabled && setEdit(String(value))}
      className={`text-[11px] leading-none text-zinc-100 hover:text-white ${className ?? ''}`}
      style={MONO}
      title="클릭해서 직접 입력"
    >
      {text}
      {unit && unit !== 'Hz' ? <span className="text-zinc-500 ml-0.5">{unit}</span> : unit === 'Hz' ? <span className="text-zinc-500 ml-0.5">Hz</span> : null}
    </button>
  )
}

export function Knob(props: ParamProps & { size?: number; color?: string; bipolar?: boolean }) {
  const { label, value, min, max, scale = 'lin', size = 40, disabled, bipolar } = props
  const handlers = useParamDrag(props, 'y')
  const t = Math.min(1, Math.max(0, toNorm(value, min, max, scale)))
  const a0 = -135, a1 = 135
  const ang = a0 + t * (a1 - a0)
  const r = size / 2 - 3
  const c = size / 2
  const arc = (from: number, to: number) => {
    const p = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180
      return [c + r * Math.cos(rad), c + r * Math.sin(rad)]
    }
    const [x0, y0] = p(from), [x1, y1] = p(to)
    const large = Math.abs(to - from) > 180 ? 1 : 0
    const sweep = to > from ? 1 : 0
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`
  }
  const zeroAng = bipolar ? 0 : a0
  const color = props.color ?? 'var(--cm-brand)'
  return (
    <div className={`flex flex-col items-center gap-1 select-none ${disabled ? 'opacity-40' : ''}`} style={{ width: Math.max(size + 12, 52) }}>
      <span className="text-[10px] text-zinc-400 leading-none whitespace-nowrap">{label}</span>
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        {...handlers}
        className="cursor-ns-resize touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--cm-brand)]"
        style={{ width: size, height: size }}
        title="드래그로 조절 · Shift 미세 조절 · 더블클릭 기본값"
      >
        <svg width={size} height={size}>
          <circle cx={c} cy={c} r={r - 4} fill="#1c1c1c" stroke="#333" strokeWidth={1} />
          <path d={arc(a0, a1)} stroke="#2e2e2e" strokeWidth={3} fill="none" strokeLinecap="round" />
          {Math.abs(ang - zeroAng) > 0.5 && (
            <path d={arc(Math.min(zeroAng, ang), Math.max(zeroAng, ang))} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
          )}
          <line
            x1={c} y1={c}
            x2={c + (r - 6) * Math.cos(((ang - 90) * Math.PI) / 180)}
            y2={c + (r - 6) * Math.sin(((ang - 90) * Math.PI) / 180)}
            stroke="#e4e4e4" strokeWidth={2} strokeLinecap="round"
          />
        </svg>
      </div>
      <ValueText p={props} />
    </div>
  )
}

/** 작은 숫자 칸 (드래그 가능) */
export function NumField(props: ParamProps & { width?: number }) {
  const handlers = useParamDrag(props, 'xy')
  return (
    <div className={`flex flex-col gap-0.5 ${props.disabled ? 'opacity-40' : ''}`} style={{ width: props.width ?? 64 }}>
      <span className="text-[10px] text-zinc-400 leading-none">{props.label}</span>
      <div
        role="slider"
        aria-label={props.label}
        aria-valuenow={props.value}
        tabIndex={props.disabled ? -1 : 0}
        {...handlers}
        className="h-6 flex items-center justify-center rounded-md bg-black/50 border border-white/10 cursor-ew-resize touch-none outline-none focus-visible:border-[var(--cm-brand)]"
        title="드래그로 조절 · Shift 미세 조절 · 더블클릭 기본값"
      >
        <ValueText p={props} />
      </div>
    </div>
  )
}

/** 세로 페이더 */
export function Fader(props: ParamProps & { height?: number }) {
  const { min, max, value, scale = 'lin', height = 120, label } = props
  const handlers = useParamDrag(props, 'y')
  const t = Math.min(1, Math.max(0, toNorm(value, min, max, scale)))
  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: 52 }}>
      <span className="text-[10px] text-zinc-400 leading-none whitespace-nowrap">{label}</span>
      <div
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        tabIndex={0}
        {...handlers}
        className="relative w-7 cursor-ns-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--cm-brand)] rounded"
        style={{ height }}
        title="드래그로 조절 · Shift 미세 조절 · 더블클릭 기본값"
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 rounded bg-black/70 border border-white/10" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 rounded bg-[var(--cm-brand)]" style={{ height: `${t * 100}%` }} />
        <div
          className="absolute left-0 right-0 h-3 rounded-sm bg-zinc-300 border border-black shadow"
          style={{ bottom: `calc(${t * 100}% - 6px)` }}
        />
      </div>
      <ValueText p={props} />
    </div>
  )
}

export function Led({ on, onClick, label, title, tone = 'brand' }: { on: boolean; onClick: () => void; label?: string; title?: string; tone?: 'brand' | 'warn' | 'solo' }) {
  const color = tone === 'warn' ? '#f59e0b' : tone === 'solo' ? '#facc15' : 'var(--cm-brand)'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-[10px] font-semibold whitespace-nowrap transition-colors ${on ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/40 text-zinc-500 hover:text-zinc-300'}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? color : '#3a3a3a', boxShadow: on ? `0 0 6px ${color}` : 'none' }} />
      {label}
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'sm' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'xs' }) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-white/10 bg-black/40 p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`${size === 'xs' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]'} rounded font-semibold whitespace-nowrap transition-colors ${value === o.value ? 'bg-[var(--cm-brand)] text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
