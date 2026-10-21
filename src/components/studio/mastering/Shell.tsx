'use client'

/**
 * 마스터링 화면의 공통 골격 — 전송 줄 · 타임라인(+ 바로 아래 도킹 모듈 패널) · 경고 줄 · 하단 줄(목표 음량·내보내기) · 쉬운 미터.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Play, Pause, Square, Repeat, Flag, SkipBack, Wand2, ZoomIn, ZoomOut, Volume2, VolumeX, X, Download, Save, Check, AlertTriangle, ChevronDown } from 'lucide-react'
import { type AutoTarget, type ChainParams } from '@/lib/mastering/dsp'
import { DESTS, DERIVATIVES, destById } from './destination'
import { loudnessWords } from '@/lib/mastering/compose'
import { useMastering, type LibrarySong } from './store'
import { useUi, autoMatch, exportActive, exportForDestinations, saveToLibrary, type ExportOpts } from './actions'
import { Timeline, fmtClock, AUTO_RANGE } from './Timeline'
import { METER_HELP, loudTone, peakTone } from './labels'
import { applyStyle } from './StylePanel'
import { useDock, ToolPanel } from './ChainList'
import { ModulePanel } from './ModulePanel'
import type { MasteringEngine } from './engine'

export interface ViewCtx {
  engine: MasteringEngine
  playing: boolean
  compare: 'a' | 'b' | 'r'
  setListenMode: (m: 'a' | 'b' | 'r') => void
  togglePlay: () => void
  stop: () => void
  addMarker: () => void
  openLibrary: () => void
  openFile: () => void
  openReferencePicker: (cb: (s: LibrarySong) => void) => void
  duration: number
  matchAB: boolean
  setMatchAB: (v: boolean) => void
  monitorDb: number
  setMonitorDb: (v: number) => void
  muted: boolean
  setMuted: (v: boolean) => void
  mono: boolean
  setMono: (v: boolean) => void
  autoTarget: AutoTarget | null
  setAutoTarget: (t: AutoTarget | null) => void
  expanded: boolean
}

// ───────────────────────── 전송 줄 ─────────────────────────

export function TransportBar({ ctx, counterRef }: { ctx: ViewCtx; counterRef: React.RefObject<HTMLSpanElement | null> }) {
  const active = useMastering(s => !!s.activeId)
  const startAt = useMastering(s => s.tracks.find(t => t.id === s.activeId)?.edit.start ?? 0)
  const loop = useUi(s => s.loop)
  const loopOn = useUi(s => s.loopOn)
  const setUi = useUi(s => s.set)
  return (
    <div className="ms-transport" role="toolbar" aria-label="재생">
      <div className="ms-box" style={{ padding: 4, gap: 4 }}>
        <button type="button" className="ms-tbtn play" aria-pressed={ctx.playing} onClick={ctx.togglePlay} disabled={!active} aria-label={ctx.playing ? '일시정지 (Space)' : '재생 (Space)'} title="재생 / 일시정지 (Space)">
          {ctx.playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
        </button>
        <button type="button" className="ms-tbtn stop" onClick={ctx.stop} disabled={!active} aria-label="정지 (Enter)" title="정지 (Enter)"><Square className="w-3.5 h-3.5" fill="currentColor" /></button>
        <button type="button" className="ms-tbtn" aria-pressed={loopOn} onClick={() => setUi({ loopOn: !loopOn })} disabled={!active} aria-label="구간 반복 (L)" title="구간 반복 (L) — 파형을 끌어 구간을 정해요"><Repeat className="w-4 h-4" /></button>
        <button type="button" className="ms-tbtn" onClick={() => ctx.engine.seek(startAt)} disabled={!active} aria-label="처음으로" title="처음으로"><SkipBack className="w-4 h-4" /></button>
        <button type="button" className="ms-tbtn" onClick={ctx.addMarker} disabled={!active} aria-label="마커 추가 (M)" title="마커 추가 (M)"><Flag className="w-4 h-4" /></button>
      </div>
      <div className="ms-box" aria-label="재생 위치">
        <span ref={counterRef} className="ms-counter">00:00.000</span>
        <span className="mono dim text-[11px]">{loop ? `반복 ${fmtClock(loop.start)}–${fmtClock(loop.end)}` : `길이 ${fmtClock(ctx.duration)}`}</span>
      </div>
      <div className="ms-box">
        <div className="ms-seg" role="group" aria-label="비교 듣기">
          <button type="button" aria-pressed={ctx.compare === 'a'} onClick={() => ctx.setListenMode('a')} title="처리하기 전 소리">원본</button>
          <button type="button" aria-pressed={ctx.compare === 'b'} onClick={() => ctx.setListenMode('b')} title="마스터링한 소리">마스터</button>
          <button type="button" aria-pressed={ctx.compare === 'r'} onClick={() => ctx.setListenMode('r')} title="불러온 레퍼런스 곡(전문 설정 → 레퍼런스)">레퍼런스</button>
        </div>
        <button type="button" className="ms-btn" aria-pressed={ctx.matchAB} onClick={() => ctx.setMatchAB(!ctx.matchAB)}
          style={ctx.matchAB ? { color: 'var(--m-green)', borderColor: 'var(--m-green-dim)' } : undefined}
          title="처리본이 커진 만큼 원본을 올려 들려줘요. 내보내기엔 영향 없어요">음량 맞춰 비교</button>
      </div>
      <div className="ms-box ml-auto">
        <button type="button" onClick={() => ctx.setMuted(!ctx.muted)} aria-label={ctx.muted ? '소리 켜기' : '소리 끄기'} className="dim hover:text-white">{ctx.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
        <input type="range" min={-40} max={6} step={0.5} value={ctx.monitorDb} onChange={e => ctx.setMonitorDb(Number(e.target.value))} aria-label="모니터 볼륨" title="듣는 소리 크기만 바꿔요(내보내기엔 영향 없어요)" className="w-20 accent-[var(--m-green)]" />
        <span className="mono dim w-9">{ctx.monitorDb > 0 ? '+' : ''}{ctx.monitorDb.toFixed(1)}</span>
      </div>
    </div>
  )
}

// ───────────────────────── 타임라인 ─────────────────────────

export function TimelineStrip({ ctx }: { ctx: ViewCtx }) {
  const active = useMastering(s => s.tracks.find(t => t.id === s.activeId) ?? null)
  const params = useMastering(s => s.params)
  const srcA = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const outA = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const updateTrack = useMastering(s => s.updateTrack)
  const { loop, loopOn, peaks, processedPeaks } = useUi()
  const setUi = useUi(s => s.set)
  const [zoom, setZoom] = useState(1)
  const at = ctx.expanded ? ctx.autoTarget : null
  const autoBase = !at || at === 'volume' ? 0 : at === 'limiter.gain' ? params.limiter.gain : params.eq[at.split('.')[1] as 'lf'].gain
  return (
    <>
    <div className="ms-timeline" data-tour="timeline">
      <div className="flex flex-wrap items-center justify-between gap-x-2 mb-1 text-[11px]">
        <span className="dim">
          {active ? <>원본 <span className="mono">{srcA ? `${srcA.integrated.toFixed(1)} LUFS` : '재는 중…'}</span>{outA && <> · 마스터 <span className="mono">{outA.integrated.toFixed(1)} LUFS · 피크 {outA.truePeak.toFixed(1)}</span></>}
            <span className="faint"> · 회색=원본, 녹색=마스터 · 파형을 끌면 반복 구간</span></> : '곡을 열면 파형이 보여요'}
          {loop && <button type="button" aria-label="반복 구간 지우기" className="ml-1 align-middle hover:text-white" onClick={() => setUi({ loop: null, loopOn: false })}><X className="w-3 h-3 inline" /></button>}
        </span>
        <span className="flex items-center gap-1">
          {ctx.expanded && (
            <select value={ctx.autoTarget ?? ''} onChange={e => ctx.setAutoTarget((e.target.value || null) as AutoTarget | null)} disabled={!active} className="ms-select" aria-label="오토메이션 레인">
              <option value="">오토메이션 없음</option>
              {(Object.keys(AUTO_RANGE) as AutoTarget[]).map(k => <option key={k} value={k}>{AUTO_RANGE[k].label}</option>)}
            </select>
          )}
          <button type="button" aria-label="축소" onClick={() => setZoom(z => Math.max(1, z / 2))} disabled={zoom <= 1} className="p-0.5 dim hover:text-white disabled:opacity-30"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="mono w-7 text-center">{zoom}x</span>
          <button type="button" aria-label="확대" onClick={() => setZoom(z => Math.min(32, z * 2))} disabled={!active} className="p-0.5 dim hover:text-white disabled:opacity-30"><ZoomIn className="w-3.5 h-3.5" /></button>
        </span>
      </div>
      {active ? (
        <Timeline
          peaks={peaks} processedPeaks={processedPeaks} duration={ctx.duration || srcA?.duration || 0} engine={ctx.engine}
          markers={active.markers} onMarkers={m => updateTrack(active.id, x => ({ ...x, markers: m }), 'markers')}
          loop={loop} loopOn={loopOn} zoom={zoom} height={92}
          onSeek={t => ctx.engine.seek(t)} onLoop={r => setUi({ loop: r, loopOn: !!r })}
          edit={active.edit} onEdit={fn => updateTrack(active.id, x => ({ ...x, edit: fn(x.edit) }), 'edit')}
          autoTarget={at} autoBase={autoBase} clips={(outA ?? srcA)?.clips}
        />
      ) : (
        <div className="h-[92px] border border-dashed border-[var(--m-line)] rounded-lg flex items-center justify-center gap-2">
          <button type="button" className="ms-btn go" onClick={ctx.openLibrary}>보관함에서 고르기</button>
          <button type="button" className="ms-btn" onClick={ctx.openFile}>파일 열기</button>
        </div>
      )}
    </div>
    <DockPanel ctx={ctx} />
    </>
  )
}

// ───────────────────────── 도킹 모듈 패널(타임라인 바로 아래, 가로 전체 폭) ─────────────────────────

function DockPanel({ ctx }: { ctx: ViewCtx }) {
  const view = useDock(s => s.view)
  const folded = useDock(s => s.folded)
  const chain = useDock(s => s.chain)
  const setDock = useDock(s => s.set)
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  if (!ctx.expanded || !chain) return null
  if (!view) {
    return <div className="ms-dock empty" data-tour="panel" aria-label="모듈 패널 자리">왼쪽 체인에서 모듈이나 도구를 누르면 여기에 설정이 열려요</div>
  }
  const fold = () => setDock({ folded: !folded })
  const close = () => setDock({ view: null, folded: false })
  return (
    <div className="ms-dock" data-tour="panel">
      {view.kind === 'slot'
        ? <ModulePanel slot={view.slot} p={params} engine={ctx.engine} set={fn => setParams(fn, `slot:${view.slot}`)} recommend={fn => setParams(fn, 'recommend')}
            folded={folded} onFold={fold} onClose={close} />
        : <ToolPanel tool={view.tool} ctx={ctx} folded={folded} onFold={fold} onClose={close} />}
    </div>
  )
}

// ───────────────────────── 위험 설정 경고 ─────────────────────────

interface Warn { id: string; text: string; fix: string; apply: (p: ChainParams) => ChainParams }

export function WarningsBar({ engine }: { engine: MasteringEngine }) {
  const params = useMastering(s => s.params)
  const target = useMastering(s => s.target)
  const setParams = useMastering(s => s.setParams)
  const [live, setLive] = useState<{ tp: number; integ: number; gr: number }>({ tp: -Infinity, integ: -Infinity, gr: 0 })
  const grAvg = useRef(0)
  useEffect(() => {
    const id = setInterval(() => {
      const m = engine.meters
      if (!m || engine.paused) return
      const g = Math.max(0, -m.compGr, -m.limGr)
      grAvg.current = grAvg.current * 0.9 + g * 0.1
      setLive({ tp: m.truePeakMax, integ: m.integrated, gr: grAvg.current })
    }, 500)
    return () => clearInterval(id)
  }, [engine])

  const warns: Warn[] = []
  if (Number.isFinite(live.tp) && live.tp > 0) warns.push({ id: 'tp', text: `가장 큰 순간이 ${live.tp.toFixed(1)} dB 로 0을 넘어 찌그러질 수 있어요`, fix: '천장 -1 dB · 숨은 피크 막기', apply: p => ({ ...p, bypass: { ...p.bypass, limiter: false }, limiter: { ...p.limiter, ceiling: -1, truePeak: true } }) })
  if (params.limiter.ceiling > -0.1) warns.push({ id: 'ceil', text: `음량 상한 천장이 ${params.limiter.ceiling.toFixed(1)} dB 로 너무 높아요`, fix: '천장 -1 dB', apply: p => ({ ...p, limiter: { ...p.limiter, ceiling: -1 } }) })
  if (!params.bypass.clipper && params.clipper.threshold < -3) warns.push({ id: 'clip', text: `부드러운 깎기가 ${params.clipper.threshold.toFixed(1)} dB 부터 깎아 소리가 뭉개질 수 있어요`, fix: '깎기 끄기', apply: p => ({ ...p, bypass: { ...p.bypass, clipper: true } }) })
  if (!params.bypass.comp && params.comp.ratio >= 8) warns.push({ id: 'ratio', text: `압축 비율이 ${params.comp.ratio.toFixed(1)}:1 로 아주 세요`, fix: '비율 4:1', apply: p => ({ ...p, comp: { ...p.comp, ratio: 4 } }) })
  if (live.gr > 8) warns.push({ id: 'gr', text: `소리를 평균 ${live.gr.toFixed(1)} dB 나 누르고 있어요 — 강약이 사라질 수 있어요`, fix: '음량 3 dB 낮추기', apply: p => ({ ...p, limiter: { ...p.limiter, gain: Math.max(-30, p.limiter.gain - 3) } }) })
  if (Number.isFinite(live.integ) && live.integ > target.lufs + 3) warns.push({ id: 'loud', text: `지금 음량(${live.integ.toFixed(1)} LUFS)이 목표보다 ${(live.integ - target.lufs).toFixed(1)} 크게 나와요`, fix: '목표에 맞게 낮추기', apply: p => ({ ...p, limiter: { ...p.limiter, gain: Math.max(-30, p.limiter.gain - (live.integ - target.lufs)) } }) })
  if (!warns.length) return null
  return (
    <div className="ms-warns" role="alert" aria-label="위험 설정 경고">
      {warns.map(w => (
        <div key={w.id} className="ms-warn">
          <AlertTriangle className="w-3.5 h-3.5 flex-none text-[var(--m-amber)]" />
          <span className="min-w-0">{w.text}</span>
          <button type="button" className="ms-btn" title={`추천값: ${w.fix}`} onClick={() => setParams(w.apply, 'recommend')}>추천값으로</button>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────── 하단 줄 ─────────────────────────

/** 납품처 칩 — 목표 음량 노브의 프리셋. 내보내기 설정도 맞추고, 스타일이 적용돼 있으면 그 용도로 다시 맞춘다 */
export function pickTarget(id: string) {
  const t = destById(id)
  if (!t) return
  const s = useMastering.getState()
  s.setTarget({ id: t.id, label: t.label, lufs: t.lufs, tp: t.tp })
  if (!useUi.getState().exportManual) useUi.getState().set({ exportOpts: { ...t.opts } })
  if (s.templateId?.startsWith('style:') && s.activeId) {
    applyStyle('target')
    if (s.srcAnalysis[s.activeId]) void autoMatch().then(() => useUi.getState().set({ templateParams: useMastering.getState().params }))
  } else {
    s.setParams(p => ({ ...p, limiter: { ...p.limiter, ceiling: t.tp, truePeak: true } }), 'target')
  }
}

/** 「함께 받기」 — 체크 가능한 드롭다운 메뉴 하나(납품처 칩을 두 번 늘어놓지 않는다) */
function ExtraMenu({ targetId, ids, onToggle }: { targetId: string; ids: string[]; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  const list = DESTS.filter(d => d.id !== targetId)
  return (
    <div className="ms-menuwrap" ref={wrap}>
      <button type="button" className="ms-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
        title="같은 마스터를 다른 곳용 음량으로도 함께 만들어요">
        함께 받기{ids.length ? ` (${ids.length})` : ''} <ChevronDown className="w-3.5 h-3.5" style={open ? { transform: 'rotate(180deg)' } : undefined} />
      </button>
      {open && (
        <div className="ms-menu" role="menu" aria-label="함께 내보내기">
          <span className="head">체크한 곳용 파일을 같이 만들어요</span>
          {list.map(d => (
            <button key={d.id} type="button" role="menuitemcheckbox" aria-checked={ids.includes(d.id)} onClick={() => onToggle(d.id)}>
              <span className="box" aria-hidden>{ids.includes(d.id) && <Check className="w-3 h-3" />}</span>
              {d.label}
              <span className="v">{d.lufs} / {d.tp}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BottomBar({ expanded }: { expanded: boolean }) {
  const target = useMastering(s => s.target)
  const active = useMastering(s => !!s.activeId)
  const opts = useUi(s => s.exportOpts)
  const reports = useUi(s => s.reports)
  const busy = useUi(s => s.busy)
  const manual = useUi(s => s.exportManual)
  const dest = destById(target.id)
  const set = (p: Partial<ExportOpts>) => useUi.getState().set({ exportOpts: { ...opts, ...p }, exportManual: true })
  const setFormat = (f: 'wav' | 'mp3') => set(expanded ? { format: f } : { format: f, bits: 24, dither: 'tpdf', range: 'all' })
  // 함께 내보낼 납품처 — 납품처가 바뀌면 그 납품처의 기본 파생본으로
  const [extra, setExtra] = useState<{ for: string; ids: string[] }>({ for: '', ids: [] })
  const extraIds = extra.for === target.id ? extra.ids : DERIVATIVES[target.id] ?? []
  const toggleExtra = (id: string) => setExtra({ for: target.id, ids: extraIds.includes(id) ? extraIds.filter(x => x !== id) : [...extraIds, id] })
  const download = () => {
    if (!extraIds.length || !dest) { void exportActive(); return }
    const list = [dest, ...extraIds.map(destById).filter((d): d is NonNullable<typeof d> => !!d)]
    void exportForDestinations(list)
  }
  const recent = reports.slice(0, Math.max(1, (dest ? 1 : 0) + extraIds.length))
  return (
    <div className="ms-bottom" data-tour="export">
      <div className="ms-bottomrow">
        <div className="flex items-center gap-1.5" role="group" aria-label="어디에 쓸 곡인가요">
          <span className="ms-rowlabel" title="고르면 목표 음량·천장·파일 형식이 맞춰져요">용도</span>
          <select className="ms-select dest" aria-label="용도" value={dest ? target.id : 'custom'} onChange={e => pickTarget(e.target.value)}>
            {DESTS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            {!dest && <option value="custom">{target.label}</option>}
          </select>
          <span className="mono dim text-[11px]" title="목표 음량(LUFS) / 천장(dBTP)">{target.lufs} / {target.tp}</span>
        </div>
        <button type="button" className="ms-btn go" onClick={autoMatch} disabled={!active || !!busy} title="곡 전체를 재서 음량 상한(리미터)의 게인을 목표에 맞춰요"><Wand2 className="w-3.5 h-3.5" /> 자동 맞춤</button>
        <span className="sep" aria-hidden />
        <div className="ms-seg" role="group" aria-label="파일 형식">
          <button type="button" aria-pressed={opts.format === 'wav'} onClick={() => setFormat('wav')} title="음원 사이트 등록·보관용(고음질, 파일이 커요)">WAV</button>
          <button type="button" aria-pressed={opts.format === 'mp3'} onClick={() => setFormat('mp3')} title="메신저·공유용(작은 파일)">MP3</button>
        </div>
        {expanded && (
          <>
            {opts.format === 'wav' && (
              <select className="ms-select" aria-label="비트" value={opts.bits} onChange={e => { const b = Number(e.target.value) as ExportOpts['bits']; set({ bits: b, dither: b === 16 ? 'shaped' : b === 32 ? 'none' : opts.dither }) }}>
                <option value={16}>16bit</option><option value={24}>24bit</option><option value={32}>32bit float</option>
              </select>
            )}
            <select className="ms-select" aria-label="샘플레이트" value={opts.rate} onChange={e => set({ rate: Number(e.target.value) as ExportOpts['rate'] })}>
              <option value={44100}>44.1kHz</option><option value={48000}>48kHz</option><option value={96000}>96kHz</option>
            </select>
            {opts.format === 'wav' && opts.bits !== 32 && (
              <select className="ms-select" aria-label="디더" title="비트를 줄일 때 생기는 잡음을 덜 들리게" value={opts.dither} onChange={e => set({ dither: e.target.value as ExportOpts['dither'] })}>
                <option value="none">디더 없음</option><option value="tpdf">디더 TPDF</option><option value="shaped">노이즈 셰이핑</option>
              </select>
            )}
            <select className="ms-select" aria-label="내보낼 구간" value={opts.range} onChange={e => set({ range: e.target.value as ExportOpts['range'] })}>
              <option value="all">곡 전체</option><option value="loop">반복 구간만</option>
            </select>
          </>
        )}
        {manual && dest && (
          <button type="button" className="ms-btn" onClick={() => useUi.getState().set({ exportOpts: { ...dest.opts }, exportManual: false })} title={`${dest.label}에 맞는 파일 설정으로`}>납품처 기준으로</button>
        )}
        <ExtraMenu targetId={target.id} ids={extraIds} onToggle={toggleExtra} />
        <button type="button" className="ms-btn go" style={{ height: 30 }} disabled={!active || !!busy} onClick={download}
          title={extraIds.length ? `${dest?.label ?? ''}와 함께 고른 ${extraIds.length}곳용 파일을 각각 만들어요` : '지금 설정으로 파일을 만들어요'}>
          <Download className="w-4 h-4" /> 파일로 받기{extraIds.length ? ` (${extraIds.length + 1}개)` : ''}
        </button>
        <button type="button" className="ms-btn" style={{ height: 30 }} disabled={!active || !!busy} onClick={saveToLibrary} title="결과를 보관함에 새 곡으로 저장해요(원곡은 그대로)"><Save className="w-4 h-4" /> 보관함에 저장</button>
      </div>
      {reports.length > 0 && (
        <ul className="flex flex-col gap-0.5" aria-label="내보낸 파일 재측정">
          {recent.map((r, i) => (
            <li key={i} className="text-[11px] inline-flex items-center gap-1.5" title={`${r.file} — 내보낸 파일을 다시 열어 쟀어요`}>
              {r.pass.loudness && r.pass.peak ? <Check className="w-3.5 h-3.5 text-[var(--m-green)]" /> : <AlertTriangle className="w-3.5 h-3.5 text-[var(--m-amber)]" />}
              <span className="dim">{r.target.label}</span>
              <span className="mono" style={{ color: r.pass.loudness ? 'var(--m-text)' : 'var(--m-amber)' }}>{r.integrated.toFixed(1)} LUFS</span>
              <span className="mono" style={{ color: r.pass.peak ? 'var(--m-text)' : 'var(--m-red)' }}>피크 {r.truePeak.toFixed(1)}</span>
              <span style={{ color: r.pass.loudness && r.pass.peak ? 'var(--m-green)' : 'var(--m-amber)' }}>{r.pass.loudness && r.pass.peak ? '목표 합격' : '목표와 차이 있음'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ───────────────────────── 쉬운 미터(접힘 상태) ─────────────────────────

export function EasyMeters({ engine }: { engine: MasteringEngine }) {
  const target = useMastering(s => s.target)
  const ceiling = useMastering(s => s.params.limiter.ceiling)
  const fill = useRef<HTMLDivElement>(null)
  const word = useRef<HTMLSpanElement>(null)
  const lufs = useRef<HTMLSpanElement>(null)
  const st = useRef<HTMLSpanElement>(null)
  const tp = useRef<HTMLSpanElement>(null)
  const lo = -36, hi = -4
  const pos = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`
  useEffect(() => {
    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const m = engine.meters
      const on = !engine.paused && !!m
      if (fill.current) fill.current.style.width = on && Number.isFinite(m!.shortTerm) ? pos(m!.shortTerm) : '0%'
      if (now - last < 250) return
      last = now
      const integ = on ? m!.integrated : -Infinity
      const w = loudnessWords(integ, target.lufs)
      if (word.current) { word.current.textContent = w.text; word.current.style.color = w.tone === 'ok' ? 'var(--m-green)' : w.tone === 'high' ? 'var(--m-amber)' : 'var(--m-dim)' }
      const f = (v: number) => (Number.isFinite(v) && v > -150 ? v.toFixed(1) : '—')
      if (lufs.current) { lufs.current.textContent = f(integ); lufs.current.style.color = loudTone(integ, target.lufs) }
      if (st.current) st.current.textContent = f(on ? m!.shortTerm : -Infinity)
      const p = on ? m!.truePeakMax : -Infinity
      if (tp.current) { tp.current.textContent = f(p); tp.current.style.color = peakTone(p, ceiling) }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, target.lufs, ceiling]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-2" data-tour="meters">
      <div className="ms-meterbox">
        <div className="flex items-baseline justify-between">
          <span className="ms-rowlabel">지금 음량</span>
          <span ref={word} className="text-[16px] font-bold">재생하면 재요</span>
        </div>
        <div className="relative h-4 mt-2 rounded-md bg-[var(--m-well)] overflow-hidden" aria-hidden>
          <div className="absolute top-0 bottom-0 bg-[var(--m-green-dim)]/40" style={{ left: pos(target.lufs - 1), width: `calc(${pos(target.lufs + 1)} - ${pos(target.lufs - 1)})` }} />
          <div ref={fill} className="absolute left-0 top-0 bottom-0 bg-[var(--m-green)]" style={{ width: 0, opacity: 0.85 }} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: pos(target.lufs) }} />
        </div>
        <div className="flex justify-between text-[10px] faint mt-1"><span>작게</span><span>목표</span><span>크게</span></div>
      </div>
      <div className="ms-meterbox grid grid-cols-2 gap-2">
        <div title={METER_HELP.lufs}>
          <div className="ms-rowlabel">통합 음량</div>
          <span ref={lufs} className="mono text-[20px] font-semibold">—</span> <span className="text-[10px] dim">LUFS</span>
          <div className="text-[10px] dim">목표 <span className="mono">{target.lufs}</span> · 단기 <span ref={st} className="mono">—</span></div>
        </div>
        <div title={METER_HELP.tp}>
          <div className="ms-rowlabel">가장 큰 순간</div>
          <span ref={tp} className="mono text-[20px] font-semibold">—</span> <span className="text-[10px] dim">dBTP</span>
          <div className="text-[10px] dim">천장 <span className="mono">{ceiling.toFixed(1)}</span></div>
        </div>
        <p className="col-span-2 text-[10px] faint leading-relaxed">음량: {METER_HELP.lufs}. 가장 큰 순간: {METER_HELP.tp}. 녹색은 목표 안, 주황은 조금 벗어남, 빨강은 넘침이에요.</p>
      </div>
    </div>
  )
}
