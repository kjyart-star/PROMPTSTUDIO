'use client'

/**
 * 쿠키뮤직 스튜디오 「마스터링」.
 *
 * 처리는 모두 브라우저에서 한다(서버 비용 없음):
 *  - 재생: <audio>/스템 → AudioWorklet 마스터 체인(src/lib/mastering/dsp.ts) → 미터·스피커
 *  - 내보내기: 같은 체인을 청크 단위 오프라인 렌더 → WAV(16/24/32f, 디더)·MP3, 태그, ZIP
 *  - 보관함 저장: 결과만 tracks 버킷에 올리고 새 곡으로 기록(원곡은 그대로)
 * 상태는 mastering/store.ts, 동작은 mastering/actions.ts.
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Play, Pause, Square, Repeat, Flag, FolderOpen, Library, X, Trash2, ChevronLeft, ChevronRight, Power, Wand2,
  ZoomIn, ZoomOut, Volume2, VolumeX, Loader2, RotateCcw, Undo2, Redo2, FileDown, FileUp, Gauge,
} from 'lucide-react'
import { ALL_SLOTS, type AutoTarget, type ChainParams, type SlotId } from '@/lib/mastering/dsp'
import { LOUDNESS_TARGETS, SLOT_LABEL, defaultChain } from '@/lib/mastering/presets'
import { StudioHero } from './StudioHero'
import { MeterColumn, Section } from './mastering/Meters'
import { PluginPanel, slotSummary } from './mastering/Plugins'
import { Timeline, fmtClock, AUTO_RANGE } from './mastering/Timeline'
import { MONO, Segmented, Led } from './mastering/controls'
import { useMastering, readChainLS, normalizeChain, type LibrarySong } from './mastering/store'
import {
  useUi, getEngine, cancelRef, addFiles, addLibrarySong, activate, fetchLibrary, autoMatch, autoInputGain,
  saveSession, loadSessionFile, exportPresetFile, importPresetFile,
} from './mastering/actions'
import { TemplatesPanel, AnalysisPanel, ReferencePanel, EditPanel, AlbumPanel, StemsPanel, ExportPanel, AutoNotes } from './mastering/Panels'

const LS_PRESETS = 'cm.mastering.userPresets.v1'
const LS_TARGET = 'cm.mastering.target.v2'
const noopSubscribe = () => () => {}

type Tab = 'templates' | 'analysis' | 'reference' | 'edit' | 'album' | 'stems' | 'export'
const TABS: { id: Tab; label: string }[] = [
  { id: 'templates', label: '템플릿 · 자동' }, { id: 'analysis', label: '분석' }, { id: 'reference', label: '레퍼런스' },
  { id: 'edit', label: '편집 · 오토메이션' }, { id: 'album', label: '앨범' }, { id: 'stems', label: '스템' }, { id: 'export', label: '내보내기' },
]

const readLS = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
const writeLS = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export function MasteringClient() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const engine = hydrated ? getEngine() : null
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const tracks = useMastering(s => s.tracks)
  const activeId = useMastering(s => s.activeId)
  const active = tracks.find(t => t.id === activeId) ?? null
  const target = useMastering(s => s.target)
  const reference = useMastering(s => s.reference)
  const srcA = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const outA = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const canUndo = useMastering(s => s.past.length > 0)
  const canRedo = useMastering(s => s.future.length > 0)
  const { busy, notice, loop, loopOn, peaks, processedPeaks } = useUi()
  const setUi = useUi(s => s.set)

  const [selectedSlot, setSelectedSlot] = useState<SlotId>('eq')
  const [tab, setTab] = useState<Tab>('templates')
  const [playing, setPlaying] = useState(false)
  const [compare, setCompare] = useState<'a' | 'b' | 'r'>('b')
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [matchAB, setMatchAB] = useState(true)
  const [monitorDb, setMonitorDb] = useState(0)
  const [muted, setMuted] = useState(false)
  const [autoTarget, setAutoTarget] = useState<AutoTarget | null>(null)
  const [library, setLibrary] = useState<{ songs: LibrarySong[]; error?: string } | null>(null)
  const [libraryPick, setLibraryPick] = useState<null | ((s: LibrarySong) => void)>(null)
  const [userPresets, setUserPresets] = useState<{ name: string; params: ChainParams }[]>([])
  const [presetName, setPresetName] = useState('')
  const [dragSlot, setDragSlot] = useState<SlotId | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<HTMLInputElement>(null)
  const presetFileRef = useRef<HTMLInputElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)

  // ── 초기값 복원 (한 번) ──
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 저장값은 마운트 뒤에만 읽을 수 있다 */
    if (!useMastering.getState().tracks.length) useMastering.setState({ params: readChainLS() })
    const tg = readLS(LS_TARGET, null)
    if (tg) useMastering.getState().setTarget(tg)
    setUserPresets(readLS(LS_PRESETS, []))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // ── 엔진 동기화 ──
  useEffect(() => { engine?.setParams(params) }, [engine, params])
  useEffect(() => { if (active) engine?.setEdit(active.edit) }, [engine, active])
  useEffect(() => { engine?.setMonitor(monitorDb, muted) }, [engine, monitorDb, muted])
  useEffect(() => { writeLS(LS_TARGET, target) }, [target])
  useEffect(() => {
    if (!engine) return
    const off = engine.on(() => { setPlaying(engine.playingAnything); setDuration(engine.duration) })
    let raf = 0
    const loopFn = () => {
      raf = requestAnimationFrame(loopFn)
      const { loop: lp, loopOn: lo } = useUi.getState()
      if (lo && lp && lp.end - lp.start > 0.05 && !engine.paused && engine.currentTime >= lp.end) engine.seek(lp.start)
      if (counterRef.current) {
        const s = fmtClock(engine.listenRef ? engine.refAudio.currentTime : engine.currentTime)
        if (counterRef.current.textContent !== s) counterRef.current.textContent = s
      }
    }
    raf = requestAnimationFrame(loopFn)
    return () => { off(); cancelAnimationFrame(raf); engine.pause() }
  }, [engine])

  // 레퍼런스 음량 맞춤
  useEffect(() => {
    if (!engine) return
    const r = reference?.analysis?.integrated
    const p = engine.meters && Number.isFinite(engine.meters.integrated) ? engine.meters.integrated : outA?.integrated ?? target.lufs
    engine.setRefTrim(matchAB && r !== undefined && Number.isFinite(r) ? Math.max(-24, Math.min(24, p - r)) : 0)
  }, [engine, reference, matchAB, outA, target, compare])

  // ── 비교 A/B/R ──
  const setListenMode = useCallback(async (m: 'a' | 'b' | 'r') => {
    if (!engine) return
    setCompare(m)
    if (m === 'r') {
      if (!reference) { useUi.getState().set({ notice: { kind: 'info', text: '레퍼런스 탭에서 레퍼런스 곡을 먼저 불러오세요.' } }); setCompare('b'); return }
      await engine.setListenRef(true)
      return
    }
    await engine.setListenRef(false)
    let trim = 0
    if (m === 'a' && matchAB) {
      const mm = engine.meters
      if (mm && Number.isFinite(mm.integrated) && Number.isFinite(mm.inIntegrated)) trim = mm.integrated - mm.inIntegrated
      else if (outA && srcA) trim = outA.integrated - srcA.integrated
    }
    useMastering.setState(s => ({ params: { ...s.params, listenOriginal: m === 'a', originalTrim: Math.max(-24, Math.min(24, trim)) } }))
  }, [engine, reference, matchAB, outA, srcA])

  // ── 전송 ──
  const togglePlay = useCallback(async () => {
    if (!engine || !active) return
    if (!engine.playingAnything) {
      const { loop: lp, loopOn: lo } = useUi.getState()
      if (!engine.listenRef && lo && lp && (engine.currentTime < lp.start || engine.currentTime >= lp.end)) engine.seek(lp.start)
      try { await engine.play() } catch (e) { console.error(e); setUi({ notice: { kind: 'err', text: engine.error ?? '재생을 시작하지 못했어요.' } }) }
    } else engine.pause()
  }, [engine, active, setUi])

  const stop = useCallback(() => {
    if (!engine) return
    engine.pause()
    const { loop: lp, loopOn: lo } = useUi.getState()
    engine.seek(lo && lp ? lp.start : active?.edit.start ?? 0)
  }, [engine, active])

  const addMarker = useCallback(() => {
    if (!engine || !active) return
    const t = engine.currentTime
    useMastering.getState().updateTrack(active.id, x => ({ ...x, markers: [...x.markers, { id: crypto.randomUUID(), time: t, name: `마커 ${x.markers.length + 1}` }].sort((a, b) => a.time - b.time) }), 'markers')
  }, [engine, active])

  // 키보드: Space 재생 · M 마커 · L 반복 · Enter 처음으로 · Cmd/Ctrl+Z 실행 취소 · Shift+Cmd/Ctrl+Z 다시 실행
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) useMastering.getState().redo(); else useMastering.getState().undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); useMastering.getState().redo(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'm' || e.key === 'M') addMarker()
      else if (e.key === 'l' || e.key === 'L') setUi({ loopOn: !useUi.getState().loopOn })
      else if (e.key === 'Enter') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, addMarker, stop, setUi])

  // ── 보관함 창 ──
  const openLibrary = async (pick?: (s: LibrarySong) => void) => {
    setLibraryPick(() => pick ?? ((s: LibrarySong) => addLibrarySong(s)))
    if (!library || library.error) setLibrary(await fetchLibrary())
  }

  // ── 슬롯 ──
  const moveSlot = (id: SlotId, dir: -1 | 1) => setParams(p => {
    const o = [...p.order]
    const i = o.indexOf(id), j = i + dir
    if (j < 0 || j >= o.length) return p
    ;[o[i], o[j]] = [o[j], o[i]]
    return { ...p, order: o }
  }, 'order')
  const dropSlot = (onto: SlotId) => {
    if (!dragSlot || dragSlot === onto) return
    setParams(p => {
      const o = p.order.filter(s => s !== dragSlot)
      o.splice(o.indexOf(onto), 0, dragSlot)
      return { ...p, order: o }
    }, 'order')
  }
  const slotOn = (s: SlotId) => !params.bypass[s]
  const toggleSlot = (s: SlotId) => setParams(p => ({ ...p, bypass: { ...p.bypass, [s]: !p.bypass[s] } }), `bypass:${s}`)

  // ── 내 프리셋 ──
  const saveUserPreset = () => {
    const name = presetName.trim()
    if (!name) return
    const list = [...userPresets.filter(p => p.name !== name), { name, params: { ...params, listenOriginal: false, originalTrim: 0 } }]
    setUserPresets(list); writeLS(LS_PRESETS, list); setPresetName('')
    setUi({ notice: { kind: 'ok', text: `「${name}」 프리셋을 저장했어요.` } })
  }

  const changeTarget = (id: string) => {
    const t = LOUDNESS_TARGETS.find(x => x.id === id)
    if (!t) return
    useMastering.getState().setTarget({ id: t.id, label: t.label, lufs: t.lufs, tp: t.ceiling })
    setParams(p => ({ ...p, limiter: { ...p.limiter, ceiling: t.ceiling } }), 'target')
  }

  const autoBase = (() => {
    if (!autoTarget) return 0
    if (autoTarget === 'volume') return 0
    if (autoTarget === 'limiter.gain') return params.limiter.gain
    const k = autoTarget.split('.')[1] as 'lf' | 'lmf' | 'mf' | 'hmf' | 'hf'
    return params.eq[k].gain
  })()

  const anyProcessing = ALL_SLOTS.some(s => slotOn(s))
  const targetInList = LOUDNESS_TARGETS.some(t => t.id === target.id)
  const updateActive = useMastering(s => s.updateTrack)

  return (
    <div
      className="w-full pb-10 text-white flex flex-col gap-3"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true) } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDropActive(false) }}
      onDrop={e => { if (e.dataTransfer.files.length && !dragSlot) { e.preventDefault(); setDropActive(false); addFiles(Array.from(e.dataTransfer.files)) } }}
    >
      <StudioHero
        badge={<><Volume2 className="w-3.5 h-3.5" /><span>마스터링 스튜디오</span></>}
        title={<>곡을 <span className="text-primary">발매 음량</span>까지</>}
        desc="템플릿·자동 마스터링으로 시작해 EQ·컴프·리미터를 다듬고, 레퍼런스와 비교한 뒤 WAV·MP3 로 내보내거나 보관함에 새 곡으로 저장해요."
        bg="/studio/hero-console.webp"
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openLibrary()} className="h-9 px-3 rounded-lg bg-[var(--cm-brand)] text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:brightness-110">
            <Library className="w-4 h-4" /> 보관함에서 불러오기
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-white/15 bg-black/40 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/10">
            <FolderOpen className="w-4 h-4" /> 파일 열기
          </button>
          <button type="button" onClick={() => sessionRef.current?.click()} className="h-9 px-3 rounded-lg border border-white/15 bg-black/40 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/10">
            <FileUp className="w-4 h-4" /> 세션 열기
          </button>
          <button type="button" onClick={saveSession} disabled={!tracks.length || !!busy} className="h-9 px-3 rounded-lg border border-white/15 bg-black/40 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40">
            <FileDown className="w-4 h-4" /> 세션 저장
          </button>
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a" multiple hidden onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
          <input ref={sessionRef} type="file" accept=".cmmaster,.zip" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadSessionFile(f); e.target.value = '' }} />
        </div>
      </StudioHero>

      {notice && (
        <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${notice.kind === 'err' ? 'border-red-500/40 bg-red-500/10 text-red-200' : notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-white/15 bg-white/5 text-zinc-200'}`}>
          <span className="flex-1">{notice.text}</span>
          <button type="button" aria-label="알림 닫기" onClick={() => setUi({ notice: null })} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── 상단 전송 바 ── */}
      <div className="rounded-lg border border-white/[0.08] bg-[#121212] px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <TBtn label={playing ? '일시정지 (Space)' : '재생 (Space)'} onClick={togglePlay} disabled={!active} active={playing}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </TBtn>
          <TBtn label="정지 · 처음으로 (Enter)" onClick={stop} disabled={!active}><Square className="w-3.5 h-3.5" /></TBtn>
          <TBtn label="구간 반복 (L)" onClick={() => setUi({ loopOn: !loopOn })} disabled={!active} active={loopOn}><Repeat className="w-4 h-4" /></TBtn>
          <TBtn label="마커 추가 (M)" onClick={addMarker} disabled={!active}><Flag className="w-4 h-4" /></TBtn>
        </div>
        <div className="rounded-md bg-black/70 border border-white/10 px-3 h-10 flex items-center" aria-label="재생 위치">
          <span ref={counterRef} className={`text-[24px] leading-none tracking-tight ${compare === 'r' ? 'text-amber-300' : 'text-emerald-300'}`} style={MONO}>00:00.000</span>
          <span className="ml-2 text-[10px] text-zinc-500" style={MONO}>/ {fmtClock(duration)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">비교</span>
          <Segmented value={compare} onChange={v => setListenMode(v)} options={[{ value: 'a', label: 'A 원본' }, { value: 'b', label: 'B 처리본' }, { value: 'r', label: 'R 레퍼런스' }]} />
          <Led on={matchAB} onClick={() => { const v = !matchAB; setMatchAB(v); if (compare === 'a') setTimeout(() => setListenMode('a'), 0) }} label="음량 맞춤" title="원본·레퍼런스를 처리본과 같은 라우드니스로 맞춰 들려줘요 — 큰 소리에 속지 않게" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">타깃</span>
          <select value={targetInList ? target.id : '__tpl'} onChange={e => changeTarget(e.target.value)} className="h-7 rounded-md bg-black/50 border border-white/10 text-[12px] text-zinc-100 px-2" aria-label="타깃 라우드니스">
            {!targetInList && <option value="__tpl">{target.label} {target.lufs} LUFS</option>}
            {LOUDNESS_TARGETS.map(t => <option key={t.id} value={t.id}>{t.label} {t.lufs} LUFS</option>)}
          </select>
          <button type="button" onClick={autoMatch} disabled={!active || !!busy} className="h-7 px-2.5 rounded-md bg-[var(--cm-brand)] text-white text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-40 hover:brightness-110" title="곡 전체를 재서 리미터 게인을 타깃 라우드니스에 맞춰요">
            <Wand2 className="w-3.5 h-3.5" /> 자동 맞춤
          </button>
          <button type="button" onClick={autoInputGain} disabled={!active || !srcA} className="h-7 px-2 rounded-md border border-white/15 bg-black/40 text-[12px] inline-flex items-center gap-1 disabled:opacity-40 hover:bg-white/10" title="체인에 들어가는 소리를 -18 LUFS 근처로 맞춰 플러그인 기준점을 맞춰요">
            <Gauge className="w-3.5 h-3.5" /> 입력 맞춤 <span className="text-zinc-500" style={MONO}>{params.inputTrim > 0 ? '+' : ''}{params.inputTrim.toFixed(1)}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <TBtn label="실행 취소 (⌘/Ctrl+Z)" onClick={() => useMastering.getState().undo()} disabled={!canUndo}><Undo2 className="w-4 h-4" /></TBtn>
          <TBtn label="다시 실행 (⇧+⌘/Ctrl+Z)" onClick={() => useMastering.getState().redo()} disabled={!canRedo}><Redo2 className="w-4 h-4" /></TBtn>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button type="button" onClick={() => setMuted(v => !v)} aria-label={muted ? '소리 켜기' : '소리 끄기'} className="text-zinc-400 hover:text-white">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={-40} max={6} step={0.5} value={monitorDb} onChange={e => setMonitorDb(Number(e.target.value))} aria-label="모니터 볼륨" className="w-24 accent-[var(--cm-brand)]" title="듣는 볼륨만 바꿔요 — 내보내는 소리에는 영향 없음" />
          <span className="text-[10px] text-zinc-500 w-10" style={MONO}>{monitorDb > 0 ? '+' : ''}{monitorDb.toFixed(1)}</span>
        </div>
      </div>

      {busy && (
        <div className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 flex items-center gap-3 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--cm-brand)]" />
          <span className="text-zinc-200">{busy.label}</span>
          <div className="flex-1 h-1.5 rounded bg-black/60 overflow-hidden min-w-[80px]">
            <div className="h-full bg-[var(--cm-brand)] transition-[width]" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
          </div>
          <span className="text-[11px] text-zinc-400" style={MONO}>{Math.round(busy.progress * 100)}%</span>
          <button type="button" onClick={() => { cancelRef.cancelled = true }} className="text-[12px] text-zinc-400 hover:text-white">멈추기</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_208px] xl:grid-cols-[minmax(0,1fr)_236px] gap-3 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {/* ── 파형 / 타임라인 ── */}
          <Section
            title={active ? active.meta.title || active.title : '곡'}
            right={
              <div className="flex items-center gap-1">
                <select value={autoTarget ?? ''} onChange={e => setAutoTarget((e.target.value || null) as AutoTarget | null)} disabled={!active}
                  className="h-6 rounded-md bg-black/50 border border-white/10 text-[11px] text-zinc-200 px-1" aria-label="오토메이션 레인">
                  <option value="">오토메이션 레인 없음</option>
                  {(Object.keys(AUTO_RANGE) as AutoTarget[]).map(k => <option key={k} value={k}>{AUTO_RANGE[k].label}</option>)}
                </select>
                <button type="button" aria-label="축소" onClick={() => setZoom(z => Math.max(1, z / 2))} disabled={zoom <= 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="text-[10px] text-zinc-500 w-6 text-center" style={MONO}>{zoom}x</span>
                <button type="button" aria-label="확대" onClick={() => setZoom(z => Math.min(32, z * 2))} disabled={!active} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ZoomIn className="w-3.5 h-3.5" /></button>
              </div>
            }
          >
            {active && engine ? (
              <>
                <Timeline
                  peaks={peaks} processedPeaks={processedPeaks} duration={duration || srcA?.duration || 0} engine={engine}
                  markers={active.markers} onMarkers={m => updateActive(active.id, x => ({ ...x, markers: m }), 'markers')}
                  loop={loop} loopOn={loopOn} zoom={zoom}
                  onSeek={t => engine.seek(t)} onLoop={r => setUi({ loop: r, loopOn: !!r })}
                  edit={active.edit} onEdit={(fn, key) => updateActive(active.id, x => ({ ...x, edit: fn(x.edit) }), key)}
                  autoTarget={autoTarget} autoBase={autoBase} clips={(outA ?? srcA)?.clips}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {loop && (
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-200" style={MONO}>
                      반복 {fmtClock(loop.start)} – {fmtClock(loop.end)}
                      <button type="button" aria-label="반복 구간 지우기" onClick={() => setUi({ loop: null, loopOn: false })} className="ml-1 hover:text-white"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {active.markers.map((m, i) => (
                    <button key={m.id} type="button" onClick={() => engine.seek(m.time)} className="inline-flex items-center gap-1 h-6 pl-1 pr-1.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-200 hover:text-white">
                      <span className="px-1 rounded bg-sky-500 text-black text-[9px] font-bold" style={MONO}>{i + 1}</span>{m.name}
                    </button>
                  ))}
                  {!loop && !active.markers.length && <span className="text-zinc-500">파형을 드래그하면 반복 구간, M 키로 마커를 추가해요.</span>}
                  <span className="ml-auto text-zinc-500" style={MONO}>
                    원본 {srcA ? `${srcA.integrated.toFixed(1)} LUFS · LRA ${srcA.lra.toFixed(1)}` : '재는 중…'}
                    {outA && <> · 처리본 {outA.integrated.toFixed(1)} LUFS · TP {outA.truePeak.toFixed(1)}</>}
                  </span>
                </div>
              </>
            ) : (
              <EmptyDrop active={dropActive} onLibrary={() => openLibrary()} onFile={() => fileRef.current?.click()} />
            )}
          </Section>

          {tracks.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {tracks.map((t, i) => (
                <span key={t.id} className={`inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-md border text-[12px] ${t.id === activeId ? 'border-[var(--cm-brand)] bg-[var(--cm-brand)]/15 text-white' : 'border-white/10 bg-black/30 text-zinc-300'}`}>
                  <span className="text-zinc-500" style={MONO}>{i + 1}</span>
                  <button type="button" onClick={() => activate(t.id)} className="max-w-[180px] truncate">{t.meta.title || t.title}</button>
                  <button type="button" aria-label={`${t.title} 빼기`} onClick={() => { useMastering.getState().removeTrack(t.id); const nx = useMastering.getState().activeId; if (nx && t.id === activeId) activate(nx); else if (!nx) engine?.unload() }} className="text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* ── 마스터 체인 ── */}
          <Section
            title="마스터 체인"
            right={
              <div className="flex flex-wrap items-center gap-1.5">
                <select defaultValue="" onChange={e => { const u = userPresets.find(x => x.name === e.target.value); if (u) setParams(() => normalizeChain(u.params), 'preset'); e.target.value = '' }}
                  className="h-6 rounded-md bg-black/50 border border-white/10 text-[11px] text-zinc-100 px-1.5" aria-label="내 프리셋 불러오기">
                  <option value="">내 프리셋 {userPresets.length ? `(${userPresets.length})` : ''}</option>
                  {userPresets.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                </select>
                <input value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveUserPreset() }} placeholder="프리셋 이름" maxLength={30}
                  className="h-6 w-[100px] rounded-md bg-black/50 border border-white/10 px-1.5 text-[11px] text-white outline-none focus:border-[var(--cm-brand)]" aria-label="프리셋 이름" />
                <button type="button" onClick={saveUserPreset} disabled={!presetName.trim()} className="h-6 px-1.5 rounded-md text-zinc-300 hover:text-white text-[11px] disabled:opacity-40">저장</button>
                {userPresets.length > 0 && (
                  <button type="button" onClick={() => { const n = window.prompt('지울 프리셋 이름'); if (n) { const l = userPresets.filter(p => p.name !== n); setUserPresets(l); writeLS(LS_PRESETS, l) } }} className="h-6 px-1 text-zinc-500 hover:text-white" aria-label="내 프리셋 지우기"><Trash2 className="w-3 h-3" /></button>
                )}
                <button type="button" onClick={() => exportPresetFile(presetName.trim() || '내 마스터링 체인')} className="h-6 px-1.5 rounded-md text-zinc-300 hover:text-white inline-flex items-center gap-1 text-[11px]" title="지금 체인을 JSON 파일로 — 다른 사람과 나눠요"><FileDown className="w-3 h-3" /> 공유 파일</button>
                <button type="button" onClick={() => presetFileRef.current?.click()} className="h-6 px-1.5 rounded-md text-zinc-300 hover:text-white inline-flex items-center gap-1 text-[11px]"><FileUp className="w-3 h-3" /> 가져오기</button>
                <input ref={presetFileRef} type="file" accept="application/json,.json" hidden onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = ''
                  if (!f) return
                  const r = await importPresetFile(f)
                  if (r) { const l = [...userPresets.filter(p => p.name !== r.name), r]; setUserPresets(l); writeLS(LS_PRESETS, l) }
                }} />
                <button type="button" onClick={() => setParams(() => ({ ...defaultChain(), limiter: { ...defaultChain().limiter, ceiling: target.tp } }), 'reset')} className="h-6 px-1.5 rounded-md text-zinc-400 hover:text-white inline-flex items-center gap-1 text-[11px]" title="체인을 기본값으로">
                  <RotateCcw className="w-3 h-3" /> 초기화
                </button>
              </div>
            }
          >
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
              {params.order.map((s, i) => (
                <div
                  key={s}
                  draggable
                  onDragStart={e => { setDragSlot(s); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => { if (dragSlot) e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); dropSlot(s); setDragSlot(null) }}
                  onDragEnd={() => setDragSlot(null)}
                  onClick={() => setSelectedSlot(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') setSelectedSlot(s) }}
                  aria-pressed={selectedSlot === s}
                  aria-label={`${SLOT_LABEL[s]} 슬롯 열기`}
                  className={`relative rounded-md border px-2 py-1.5 cursor-pointer select-none transition-colors ${selectedSlot === s ? 'border-[var(--cm-brand)] bg-[var(--cm-brand)]/10' : 'border-white/10 bg-black/30 hover:border-white/25'} ${dragSlot === s ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-zinc-500" style={MONO}>{i + 1}</span>
                    <span className={`text-[12px] font-semibold truncate ${slotOn(s) ? 'text-white' : 'text-zinc-500'}`}>{SLOT_LABEL[s]}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); toggleSlot(s) }}
                      aria-label={slotOn(s) ? `${SLOT_LABEL[s]} 끄기` : `${SLOT_LABEL[s]} 켜기`}
                      aria-pressed={slotOn(s)}
                      className={`ml-auto w-5 h-5 shrink-0 rounded inline-flex items-center justify-center ${slotOn(s) ? 'text-[var(--cm-brand)]' : 'text-zinc-600'}`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5" style={MONO}>{slotSummary(s, params)}</div>
                  <div className="flex justify-between mt-1">
                    <button type="button" aria-label={`${SLOT_LABEL[s]} 앞으로`} onClick={e => { e.stopPropagation(); moveSlot(s, -1) }} disabled={i === 0} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label={`${SLOT_LABEL[s]} 뒤로`} onClick={e => { e.stopPropagation(); moveSlot(s, 1) }} disabled={i === params.order.length - 1} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            {!anyProcessing && <p className="mt-2 text-[11px] text-amber-300/80">모든 슬롯이 꺼져 있어 원본 그대로 나가요.</p>}
          </Section>

          {/* ── 플러그인 창 ── */}
          {engine && (
            <section className="rounded-lg border border-white/[0.1] bg-gradient-to-b from-[#181818] to-[#111] overflow-hidden">
              <header className="flex items-center gap-2 px-3 h-9 border-b border-white/[0.07] bg-black/30">
                <span className="text-[12px] font-bold text-white">{SLOT_LABEL[selectedSlot]}</span>
                <Led on={slotOn(selectedSlot)} onClick={() => toggleSlot(selectedSlot)} label={slotOn(selectedSlot) ? '켜짐' : '꺼짐'} />
                <span className="ml-auto text-[10px] text-zinc-500 hidden md:inline">드래그 · Shift 미세 · 더블클릭 기본값 · 값 클릭해 입력</span>
              </header>
              <div className={`p-3 ${slotOn(selectedSlot) ? '' : 'opacity-60'}`}>
                <PluginPanel slot={selectedSlot} p={params} set={fn => setParams(fn, `slot:${selectedSlot}`)} engine={engine} />
              </div>
            </section>
          )}

          <AutoNotes />

          {/* ── 아래 탭 ── */}
          <section className="rounded-lg border border-white/[0.08] bg-[#121212]">
            <div role="tablist" className="flex flex-wrap gap-1 px-2 pt-2 border-b border-white/[0.07]">
              {TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`h-8 px-3 rounded-t-md text-[12px] font-semibold ${tab === t.id ? 'bg-white/10 text-white border-b-2 border-[var(--cm-brand)]' : 'text-zinc-400 hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-3">
              {tab === 'templates' && <TemplatesPanel />}
              {tab === 'analysis' && <AnalysisPanel />}
              {tab === 'reference' && <ReferencePanel onPickLibrary={cb => openLibrary(cb)} />}
              {tab === 'edit' && <EditPanel autoTarget={autoTarget} setAutoTarget={setAutoTarget} />}
              {tab === 'album' && <AlbumPanel />}
              {tab === 'stems' && <StemsPanel />}
              {tab === 'export' && <ExportPanel />}
            </div>
          </section>
        </div>

        {engine && (
          <aside className="lg:sticky lg:top-2">
            <MeterColumn engine={engine} targetLufs={target.lufs} ceiling={params.limiter.ceiling} playing={playing} />
          </aside>
        )}
      </div>

      {libraryPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="보관함에서 불러오기" onClick={() => setLibraryPick(null)}>
          <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-xl border border-white/10 bg-[#141414] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 h-12 border-b border-white/10">
              <h2 className="text-sm font-bold">보관함에서 불러오기</h2>
              <button type="button" aria-label="닫기" onClick={() => setLibraryPick(null)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {!library && <div className="p-6 text-center text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />불러오는 중</div>}
              {library?.error && <div className="p-6 text-center text-sm text-zinc-300">{library.error}</div>}
              {library && !library.error && library.songs.length === 0 && <div className="p-6 text-center text-sm text-zinc-400">보관함에 곡이 없어요.</div>}
              {library?.songs.map(s => (
                <button key={s.id} type="button" onClick={() => { const cb = libraryPick; setLibraryPick(null); cb(s) }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt="" className="w-10 h-10 rounded-md object-cover bg-black" />
                  ) : <div className="w-10 h-10 rounded-md bg-white/5" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{s.title || '제목 없음'}</div>
                    {s.genre && <div className="text-[11px] text-zinc-500 truncate">{s.genre}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TBtn({ children, label, onClick, disabled, active }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={active}
      className={`w-9 h-9 rounded-md inline-flex items-center justify-center border transition-colors disabled:opacity-30 ${active ? 'bg-[var(--cm-brand)] border-[var(--cm-brand)] text-white' : 'bg-black/40 border-white/10 text-zinc-200 hover:bg-white/10'}`}>
      {children}
    </button>
  )
}

function EmptyDrop({ active, onLibrary, onFile }: { active: boolean; onLibrary: () => void; onFile: () => void }) {
  return (
    <div className={`h-[150px] rounded-md border border-dashed flex flex-col items-center justify-center gap-3 text-center ${active ? 'border-[var(--cm-brand)] bg-[var(--cm-brand)]/10' : 'border-white/15 bg-black/30'}`}>
      <p className="text-sm text-zinc-300">마스터링할 곡을 고르거나 파일을 여기에 끌어다 놓으세요</p>
      <div className="flex gap-2">
        <button type="button" onClick={onLibrary} className="h-8 px-3 rounded-md bg-[var(--cm-brand)] text-white text-[12px] font-semibold inline-flex items-center gap-1.5"><Library className="w-3.5 h-3.5" /> 보관함</button>
        <button type="button" onClick={onFile} className="h-8 px-3 rounded-md border border-white/15 bg-black/40 text-[12px] font-semibold inline-flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> 파일 열기</button>
      </div>
      <p className="text-[11px] text-zinc-500">WAV · MP3 · FLAC · 최대 20곡</p>
    </div>
  )
}
