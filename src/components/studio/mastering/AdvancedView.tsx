'use client'

/**
 * 고급 모드 — DAW 형태: 전송 바 / 트랙·마커 목록 · 파형 타임라인 · 마스터 채널 스트립 · 미터 열 / 아래 도크 / 상태 줄.
 * 플러그인은 인서트 슬롯을 누르면 떠 있는 창으로 열린다(여러 개, 끌어서 이동).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Play, Pause, Square, Repeat, Flag, SkipBack, Wand2, Gauge, ZoomIn, ZoomOut, Volume2, VolumeX, X } from 'lucide-react'
import { ALL_SLOTS, type AutoTarget, type SlotId } from '@/lib/mastering/dsp'
import { LOUDNESS_TARGETS, SLOT_LABEL } from '@/lib/mastering/presets'
import { useMastering } from './store'
import { useUi, autoMatch, autoInputGain, activate } from './actions'
import { Timeline, fmtClock, AUTO_RANGE } from './Timeline'
import { MeterColumn } from './Meters'
import { PluginWindow, type WinState } from './PluginWindow'
import { TemplatesPanel, AnalysisPanel, ReferencePanel, EditPanel, AlbumPanel, StemsPanel, ExportPanel, AutoNotes } from './Panels'
import type { ViewCtx } from './SimpleView'

const TRACK_COLORS = ['#e2683c', '#e8a23a', '#d9c34a', '#8c63d8', '#4f9ee0', '#3cbfa0', '#d0559e', '#7f8794']
type Dock = 'markers' | 'templates' | 'analysis' | 'reference' | 'edit' | 'album' | 'stems' | 'export'
const DOCKS: { id: Dock; label: string }[] = [
  { id: 'markers', label: '메모리 로케이션' }, { id: 'templates', label: '템플릿 · 자동' }, { id: 'analysis', label: '분석' },
  { id: 'reference', label: '레퍼런스' }, { id: 'edit', label: '편집 · 오토메이션' }, { id: 'album', label: '앨범' },
  { id: 'stems', label: '스템' }, { id: 'export', label: '내보내기' },
]

export interface AdvancedCtx extends ViewCtx {
  stop: () => void
  addMarker: () => void
  duration: number
  matchAB: boolean
  setMatchAB: (v: boolean) => void
  monitorDb: number
  setMonitorDb: (v: number) => void
  muted: boolean
  setMuted: (v: boolean) => void
  openReferencePicker: (cb: (s: import('./store').LibrarySong) => void) => void
}

export function AdvancedView({ ctx }: { ctx: AdvancedCtx }) {
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const tracks = useMastering(s => s.tracks)
  const activeId = useMastering(s => s.activeId)
  const active = tracks.find(t => t.id === activeId) ?? null
  const target = useMastering(s => s.target)
  const srcA = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const outA = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const lastKey = useMastering(s => s.lastKey)
  const updateTrack = useMastering(s => s.updateTrack)
  const { busy, loop, loopOn, peaks, processedPeaks } = useUi()
  const setUi = useUi(s => s.set)
  const [zoom, setZoom] = useState(1)
  const [autoTarget, setAutoTarget] = useState<AutoTarget | null>(null)
  const [dock, setDock] = useState<Dock>('templates')
  const [wins, setWins] = useState<WinState[]>([])
  const [dragSlot, setDragSlot] = useState<SlotId | null>(null)
  const zTop = useRef(1)

  const openWin = (slot: SlotId) => {
    setWins(ws => {
      const ex = ws.find(w => w.slot === slot)
      if (ex) return ws.map(w => (w.slot === slot ? { ...w, z: ++zTop.current, collapsed: false } : w))
      // 채널 스트립을 가리지 않게 스트립 왼쪽에 겹쳐 쌓는다
      const n = ws.length
      const r = document.querySelector('.ms-strip')?.getBoundingClientRect()
      const x = Math.max(8, (r ? r.left - 430 : window.innerWidth - 700) - n * 24)
      const y = Math.max(64, Math.min(window.innerHeight - 320, 72 + n * 24))
      return [...ws, { slot, x, y, z: ++zTop.current, collapsed: false }]
    })
  }
  const setWin = (slot: SlotId, patch: Partial<WinState>) => setWins(ws => ws.map(w => (w.slot === slot ? { ...w, ...patch } : w)))

  const dropSlot = (onto: SlotId) => {
    if (!dragSlot || dragSlot === onto) return
    setParams(p => { const o = p.order.filter(s => s !== dragSlot); o.splice(o.indexOf(onto), 0, dragSlot); return { ...p, order: o } }, 'order')
  }
  const toggleBypass = (s: SlotId) => setParams(p => ({ ...p, bypass: { ...p.bypass, [s]: !p.bypass[s] } }), `bypass:${s}`)
  const changeTarget = (id: string) => {
    const t = LOUDNESS_TARGETS.find(x => x.id === id)
    if (!t) return
    useMastering.getState().setTarget({ id: t.id, label: t.label, lufs: t.lufs, tp: t.ceiling })
    setParams(p => ({ ...p, limiter: { ...p.limiter, ceiling: t.ceiling } }), 'target')
  }
  const autoBase = !autoTarget || autoTarget === 'volume' ? 0 : autoTarget === 'limiter.gain' ? params.limiter.gain : params.eq[autoTarget.split('.')[1] as 'lf'].gain
  const targetInList = LOUDNESS_TARGETS.some(t => t.id === target.id)
  const latencyMs = ctx.engine.meters ? (ctx.engine.meters.latency / (ctx.engine.ctx?.sampleRate ?? 48000)) * 1000 : 0

  return (
    <div className="flex flex-col">
      {/* 전송 바 */}
      <div className="ms-transport">
        <div className="ms-box" style={{ padding: 4, gap: 4 }}>
          <button type="button" className="ms-tbtn" aria-pressed={loopOn} onClick={() => setUi({ loopOn: !loopOn })} disabled={!active} aria-label="구간 반복 (L)" title="구간 반복 (L)"><Repeat className="w-4 h-4" /></button>
          <button type="button" className="ms-tbtn" onClick={() => ctx.engine.seek(active?.edit.start ?? 0)} disabled={!active} aria-label="처음으로" title="처음으로"><SkipBack className="w-4 h-4" /></button>
          <button type="button" className="ms-tbtn stop" onClick={ctx.stop} disabled={!active} aria-label="정지 (Enter)" title="정지 (Enter)"><Square className="w-3.5 h-3.5" fill="currentColor" /></button>
          <button type="button" className="ms-tbtn play" aria-pressed={ctx.playing} onClick={ctx.togglePlay} disabled={!active} aria-label={ctx.playing ? '일시정지 (Space)' : '재생 (Space)'} title="재생 / 일시정지 (Space)">
            {ctx.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
          <button type="button" className="ms-tbtn" onClick={ctx.addMarker} disabled={!active} aria-label="마커 추가 (M)" title="마커 추가 (M)"><Flag className="w-4 h-4" /></button>
        </div>
        <div className="ms-box" aria-label="재생 위치">
          <span ref={ctx.counterRef} className="ms-counter">00:00.000</span>
          <dl className="ms-kv">
            <dt>시작</dt><dd>{loop ? fmtClock(loop.start) : '—'}</dd>
            <dt>끝</dt><dd>{loop ? fmtClock(loop.end) : '—'}</dd>
            <dt>길이</dt><dd>{loop ? fmtClock(loop.end - loop.start) : fmtClock(ctx.duration)}</dd>
          </dl>
        </div>
        <div className="ms-box">
          <span className="dim">비교</span>
          <div className="ms-seg">
            {(['a', 'b', 'r'] as const).map(m => (
              <button key={m} type="button" aria-pressed={ctx.compare === m} onClick={() => ctx.setListenMode(m)}>{m === 'a' ? 'A 원본' : m === 'b' ? 'B 처리본' : 'R 레퍼런스'}</button>
            ))}
          </div>
          <button type="button" className="ms-btn" aria-pressed={ctx.matchAB} onClick={() => ctx.setMatchAB(!ctx.matchAB)} style={ctx.matchAB ? { color: 'var(--m-green)', borderColor: 'var(--m-green-dim)' } : undefined} title="비교할 때 원본·레퍼런스를 처리본과 같은 라우드니스로">음량 맞춤</button>
        </div>
        <div className="ms-box">
          <span className="dim">타깃</span>
          <select value={targetInList ? target.id : '__tpl'} onChange={e => changeTarget(e.target.value)} className="ms-select" aria-label="타깃 라우드니스">
            {!targetInList && <option value="__tpl">{target.label} {target.lufs} LUFS</option>}
            {LOUDNESS_TARGETS.map(t => <option key={t.id} value={t.id}>{t.label} {t.lufs} LUFS</option>)}
          </select>
          <button type="button" className="ms-btn go" onClick={autoMatch} disabled={!active || !!busy} title="곡 전체를 재서 리미터 게인을 타깃에 맞춰요"><Wand2 className="w-3.5 h-3.5" /> 자동 맞춤</button>
          <button type="button" className="ms-btn" onClick={autoInputGain} disabled={!active || !srcA} title="체인 입력을 -18 LUFS 근처로"><Gauge className="w-3.5 h-3.5" /> 입력 맞춤 <span className="mono dim">{params.inputTrim > 0 ? '+' : ''}{params.inputTrim.toFixed(1)}</span></button>
        </div>
        <div className="ms-box ml-auto">
          <button type="button" onClick={() => ctx.setMuted(!ctx.muted)} aria-label={ctx.muted ? '소리 켜기' : '소리 끄기'} className="dim hover:text-white">{ctx.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
          <input type="range" min={-40} max={6} step={0.5} value={ctx.monitorDb} onChange={e => ctx.setMonitorDb(Number(e.target.value))} aria-label="모니터 볼륨" className="w-20 accent-[var(--m-green)]" />
          <span className="mono dim w-9">{ctx.monitorDb > 0 ? '+' : ''}{ctx.monitorDb.toFixed(1)}</span>
        </div>
      </div>

      <div className="ms-main">
        {/* 트랙 · 마커 */}
        <div className="ms-col ms-tracks flex flex-col">
          <div className="ms-head">트랙</div>
          <div className="py-1">
            {tracks.map((t, i) => (
              <div key={t.id} className="ms-track" aria-current={t.id === activeId} role="button" tabIndex={0} onClick={() => activate(t.id)} onKeyDown={e => { if (e.key === 'Enter') activate(t.id) }}>
                <span className="chip" style={{ background: TRACK_COLORS[i % TRACK_COLORS.length] }} />
                <span className="truncate">{t.meta.title || t.title}</span>
              </div>
            ))}
            {!tracks.length && <p className="px-2 py-1 faint text-[11px]">곡 없음</p>}
          </div>
          <div className="ms-head">마커</div>
          <div className="py-1">
            {active?.markers.map((m, i) => (
              <button key={m.id} type="button" className="ms-track w-full" onClick={() => ctx.engine.seek(m.time)}>
                <span className="mono text-[10px] text-[var(--m-yellow)]">{i + 1}</span>
                <span className="truncate flex-1 text-left">{m.name}</span>
                <span className="mono text-[10px] dim">{fmtClock(m.time, false)}</span>
              </button>
            ))}
            {!active?.markers.length && <p className="px-2 py-1 faint text-[11px]">M 키로 추가</p>}
          </div>
        </div>

        {/* 타임라인 */}
        <div className="ms-col min-w-0 flex flex-col">
          <div className="ms-head">
            <span className="truncate">{active ? active.meta.title || active.title : '곡을 불러오세요'}</span>
            <span className="flex items-center gap-1 font-normal">
              <select value={autoTarget ?? ''} onChange={e => setAutoTarget((e.target.value || null) as AutoTarget | null)} disabled={!active} className="ms-select" style={{ height: 20 }} aria-label="오토메이션 레인">
                <option value="">오토메이션 없음</option>
                {(Object.keys(AUTO_RANGE) as AutoTarget[]).map(k => <option key={k} value={k}>{AUTO_RANGE[k].label}</option>)}
              </select>
              <button type="button" aria-label="축소" onClick={() => setZoom(z => Math.max(1, z / 2))} disabled={zoom <= 1} className="p-0.5 dim hover:text-white disabled:opacity-30"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="mono w-6 text-center">{zoom}x</span>
              <button type="button" aria-label="확대" onClick={() => setZoom(z => Math.min(32, z * 2))} disabled={!active} className="p-0.5 dim hover:text-white disabled:opacity-30"><ZoomIn className="w-3.5 h-3.5" /></button>
            </span>
          </div>
          <div className="p-2 flex-1">
            {active ? (
              <>
                <div className="rounded-sm overflow-hidden" style={{ borderLeft: `3px solid ${TRACK_COLORS[Math.max(0, tracks.findIndex(t => t.id === activeId)) % TRACK_COLORS.length]}` }}>
                  <Timeline
                    peaks={peaks} processedPeaks={processedPeaks} duration={ctx.duration || srcA?.duration || 0} engine={ctx.engine}
                    markers={active.markers} onMarkers={m => updateTrack(active.id, x => ({ ...x, markers: m }), 'markers')}
                    loop={loop} loopOn={loopOn} zoom={zoom}
                    onSeek={t => ctx.engine.seek(t)} onLoop={r => setUi({ loop: r, loopOn: !!r })}
                    edit={active.edit} onEdit={(fn, key) => updateTrack(active.id, x => ({ ...x, edit: fn(x.edit) }), key)}
                    autoTarget={autoTarget} autoBase={autoBase} clips={(outA ?? srcA)?.clips}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] mono dim">
                  <span>{loop ? <>반복 {fmtClock(loop.start)}–{fmtClock(loop.end)} <button type="button" aria-label="반복 구간 지우기" className="align-middle hover:text-white" onClick={() => setUi({ loop: null, loopOn: false })}><X className="w-3 h-3 inline" /></button></> : '파형을 끌면 반복 구간'}</span>
                  <span>원본 {srcA ? `${srcA.integrated.toFixed(1)} LUFS · LRA ${srcA.lra.toFixed(1)}` : '재는 중…'}{outA && ` · 처리본 ${outA.integrated.toFixed(1)} LUFS · TP ${outA.truePeak.toFixed(1)}`}</span>
                </div>
              </>
            ) : (
              <div className="h-[150px] border border-dashed border-[var(--m-line)] rounded-sm flex flex-col items-center justify-center gap-2">
                <p className="dim">마스터링할 곡을 불러오세요</p>
                <div className="flex gap-2"><button type="button" className="ms-btn go" onClick={ctx.openLibrary}>보관함</button><button type="button" className="ms-btn" onClick={ctx.openFile}>파일 열기</button></div>
              </div>
            )}
            <div className="mt-2"><AutoNotes /></div>
          </div>
        </div>

        {/* 마스터 채널 스트립 */}
        <div className="ms-col">
          <MasterStrip ctx={ctx} onOpen={openWin} onToggle={toggleBypass} dragSlot={dragSlot} setDragSlot={setDragSlot} dropSlot={dropSlot} />
        </div>

        {/* 미터 열 */}
        <div className="ms-col p-1.5">
          <MeterColumn engine={ctx.engine} targetLufs={target.lufs} ceiling={params.limiter.ceiling} playing={ctx.playing} />
        </div>
      </div>

      {/* 아래 도크 */}
      <div className="ms-dock-tabs" role="tablist">
        {DOCKS.map(d => <button key={d.id} type="button" role="tab" aria-selected={dock === d.id} onClick={() => setDock(d.id)}>{d.label}</button>)}
      </div>
      <div className="p-3 bg-[var(--m-bg)] min-h-[220px]">
        {dock === 'markers' && <MemoryLocations />}
        {dock === 'templates' && <TemplatesPanel />}
        {dock === 'analysis' && <AnalysisPanel />}
        {dock === 'reference' && <ReferencePanel onPickLibrary={ctx.openReferencePicker} />}
        {dock === 'edit' && <EditPanel autoTarget={autoTarget} setAutoTarget={setAutoTarget} />}
        {dock === 'album' && <AlbumPanel />}
        {dock === 'stems' && <StemsPanel />}
        {dock === 'export' && <ExportPanel />}
      </div>
      <div className="ms-status">
        <span className="truncate">{active ? `${active.meta.title || active.title} · ${ctx.engine.ctx?.sampleRate ?? 48000} Hz 재생 · 트랙 ${tracks.length}개 · 처리 지연 ${latencyMs.toFixed(1)} ms · 켜진 플러그인 ${ALL_SLOTS.filter(s => !params.bypass[s]).length}/${ALL_SLOTS.length}` : '곡 없음'}</span>
        <span>{lastKey ? `마지막 변경: ${undoLabel(lastKey)}` : ''}</span>
      </div>

      {wins.map(w => (
        <PluginWindow key={w.slot} w={w} p={params} set={fn => setParams(fn, `slot:${w.slot}`)} engine={ctx.engine}
          onMove={(x, y) => setWin(w.slot, { x, y })} onClose={() => setWins(ws => ws.filter(x => x.slot !== w.slot))}
          onFocus={() => setWin(w.slot, { z: ++zTop.current })} onToggle={() => setWin(w.slot, { collapsed: !w.collapsed })} />
      ))}
    </div>
  )
}

function undoLabel(k: string) {
  if (k.startsWith('slot:')) return SLOT_LABEL[k.slice(5) as SlotId] ?? '플러그인'
  if (k.startsWith('bypass:')) return `${SLOT_LABEL[k.slice(7) as SlotId] ?? ''} 켬/끔`
  const map: Record<string, string> = { order: '슬롯 순서', auto: '자동 맞춤', automaster: '자동 마스터링', template: '템플릿', markers: '마커', target: '타깃', inputTrim: '입력 맞춤', preset: '프리셋', reset: '초기화', match: '매칭 EQ' }
  return map[k.split(':')[0]] ?? '편집'
}

function MasterStrip({ ctx, onOpen, onToggle, dragSlot, setDragSlot, dropSlot }: {
  ctx: AdvancedCtx; onOpen: (s: SlotId) => void; onToggle: (s: SlotId) => void
  dragSlot: SlotId | null; setDragSlot: (s: SlotId | null) => void; dropSlot: (s: SlotId) => void
}) {
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  return (
    <div className="ms-strip">
      <h4>인서트 1–14</h4>
      <div className="flex flex-col gap-[3px]">
        {params.order.map(s => (
          <button key={s} type="button" draggable
            className={`ms-slot ${params.bypass[s] ? '' : 'on'} ${dragSlot === s ? 'drag' : ''}`}
            title={`${SLOT_LABEL[s]} — 눌러서 창 열기 · 더블클릭 켬/끔 · 끌어서 순서 바꾸기`}
            aria-label={`${SLOT_LABEL[s]} ${params.bypass[s] ? '(꺼짐)' : '(켜짐)'} 창 열기`}
            onClick={() => onOpen(s)} onDoubleClick={() => onToggle(s)}
            onDragStart={e => { setDragSlot(s); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { if (dragSlot) e.preventDefault() }}
            onDrop={e => { e.preventDefault(); dropSlot(s); setDragSlot(null) }}
            onDragEnd={() => setDragSlot(null)}>
            {params.bypass[s] ? '·  ' : ''}{SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      <h4 className="mt-1">입출력</h4>
      <StripNum label="입력" value={params.inputTrim} min={-24} max={24} unit="dB" onChange={v => setParams(p => ({ ...p, inputTrim: v }), 'inputTrim')} />
      <StripNum label="폭" value={params.stereo.width} min={0} max={200} unit="%" step={1} onChange={v => setParams(p => ({ ...p, stereo: { ...p.stereo, width: v } }), 'slot:stereo')} />
      <div className="ms-sm">
        <button type="button" className="ab" aria-pressed={ctx.compare === 'a'} onClick={() => ctx.setListenMode(ctx.compare === 'a' ? 'b' : 'a')} title="원본 듣기(전체 바이패스)">A</button>
        <button type="button" aria-pressed={params.bypass.limiter} onClick={() => setParams(p => ({ ...p, bypass: { ...p.bypass, limiter: !p.bypass.limiter } }), 'bypass:limiter')} title="리미터 끄기">L</button>
      </div>
      <FaderMeter ctx={ctx} />
      <div className="ms-valbox" title="리미터 게인">{params.limiter.gain > 0 ? '+' : ''}{params.limiter.gain.toFixed(1)}</div>
      <div className="text-center text-[10px] dim">master</div>
      <div className="ms-nametag">마스터</div>
    </div>
  )
}

function StripNum({ label, value, min, max, unit, step = 0.1, onChange }: { label: string; value: number; min: number; max: number; unit: string; step?: number; onChange: (v: number) => void }) {
  const drag = useRef<{ y: number; v: number } | null>(null)
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[10px] dim">{label}</span>
      <div role="slider" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
        className="ms-valbox flex-1 cursor-ns-resize touch-none select-none" style={{ maxWidth: 70 }}
        title="위아래로 끌기 · 더블클릭 기본값"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value } }}
        onPointerMove={e => { const d = drag.current; if (!d) return; const nv = d.v + ((d.y - e.clientY) / 150) * (max - min) * (e.shiftKey ? 0.1 : 1); onChange(Math.min(max, Math.max(min, Math.round(nv / step) * step))) }}
        onPointerUp={() => { drag.current = null }}
        onDoubleClick={() => onChange(unit === '%' ? 100 : 0)}
        onKeyDown={e => { if (e.key === 'ArrowUp') onChange(Math.min(max, value + step)); if (e.key === 'ArrowDown') onChange(Math.max(min, value - step)) }}>
        {value > 0 && unit === 'dB' ? '+' : ''}{unit === '%' ? Math.round(value) : value.toFixed(1)}{unit === '%' ? '%' : ''}
      </div>
    </div>
  )
}

/** 긴 페이더(리미터 게인) + 출력 세그먼트 미터 */
function FaderMeter({ ctx }: { ctx: AdvancedCtx }) {
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const cv = useRef<HTMLCanvasElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; v: number } | null>(null)
  const min = -12, max = 24
  const H = 230
  const t = (params.limiter.gain - min) / (max - min)
  useEffect(() => {
    let raf = 0
    const hold = [-90, -90]; const holdT = [0, 0]
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const c = cv.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#121314'; g.fillRect(0, 0, w, h)
      const m = ctx.engine.meters
      const on = !ctx.engine.paused
      const lv = [m && on ? m.outLevel.peakL : 0, m && on ? m.outLevel.peakR : 0].map(x => (x > 1e-6 ? 20 * Math.log10(x) : -90))
      const Y = (db: number) => h - ((Math.max(-60, Math.min(0, db)) + 60) / 60) * h
      const bw = (w - 3) / 2
      lv.forEach((db, i) => {
        const x = i * (bw + 3)
        for (let s = 0; s < 60; s += 1.5) {
          const segDb = -60 + s
          if (db < segDb) break
          g.fillStyle = segDb > -1 ? '#e5484d' : segDb > -6 ? '#f0a43a' : '#52d27e'
          g.fillRect(x, Y(segDb + 1.5) + 0.5, bw, Math.max(1, Y(segDb) - Y(segDb + 1.5) - 1))
        }
        if (db >= hold[i] || now - holdT[i] > 1500) { hold[i] = db >= hold[i] ? db : hold[i] - 0.5; if (db >= hold[i]) holdT[i] = now }
        if (hold[i] > -60) { g.fillStyle = hold[i] > -1 ? '#e5484d' : '#dddfe2'; g.fillRect(x, Y(hold[i]), bw, 1.5) }
      })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ctx.engine])
  const ticks = [24, 18, 12, 6, 0, -6, -12]
  return (
    <div className="flex gap-1.5 justify-center" style={{ height: H }}>
      <div className="relative w-[34px]">
        {ticks.map(v => (
          <span key={v} className="absolute left-0 text-[9px] mono faint" style={{ top: `${(1 - (v - min) / (max - min)) * 100}%`, transform: 'translateY(-50%)' }}>{v}</span>
        ))}
        <div ref={track} role="slider" aria-label="리미터 게인 페이더" aria-valuenow={params.limiter.gain} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
          className="absolute right-0 top-0 bottom-0 w-[18px] cursor-ns-resize touch-none"
          title="끌어서 리미터 게인 · 더블클릭 0 · Shift 미세"
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: params.limiter.gain } }}
          onPointerMove={e => { const d = drag.current; if (!d) return; const nv = d.v + ((d.y - e.clientY) / H) * (max - min) * (e.shiftKey ? 0.1 : 1); setParams(p => ({ ...p, limiter: { ...p.limiter, gain: Math.round(Math.min(max, Math.max(min, nv)) * 10) / 10 } }), 'slot:limiter') }}
          onPointerUp={() => { drag.current = null }}
          onDoubleClick={() => setParams(p => ({ ...p, limiter: { ...p.limiter, gain: 0 } }), 'slot:limiter')}
          onKeyDown={e => { const d = e.key === 'ArrowUp' ? 0.5 : e.key === 'ArrowDown' ? -0.5 : 0; if (d) { e.preventDefault(); setParams(p => ({ ...p, limiter: { ...p.limiter, gain: Math.min(max, Math.max(min, p.limiter.gain + d)) } }), 'slot:limiter') } }}>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[3px] rounded bg-[#0d0e0f] border border-[var(--m-line-soft)]" />
          <div className="absolute left-0 right-0 h-[22px] rounded-[2px] border border-black"
            style={{ top: `calc(${(1 - t) * 100}% - 11px)`, background: 'linear-gradient(#d8dadd, #8f9399)' }}>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[#222]" />
          </div>
        </div>
      </div>
      <canvas ref={cv} className="w-[22px] h-full rounded-[2px]" aria-label="출력 레벨 미터" />
    </div>
  )
}

function MemoryLocations() {
  const t = useMastering(s => s.tracks.find(x => x.id === s.activeId))
  const update = useMastering(s => s.updateTrack)
  if (!t) return <p className="dim">곡을 먼저 불러오세요.</p>
  const set = (m: typeof t.markers) => update(t.id, x => ({ ...x, markers: m }), 'markers')
  return (
    <table className="text-[12px] w-full max-w-[640px]">
      <thead><tr className="dim text-left"><th className="font-normal w-8">#</th><th className="font-normal">이름</th><th className="font-normal w-28">위치</th><th className="w-24" /></tr></thead>
      <tbody>
        {t.markers.map((m, i) => (
          <tr key={m.id} className="border-t border-[var(--m-line-soft)]">
            <td className="mono text-[var(--m-yellow)]">{i + 1}</td>
            <td><input value={m.name} onChange={e => set(t.markers.map(x => (x.id === m.id ? { ...x, name: e.target.value } : x)))} className="ms-input w-full" aria-label={`마커 ${i + 1} 이름`} /></td>
            <td className="mono">{fmtClock(m.time)}</td>
            <td className="text-right"><button type="button" className="ms-btn" onClick={() => set(t.markers.filter(x => x.id !== m.id))}>지우기</button></td>
          </tr>
        ))}
        {!t.markers.length && <tr><td colSpan={4} className="faint py-2">마커가 없어요. 재생 중 M 키를 누르거나 전송 바의 깃발을 누르세요. 파형 위 번호 깃발을 끌면 옮겨져요.</td></tr>}
      </tbody>
    </table>
  )
}
