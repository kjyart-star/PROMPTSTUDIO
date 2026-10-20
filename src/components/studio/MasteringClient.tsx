'use client'

/**
 * 쿠키뮤직 스튜디오 「마스터링」.
 *
 * 처리는 모두 브라우저에서 한다(서버 비용 없음):
 *  - 재생: <audio>/스템 → AudioWorklet 마스터 체인(src/lib/mastering/dsp.ts) → 미터·스피커
 *  - 내보내기: 같은 체인을 청크 단위 오프라인 렌더 → WAV(16/24/32f, 디더)·MP3, 태그, ZIP
 *  - 보관함 저장: 결과만 tracks 버킷에 올리고 새 곡으로 기록(원곡은 그대로)
 * 한 화면에서 단계적으로 펼친다: 기본은 초보 흐름(스타일 → 자동 적용 → 노브 → 비교 → 내보내기),
 * 「전문 설정」을 펼치면 같은 화면에 체인 14 모듈·도구·전체 미터가 나온다. 보기는 「마스터링」/「믹서」 두 가지.
 * 골격: 메뉴 줄 / 전송 줄 / 타임라인 / 본문 3열(왼쪽 목록 · 가운데 패널 · 오른쪽 미터) / 하단 줄.
 * 상태는 store.ts, 동작은 actions.ts.
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { X, Loader2, Undo2, Redo2, FileDown, FileUp, Library, FolderOpen, SlidersHorizontal, AudioWaveform, SlidersVertical, ChevronDown, ChevronRight } from 'lucide-react'
import type { AutoTarget, ChainParams } from '@/lib/mastering/dsp'
import { fmtClock } from './mastering/Timeline'
import { useMastering, readChainLS, normalizeChain, type LibrarySong } from './mastering/store'
import {
  useUi, getEngine, cancelRef, addFiles, addLibrarySong, fetchLibrary, saveSession, loadSessionFile, exportPresetFile, importPresetFile, activate,
} from './mastering/actions'
import { TransportBar, TimelineStrip, WarningsBar, BottomBar, EasyMeters, type ViewCtx } from './mastering/Shell'
import { StyleList, StyleCenter } from './mastering/StylePanel'
import { ChainList, ToolList, ToolPanel, StatusLine, TOOLS, type CenterView } from './mastering/ChainList'
import { ModulePanel } from './mastering/ModulePanel'
import { MeterColumn } from './mastering/Meters'
import { MODULE_LABEL } from './mastering/labels'
import { MixerView } from './mastering/MixerView'
import { HelpButton } from './mastering/HelpPanel'
import { Tour } from './mastering/Tour'
import './mastering/mastering.css'

const LS_PRESETS = 'cm.mastering.userPresets.v1'
const LS_TARGET = 'cm.mastering.target.v2'
const LS_MODE = 'cm.mastering.mode.v1'
const LS_VIEW = 'cm.mastering.view.v1'
const noopSubscribe = () => () => {}
const readLS = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
const writeLS = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export function MasteringClient() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const engine = hydrated ? getEngine() : null
  const params = useMastering(s => s.params)
  const setParams = useMastering(s => s.setParams)
  const tracks = useMastering(s => s.tracks)
  const active = useMastering(s => s.tracks.find(t => t.id === s.activeId) ?? null)
  const target = useMastering(s => s.target)
  const reference = useMastering(s => s.reference)
  const srcA = useMastering(s => (s.activeId ? s.srcAnalysis[s.activeId] : undefined))
  const outA = useMastering(s => (s.activeId ? s.outAnalysis[s.activeId] : undefined))
  const canUndo = useMastering(s => s.past.length > 0)
  const canRedo = useMastering(s => s.future.length > 0)
  const busy = useUi(s => s.busy)
  const notice = useUi(s => s.notice)
  const setUi = useUi(s => s.set)

  /** 전문 설정 펼침 — 저장값 'pro' 면 펼침, 그 밖('simple'·이상값)은 접힘 */
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'master' | 'mixer'>('master')
  const [center, setCenter] = useState<CenterView>({ kind: 'style' })
  const [lastPanel, setLastPanel] = useState<CenterView | null>(null)
  const [autoTarget, setAutoTarget] = useState<AutoTarget | null>(null)
  const [mono, setMono] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [compare, setCompare] = useState<'a' | 'b' | 'r'>('b')
  const [duration, setDuration] = useState(0)
  const [matchAB, setMatchAB] = useState(true)
  const [monitorDb, setMonitorDb] = useState(0)
  const [muted, setMuted] = useState(false)
  const [library, setLibrary] = useState<{ songs: LibrarySong[]; error?: string } | null>(null)
  const [libraryPick, setLibraryPick] = useState<null | ((s: LibrarySong) => void)>(null)
  const [userPresets, setUserPresets] = useState<{ name: string; params: ChainParams }[]>([])
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
    setExpanded(readLS<unknown>(LS_MODE, 'simple') === 'pro')
    setView(readLS<unknown>(LS_VIEW, 'master') === 'mixer' ? 'mixer' : 'master')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next); writeLS(LS_MODE, next ? 'pro' : 'simple')
    if (!next) setCenter({ kind: 'style' })
  }
  const changeView = (v: 'master' | 'mixer') => { setView(v); writeLS(LS_VIEW, v) }
  const openCenter = (v: CenterView) => { setCenter(v); if (v.kind !== 'style') setLastPanel(v) }

  // ── 엔진 동기화 ──
  useEffect(() => { engine?.setParams(params) }, [engine, params])
  useEffect(() => { if (active) engine?.setEdit(active.edit) }, [engine, active])
  useEffect(() => { engine?.setMonitor(monitorDb, muted, mono) }, [engine, monitorDb, muted, mono])
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
      if (!useMastering.getState().reference) { setUi({ notice: { kind: 'info', text: '레퍼런스 탭에서 레퍼런스 곡을 먼저 불러오세요.' } }); setCompare('b'); return }
      await engine.setListenRef(true)
      return
    }
    await engine.setListenRef(false)
    let trim = 0
    if (m === 'a' && matchAB) {
      const mm = engine.meters
      if (mm && Number.isFinite(mm.integrated) && Number.isFinite(mm.inIntegrated)) trim = mm.integrated - mm.inIntegrated
      else if (outA && srcA) trim = outA.integrated - srcA.integrated
      else if (srcA) trim = useMastering.getState().target.lufs - srcA.integrated
    }
    useMastering.setState(s => ({ params: { ...s.params, listenOriginal: m === 'a', originalTrim: Math.max(-24, Math.min(24, trim)) } }))
  }, [engine, matchAB, outA, srcA, setUi])

  // ── 전송 ──
  const togglePlay = useCallback(async () => {
    if (!engine || !useMastering.getState().activeId) return
    if (!engine.playingAnything) {
      const { loop: lp, loopOn: lo } = useUi.getState()
      if (!engine.listenRef && lo && lp && (engine.currentTime < lp.start || engine.currentTime >= lp.end)) engine.seek(lp.start)
      try { await engine.play() } catch (e) { console.error(e); setUi({ notice: { kind: 'err', text: engine.error ?? '재생을 시작하지 못했어요.' } }) }
    } else engine.pause()
  }, [engine, setUi])

  const stop = useCallback(() => {
    if (!engine) return
    engine.pause()
    const { loop: lp, loopOn: lo } = useUi.getState()
    const a = useMastering.getState().tracks.find(t => t.id === useMastering.getState().activeId)
    engine.seek(lo && lp ? lp.start : a?.edit.start ?? 0)
  }, [engine])

  const addMarker = useCallback(() => {
    const id = useMastering.getState().activeId
    if (!engine || !id) return
    const t = engine.currentTime
    useMastering.getState().updateTrack(id, x => ({ ...x, markers: [...x.markers, { id: crypto.randomUUID(), time: t, name: `마커 ${x.markers.length + 1}` }].sort((a, b) => a.time - b.time) }), 'markers')
  }, [engine])

  // 키보드: Space 재생 · M 마커 · L 반복 · Enter 처음으로 · Cmd/Ctrl+Z 실행 취소 · Shift+Cmd/Ctrl+Z 다시 실행
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) useMastering.getState().redo(); else useMastering.getState().undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); useMastering.getState().redo(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'm' || e.key === 'M') addMarker()
      else if (e.key === 'l' || e.key === 'L') setUi({ loopOn: !useUi.getState().loopOn })
      else if (e.key === 'Enter' && !(el && el.tagName === 'BUTTON')) stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, addMarker, stop, setUi])

  // ── 보관함 창 ──
  const openLibrary = async (pick?: (s: LibrarySong) => void) => {
    setLibraryPick(() => pick ?? ((s: LibrarySong) => addLibrarySong(s)))
    if (!library || library.error) setLibrary(await fetchLibrary())
  }

  const savePreset = () => {
    const name = window.prompt('프리셋 이름')?.trim()
    if (!name) return
    const list = [...userPresets.filter(p => p.name !== name), { name, params: { ...params, listenOriginal: false, originalTrim: 0 } }]
    setUserPresets(list); writeLS(LS_PRESETS, list)
    setUi({ notice: { kind: 'ok', text: `「${name}」 프리셋을 저장했어요.` } })
  }

  if (!engine) return <div className="ms h-[480px]" />

  const viewCtx: ViewCtx = {
    engine, playing, compare, setListenMode, togglePlay, stop, addMarker,
    openLibrary: () => openLibrary(), openFile: () => fileRef.current?.click(), openReferencePicker: cb => openLibrary(cb),
    duration: duration || srcA?.duration || 0,
    matchAB, setMatchAB: v => { setMatchAB(v); if (compare === 'a') setTimeout(() => setListenMode('a'), 0) },
    monitorDb, setMonitorDb, muted, setMuted, mono, setMono, autoTarget, setAutoTarget, expanded,
  }
  const panelName = (v: CenterView | null) => (!v ? '' : v.kind === 'slot' ? MODULE_LABEL[v.slot] : v.kind === 'tool' ? TOOLS.find(t => t.id === v.tool)!.label : '')

  return (
    <div
      className="ms w-full flex flex-col"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true) } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDropActive(false) }}
      onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropActive(false); addFiles(Array.from(e.dataTransfer.files)) } }}
      style={dropActive ? { outline: '2px dashed var(--m-green)', outlineOffset: -2 } : undefined}
    >
      {/* 메뉴 줄 */}
      <div className="ms-menubar">
        <div className="ms-viewtabs" role="tablist" aria-label="보기">
          <button type="button" role="tab" aria-selected={view === 'master'} onClick={() => changeView('master')}><AudioWaveform className="w-4 h-4" /> 마스터링</button>
          <button type="button" role="tab" aria-selected={view === 'mixer'} onClick={() => changeView('mixer')}><SlidersVertical className="w-4 h-4" /> 믹서</button>
        </div>
        <button type="button" className="ms-protoggle" aria-pressed={expanded} onClick={toggleExpanded} title="체인 14 모듈·도구·전체 미터를 같은 화면에 펼쳐요">
          <SlidersHorizontal className="w-3.5 h-3.5" /> 전문 설정
        </button>
        <span className="w-1" />
        <button type="button" className="ms-menubtn inline-flex items-center gap-1" onClick={() => openLibrary()}><Library className="w-3.5 h-3.5" /> 보관함</button>
        <button type="button" className="ms-menubtn inline-flex items-center gap-1" onClick={() => fileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> 파일</button>
        {expanded && (
          <>
            <button type="button" className="ms-menubtn inline-flex items-center gap-1" onClick={() => sessionRef.current?.click()}><FileUp className="w-3.5 h-3.5" /> 세션 열기</button>
            <button type="button" className="ms-menubtn inline-flex items-center gap-1" onClick={saveSession} disabled={!tracks.length || !!busy}><FileDown className="w-3.5 h-3.5" /> 세션 저장</button>
            <select defaultValue="" className="ms-select" aria-label="내 프리셋"
              onChange={e => { const v = e.target.value; e.target.value = ''; if (v === '__save') savePreset(); else if (v === '__export') exportPresetFile('내 마스터링 체인'); else if (v === '__import') presetFileRef.current?.click(); else { const u = userPresets.find(x => x.name === v); if (u) setParams(() => normalizeChain(u.params), 'preset') } }}>
              <option value="">프리셋…</option>
              {userPresets.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              <option value="__save">지금 체인을 프리셋으로 저장</option>
              <option value="__export">공유 파일(JSON)로 내보내기</option>
              <option value="__import">공유 파일 가져오기</option>
            </select>
            <button type="button" className="ms-menubtn" onClick={() => useMastering.getState().undo()} disabled={!canUndo} aria-label="실행 취소 (⌘/Ctrl+Z)" title="실행 취소 (⌘/Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
            <button type="button" className="ms-menubtn" onClick={() => useMastering.getState().redo()} disabled={!canRedo} aria-label="다시 실행 (⇧⌘/Ctrl+Z)" title="다시 실행 (⇧⌘/Ctrl+Z)"><Redo2 className="w-3.5 h-3.5" /></button>
          </>
        )}
        <span className="ml-auto min-w-0 max-w-[40%] flex items-center">
          {tracks.length > 1 ? (
            <select className="ms-select max-w-full" aria-label="곡 고르기" value={active?.id ?? ''} onChange={e => activate(e.target.value)}>
              {tracks.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.meta.title || t.title}</option>)}
            </select>
          ) : <span className="dim truncate">{active ? active.meta.title || active.title : '곡 없음'}</span>}
        </span>
        <HelpButton />
        <Tour expanded={expanded} />
        <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a" multiple hidden onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }} />
        <input ref={sessionRef} type="file" accept=".cmmaster,.zip" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadSessionFile(f); e.target.value = '' }} />
        <input ref={presetFileRef} type="file" accept="application/json,.json" hidden onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          const r = await importPresetFile(f)
          if (r) { const l = [...userPresets.filter(p => p.name !== r.name), r]; setUserPresets(l); writeLS(LS_PRESETS, l) }
        }} />
      </div>

      {(notice || busy) && (
        <div className="flex flex-col gap-1 px-2 pt-2">
          {notice && (
            <div role="status" className="flex items-start gap-2 rounded-lg border px-3 py-1.5 text-[12px]"
              style={{ borderColor: notice.kind === 'err' ? 'var(--m-red)' : notice.kind === 'ok' ? 'var(--m-green-dim)' : 'var(--m-line)', background: 'var(--m-panel)' }}>
              <span className="flex-1">{notice.text}</span>
              <button type="button" aria-label="알림 닫기" onClick={() => setUi({ notice: null })} className="dim hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--m-line)] bg-[var(--m-panel)] px-3 py-1.5 text-[12px]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--m-green)]" />
              <span>{busy.label}</span>
              <div className="flex-1 h-1.5 rounded bg-[var(--m-well)] overflow-hidden min-w-[80px]">
                <div className="h-full bg-[var(--m-green)] transition-[width]" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
              </div>
              <span className="mono dim">{Math.round(busy.progress * 100)}%</span>
              <button type="button" onClick={() => { cancelRef.cancelled = true }} className="dim hover:text-white">멈추기</button>
            </div>
          )}
        </div>
      )}

      <TransportBar ctx={viewCtx} counterRef={counterRef} />
      <TimelineStrip ctx={viewCtx} />

      {view === 'mixer' ? (
        <div className="ms-mixerwrap"><MixerView /></div>
      ) : (
        <div className="ms-body">
          {/* 왼쪽: 스타일 · (펼침) 체인 · 도구 */}
          <aside className="ms-left">
            <StyleList expanded={expanded} ctx={viewCtx} />
            <button type="button" className="ms-fold strong" aria-expanded={expanded} onClick={toggleExpanded}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {expanded ? '전문 설정 접기' : '전문 설정 펼치기(체인 보기)'}
            </button>
            {expanded && (
              <>
                <ChainList engine={engine} view={center} onOpen={openCenter} />
                <ToolList view={center} onOpen={openCenter} />
              </>
            )}
          </aside>

          {/* 가운데 */}
          <main className="ms-center">
            {(expanded || center.kind !== 'style') && (
              <nav className="ms-crumbs" role="tablist" aria-label="가운데 패널">
                <button type="button" role="tab" aria-selected={center.kind === 'style'} onClick={() => setCenter({ kind: 'style' })}>스타일 · 자동</button>
                {lastPanel && (
                  <button type="button" role="tab" aria-selected={center.kind !== 'style'} onClick={() => setCenter(lastPanel)}>{panelName(lastPanel)}</button>
                )}
              </nav>
            )}
            <WarningsBar engine={engine} />
            {center.kind === 'style' && <StyleCenter ctx={viewCtx} />}
            {center.kind === 'slot' && <ModulePanel slot={center.slot} p={params} set={fn => setParams(fn, `slot:${center.slot}`)} engine={engine} />}
            {center.kind === 'tool' && <ToolPanel tool={center.tool} ctx={viewCtx} />}
          </main>

          {/* 오른쪽: 미터 */}
          <aside className="ms-right">
            {expanded
              ? <MeterColumn engine={engine} targetLufs={target.lufs} ceiling={params.limiter.ceiling} playing={playing} />
              : <EasyMeters engine={engine} />}
          </aside>
        </div>
      )}

      <BottomBar expanded={expanded} />
      {expanded && <StatusLine engine={engine} />}

      {libraryPick && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="보관함에서 불러오기" onClick={() => setLibraryPick(null)}>
          <div className="ms w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl rounded-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--m-line-soft)]">
              <h2 className="text-[14px] font-bold">보관함에서 불러오기</h2>
              <button type="button" aria-label="닫기" onClick={() => setLibraryPick(null)} className="dim hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
              {!library && <div className="p-6 text-center dim"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />불러오는 중</div>}
              {library?.error && <div className="p-6 text-center">{library.error}</div>}
              {library && !library.error && library.songs.length === 0 && <div className="p-6 text-center dim">보관함에 곡이 없어요.</div>}
              {library?.songs.map(s => (
                <button key={s.id} type="button" onClick={() => { const cb = libraryPick; setLibraryPick(null); cb(s) }} className="w-full flex items-center gap-3 p-2 rounded hover:bg-[var(--m-panel-2)] text-left">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt="" className="w-10 h-10 rounded object-cover bg-black" />
                  ) : <div className="w-10 h-10 rounded bg-[var(--m-raise)]" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{s.title || '제목 없음'}</div>
                    {s.genre && <div className="text-[11px] dim truncate">{s.genre}</div>}
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
