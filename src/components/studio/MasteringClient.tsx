'use client'

/**
 * 쿠키뮤직 스튜디오 「마스터링」.
 *
 * 처리는 모두 브라우저에서 한다(서버 비용 없음):
 *  - 재생: <audio> 스트리밍 → AudioWorklet 마스터 체인(src/lib/mastering/dsp.ts) → 미터·스피커
 *  - 내보내기: 같은 체인을 청크 단위 오프라인 렌더 → WAV(24/16bit, 디더) 또는 MP3
 *  - 보관함 저장: 결과만 tracks 버킷에 올리고 새 곡으로 기록(원곡은 그대로)
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  Play, Pause, Square, Repeat, Flag, FolderOpen, Library, Download, Save, X, Trash2,
  ChevronLeft, ChevronRight, Power, Wand2, ZoomIn, ZoomOut, Volume2, VolumeX, Loader2, RotateCcw,
} from 'lucide-react'
import { withBase } from '@/lib/basePath'
import { createClient } from '@/lib/supabase/client'
import { encodeAudioBufferToMp3 } from '@/lib/audioUtils'
import { ALL_SLOTS, type ChainParams, type SlotId } from '@/lib/mastering/dsp'
import { defaultChain, buildGenrePreset, GENRE_PRESETS, LOUDNESS_TARGETS, SLOT_LABEL } from '@/lib/mastering/presets'
import { decodeAudio, computePeaks, renderChain, autoMatchLoudness, encodeWav, type DecodedAudio } from '@/lib/mastering/render'
import { measureIntegratedLufs } from '@/lib/mastering/dsp'
import { StudioHero } from './StudioHero'
import { MasteringEngine } from './mastering/engine'
import { MeterColumn, Section } from './mastering/Meters'
import { PluginPanel, slotSummary } from './mastering/Plugins'
import { Timeline, fmtClock, type Marker, type LoopRange } from './mastering/Timeline'
import { MONO, Segmented, Led } from './mastering/controls'

interface SessionTrack {
  id: string
  title: string
  source: 'library' | 'file'
  blob: Blob
  song?: LibrarySong
}

interface LibrarySong {
  id: string
  title: string
  audio_url: string
  image_url?: string | null
  lyrics?: string | null
  prompt?: string | null
  genre?: string | null
  status?: string
}

type ExportFormat = 'wav24' | 'wav16' | 'mp3'

const MAX_TRACKS = 20
const UPLOAD_LIMIT = 50 * 1024 * 1024
const LS_CHAIN = 'cm.mastering.chain.v2'
const LS_PRESETS = 'cm.mastering.userPresets.v1'
const LS_MARKERS = 'cm.mastering.markers.v1'
const LS_TARGET = 'cm.mastering.target.v1'

const readLS = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
const writeLS = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

/** 저장해 둔 체인이 옛 모양이어도 깨지지 않게 기본값 위에 얹는다 */
function normalizeChain(saved: Partial<ChainParams> | null): ChainParams {
  const d = defaultChain()
  if (!saved || typeof saved !== 'object') return d
  const order = Array.isArray(saved.order) && saved.order.length === ALL_SLOTS.length && ALL_SLOTS.every(s => saved.order!.includes(s)) ? saved.order : d.order
  return {
    ...d, ...saved, order,
    listenOriginal: false, originalTrim: 0,
    bypass: { ...d.bypass, ...(saved.bypass ?? {}) },
    eq: { ...d.eq, ...(saved.eq ?? {}) },
    comp: { ...d.comp, ...(saved.comp ?? {}) },
    multiband: { ...d.multiband, ...(saved.multiband ?? {}), bands: (saved.multiband?.bands?.length === 3 ? saved.multiband.bands : d.multiband.bands) },
    stereo: { ...d.stereo, ...(saved.stereo ?? {}) },
    saturation: { ...d.saturation, ...(saved.saturation ?? {}) },
    limiter: { ...d.limiter, ...(saved.limiter ?? {}) },
  }
}

const baseName = (s: string) => s.replace(/\.[^/.]+$/, '')
const safeFile = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
const tick = () => new Promise(r => setTimeout(r, 0))
const noopSubscribe = () => () => {}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 20000)
}

export function MasteringClient() {
  const engineObj = useMemo(() => (typeof window === 'undefined' ? null : new MasteringEngine()), [])
  // 서버 렌더와 첫 하이드레이션에서는 엔진 없이 그리고, 그 다음 렌더부터 엔진을 붙인다
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const engine = hydrated ? engineObj : null
  const [params, setParamsState] = useState<ChainParams>(() => defaultChain())
  const [tracks, setTracks] = useState<SessionTrack[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<SlotId>('eq')
  const [targetId, setTargetId] = useState('stream')
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const [processedPeaks, setProcessedPeaks] = useState<Float32Array | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [loop, setLoop] = useState<LoopRange | null>(null)
  const [loopOn, setLoopOn] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [matchAB, setMatchAB] = useState(true)
  const [monitorDb, setMonitorDb] = useState(0)
  const [muted, setMuted] = useState(false)
  const [busy, setBusy] = useState<{ label: string; progress: number } | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [srcLufs, setSrcLufs] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<{ integrated: number; truePeak: number } | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [library, setLibrary] = useState<LibrarySong[] | null>(null)
  const [libraryErr, setLibraryErr] = useState<string | null>(null)
  const [exportFmt, setExportFmt] = useState<ExportFormat>('wav24')
  const [exportRate, setExportRate] = useState<44100 | 48000>(44100)
  const [dither, setDither] = useState(true)
  const [exportRange, setExportRange] = useState<'all' | 'loop'>('all')
  const [userPresets, setUserPresets] = useState<{ name: string; params: ChainParams }[]>([])
  const [presetName, setPresetName] = useState('')
  const [dragSlot, setDragSlot] = useState<SlotId | null>(null)
  const [dropActive, setDropActive] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const decodedRef = useRef<{ id: string; dec: DecodedAudio } | null>(null)
  const loopRef = useRef({ loop, loopOn })
  useLayoutEffect(() => { loopRef.current = { loop, loopOn } }, [loop, loopOn])
  const cancelRef = useRef({ cancelled: false })

  const target = LOUDNESS_TARGETS.find(t => t.id === targetId) ?? LOUDNESS_TARGETS[0]
  const active = tracks.find(t => t.id === activeId) ?? null

  // ── 초기값 복원 ──
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 저장값은 마운트 뒤에만 읽을 수 있다 */
    setParamsState(normalizeChain(readLS<Partial<ChainParams> | null>(LS_CHAIN, null)))
    setUserPresets(readLS(LS_PRESETS, []))
    setTargetId(readLS(LS_TARGET, 'stream'))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const setParams = useCallback((fn: (p: ChainParams) => ChainParams) => {
    setParamsState(prev => {
      const next = fn(prev)
      writeLS(LS_CHAIN, { ...next, listenOriginal: false, originalTrim: 0 })
      return next
    })
  }, [])

  useEffect(() => { engine?.setParams(params) }, [engine, params])
  useEffect(() => { engine?.setMonitor(monitorDb, muted) }, [engine, monitorDb, muted])
  useEffect(() => {
    engine?.keepAlive()
    return () => engine?.scheduleDispose()
  }, [engine])

  // ── 오디오 요소 이벤트 + 빅 카운터·반복 구간 ──
  useEffect(() => {
    if (!engine) return
    const a = engine.audio
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onMeta = () => setDuration(a.duration || 0)
    a.addEventListener('play', onPlay); a.addEventListener('pause', onPause); a.addEventListener('ended', onPause)
    a.addEventListener('loadedmetadata', onMeta)
    let raf = 0
    const loopFn = () => {
      raf = requestAnimationFrame(loopFn)
      const { loop: lp, loopOn: lo } = loopRef.current
      if (lo && lp && lp.end - lp.start > 0.05 && !a.paused && a.currentTime >= lp.end) engine.seek(lp.start)
      if (counterRef.current) {
        const s = fmtClock(a.currentTime)
        if (counterRef.current.textContent !== s) counterRef.current.textContent = s
      }
    }
    raf = requestAnimationFrame(loopFn)
    return () => {
      cancelAnimationFrame(raf)
      a.removeEventListener('play', onPlay); a.removeEventListener('pause', onPause); a.removeEventListener('ended', onPause)
      a.removeEventListener('loadedmetadata', onMeta)
    }
  }, [engine])

  // ── 곡 디코드(파형·원본 라우드니스용) — 활성 곡 하나만 메모리에 둔다 ──
  const getDecoded = useCallback(async (t: SessionTrack, rate = 44100): Promise<DecodedAudio> => {
    const c = decodedRef.current
    if (c && c.id === t.id && c.dec.sampleRate === rate) return c.dec
    const dec = await decodeAudio(await t.blob.arrayBuffer(), rate)
    decodedRef.current = { id: t.id, dec }
    return dec
  }, [])

  const markerKey = (t: SessionTrack) => (t.song ? `song:${t.song.id}` : `file:${t.title}:${t.blob.size}`)

  const activate = useCallback(async (t: SessionTrack) => {
    if (!engine) return
    engine.pause()
    setActiveId(t.id)
    setPeaks(null); setProcessedPeaks(null); setSrcLufs(null); setAnalysis(null); setLoop(null); setLoopOn(false)
    engine.load(t.blob)
    setMarkers(readLS<Record<string, Marker[]>>(LS_MARKERS, {})[markerKey(t)] ?? [])
    try {
      const dec = await getDecoded(t)
      setPeaks(computePeaks(dec.channels, 4000))
      setDuration(dec.duration)
      await tick()
      setSrcLufs(measureIntegratedLufs(dec.channels, dec.sampleRate))
    } catch (e) {
      console.error(e)
      setNotice({ kind: 'err', text: '이 파일은 열 수 없어요. 다른 형식(WAV·MP3)으로 시도해 주세요.' })
    }
  }, [engine, getDecoded])

  const saveMarkers = (list: Marker[]) => {
    setMarkers(list)
    if (!active) return
    const all = readLS<Record<string, Marker[]>>(LS_MARKERS, {})
    all[markerKey(active)] = list
    writeLS(LS_MARKERS, all)
  }

  const addTracks = useCallback((list: SessionTrack[]) => {
    setTracks(prev => {
      const room = MAX_TRACKS - prev.length
      if (room <= 0) { setNotice({ kind: 'err', text: `한 번에 ${MAX_TRACKS}곡까지 올릴 수 있어요.` }); return prev }
      const add = list.slice(0, room)
      if (add.length < list.length) setNotice({ kind: 'info', text: `${MAX_TRACKS}곡을 넘는 ${list.length - add.length}곡은 빼고 올렸어요.` })
      if (!prev.length && add[0]) setTimeout(() => activate(add[0]), 0)
      return [...prev, ...add]
    })
  }, [activate])

  const onFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|flac|aiff?|m4a|ogg)$/i.test(f.name))
    if (!list.length) { setNotice({ kind: 'err', text: '오디오 파일만 올릴 수 있어요 (WAV·MP3 등).' }); return }
    addTracks(list.map(f => ({ id: crypto.randomUUID(), title: baseName(f.name), source: 'file' as const, blob: f })))
  }

  // ── 보관함 ──
  const openLibrary = async () => {
    setShowLibrary(true)
    if (library) return
    setLibraryErr(null)
    try {
      const r = await fetch(withBase('/api/song-history'))
      if (r.status === 401) { setLibraryErr('로그인하면 보관함 곡을 불러올 수 있어요.'); setLibrary([]); return }
      const rows = await r.json()
      setLibrary(Array.isArray(rows) ? rows.filter((s: LibrarySong) => s.audio_url && (s.status ?? 'completed') === 'completed') : [])
    } catch {
      setLibraryErr('보관함을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      setLibrary([])
    }
  }

  const loadSong = async (s: LibrarySong) => {
    setShowLibrary(false)
    setBusy({ label: `「${s.title}」 불러오는 중`, progress: 0 })
    try {
      let url = s.audio_url
      if (!/^https?:/.test(url)) {
        const r = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(url)}`))
        const j = await r.json()
        if (!r.ok || !j.signedUrl) throw new Error(j.error || 'sign')
        url = j.signedUrl
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch')
      const blob = await res.blob()
      addTracks([{ id: crypto.randomUUID(), title: s.title || '제목 없음', source: 'library', blob, song: s }])
    } catch (e) {
      console.error(e)
      setNotice({ kind: 'err', text: '곡을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' })
    } finally {
      setBusy(null)
    }
  }

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id))
    if (id === activeId) {
      engine?.pause()
      engine?.unload()
      setActiveId(null); setPeaks(null); setDuration(0)
      decodedRef.current = null
    }
  }

  // ── 전송 ──
  const togglePlay = useCallback(async () => {
    if (!engine || !active) return
    if (engine.paused) {
      const { loop: lp, loopOn: lo } = loopRef.current
      if (lo && lp && (engine.currentTime < lp.start || engine.currentTime >= lp.end)) engine.seek(lp.start)
      try { await engine.play() } catch (e) { console.error(e); setNotice({ kind: 'err', text: engine.error ?? '재생을 시작하지 못했어요.' }) }
    } else engine.pause()
  }, [engine, active])

  const stop = useCallback(() => {
    if (!engine) return
    engine.pause()
    engine.seek(loopOn && loop ? loop.start : 0)
  }, [engine, loop, loopOn])

  const seek = (t: number) => engine?.seek(t)

  const addMarker = useCallback(() => {
    if (!engine || !active) return
    const t = engine.currentTime
    const list = [...markers, { id: crypto.randomUUID(), time: t, name: `마커 ${markers.length + 1}` }].sort((a, b) => a.time - b.time)
    saveMarkers(list)
  }, [engine, active, markers]) // eslint-disable-line react-hooks/exhaustive-deps

  // A/B: 원본 듣기. 음량 맞춤이면 처리본과 같은 라우드니스로 원본을 올리거나 내린다
  const setListenOriginal = (on: boolean) => {
    let trim = 0
    if (on && matchAB) {
      const m = engine?.meters
      if (m && Number.isFinite(m.integrated) && Number.isFinite(m.inIntegrated)) trim = m.integrated - m.inIntegrated
      else if (analysis && srcLufs !== null && Number.isFinite(srcLufs)) trim = analysis.integrated - srcLufs
    }
    setParamsState(p => ({ ...p, listenOriginal: on, originalTrim: Math.max(-24, Math.min(24, trim)) }))
  }

  // 키보드: Space 재생 · M 마커 · L 반복 · Enter 처음으로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'm' || e.key === 'M') addMarker()
      else if (e.key === 'l' || e.key === 'L') setLoopOn(v => !v)
      else if (e.key === 'Enter') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, addMarker, stop])

  // ── 슬롯 순서 ──
  const moveSlot = (id: SlotId, dir: -1 | 1) => setParams(p => {
    const o = [...p.order]
    const i = o.indexOf(id), j = i + dir
    if (j < 0 || j >= o.length) return p
    ;[o[i], o[j]] = [o[j], o[i]]
    return { ...p, order: o }
  })
  const dropSlot = (onto: SlotId) => {
    if (!dragSlot || dragSlot === onto) return
    setParams(p => {
      const o = p.order.filter(s => s !== dragSlot)
      o.splice(o.indexOf(onto), 0, dragSlot)
      return { ...p, order: o }
    })
  }

  // ── 프리셋 ──
  const applyGenre = (id: string) => {
    const c = buildGenrePreset(id)
    c.limiter.ceiling = target.ceiling
    setParams(() => c)
    setAnalysis(null)
  }
  const saveUserPreset = () => {
    const name = presetName.trim()
    if (!name) return
    const list = [...userPresets.filter(p => p.name !== name), { name, params: { ...params, listenOriginal: false, originalTrim: 0 } }]
    setUserPresets(list); writeLS(LS_PRESETS, list); setPresetName('')
    setNotice({ kind: 'ok', text: `「${name}」 프리셋을 저장했어요.` })
  }
  const deleteUserPreset = (name: string) => {
    const list = userPresets.filter(p => p.name !== name)
    setUserPresets(list); writeLS(LS_PRESETS, list)
  }

  const changeTarget = (id: string) => {
    setTargetId(id); writeLS(LS_TARGET, id)
    const t = LOUDNESS_TARGETS.find(x => x.id === id)
    if (t) setParams(p => ({ ...p, limiter: { ...p.limiter, ceiling: t.ceiling } }))
  }

  // ── 자동 게인 맞춤 ──
  const autoMatch = async () => {
    if (!active) return
    setBusy({ label: '곡 전체를 재며 라우드니스를 맞추는 중', progress: 0 })
    try {
      const dec = await getDecoded(active)
      const res = await autoMatchLoudness(dec.channels, dec.sampleRate, { ...params, listenOriginal: false }, target.lufs,
        p => setBusy(b => (b ? { ...b, progress: p } : b)))
      setParams(() => ({ ...res.params, listenOriginal: params.listenOriginal, originalTrim: params.originalTrim }))
      setAnalysis({ integrated: res.integrated, truePeak: res.truePeak })
      engine?.resetMeters()
      setNotice({ kind: 'ok', text: `타깃 ${target.lufs} LUFS 에 맞췄어요 — 결과 ${res.integrated.toFixed(1)} LUFS · 트루 피크 ${res.truePeak.toFixed(1)} dBTP` })
    } catch (e) {
      console.error(e)
      setNotice({ kind: 'err', text: '라우드니스를 재지 못했어요.' })
    } finally { setBusy(null) }
  }

  // ── 내보내기 ──
  const renderOne = async (t: SessionTrack, onP: (p: number) => void) => {
    const dec = t.id === activeId && decodedRef.current?.dec.sampleRate === exportRate
      ? decodedRef.current.dec
      : await decodeAudio(await t.blob.arrayBuffer(), exportRate)
    const useLoop = exportRange === 'loop' && loop && t.id === activeId
    const res = await renderChain(dec.channels, dec.sampleRate, { ...params, listenOriginal: false }, {
      start: useLoop ? loop!.start * dec.sampleRate : 0,
      end: useLoop ? loop!.end * dec.sampleRate : undefined,
      onProgress: p => onP(p * 0.7),
      signal: cancelRef.current,
    })
    const ch = res.channels!
    let blob: Blob
    let ext: 'wav' | 'mp3'
    if (exportFmt === 'mp3') {
      const ab = new AudioBuffer({ length: ch[0].length, numberOfChannels: 2, sampleRate: dec.sampleRate })
      ab.copyToChannel(ch[0], 0); ab.copyToChannel(ch[1], 1)
      blob = await encodeAudioBufferToMp3(ab, 320, p => onP(0.7 + (p / 100) * 0.3))
      ext = 'mp3'
    } else {
      await tick()
      blob = encodeWav(ch, dec.sampleRate, exportFmt === 'wav24' ? 24 : 16, dither)
      ext = 'wav'
    }
    onP(1)
    return { blob, ext, integrated: res.integrated, truePeak: res.truePeak, channels: ch }
  }

  const exportActive = async (toLibrary: boolean) => {
    if (!active) return
    cancelRef.current = { cancelled: false }
    setBusy({ label: toLibrary ? '마스터링본 만드는 중' : '내보내는 중', progress: 0 })
    try {
      const out = await renderOne(active, p => setBusy(b => (b ? { ...b, progress: p } : b)))
      setProcessedPeaks(exportRange === 'all' ? computePeaks(out.channels, 4000) : null)
      setAnalysis({ integrated: out.integrated, truePeak: out.truePeak })
      const fname = `${safeFile(active.title)} (마스터링).${out.ext}`
      if (!toLibrary) {
        download(out.blob, fname)
        setNotice({ kind: 'ok', text: `내보냈어요 — ${out.integrated.toFixed(1)} LUFS · 트루 피크 ${out.truePeak.toFixed(1)} dBTP` })
        return
      }
      let blob = out.blob, ext = out.ext
      let note = ''
      if (blob.size > UPLOAD_LIMIT) {
        // 보관함 한 곡 용량(50MB)을 넘으면 MP3 320kbps 로 바꿔 올린다
        setBusy({ label: '용량이 커서 MP3 로 바꾸는 중', progress: 0 })
        const ab = new AudioBuffer({ length: out.channels[0].length, numberOfChannels: 2, sampleRate: exportRate })
        ab.copyToChannel(out.channels[0], 0); ab.copyToChannel(out.channels[1], 1)
        blob = await encodeAudioBufferToMp3(ab, 320, p => setBusy(b => (b ? { ...b, progress: p / 100 } : b)))
        ext = 'mp3'
        note = ' (용량이 커서 MP3 320kbps 로 저장했어요)'
      }
      setBusy({ label: '보관함에 올리는 중', progress: 0.5 })
      const r = await fetch(withBase('/api/studio/mastering-upload'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext }),
      })
      if (r.status === 401) { setNotice({ kind: 'err', text: '로그인하면 보관함에 저장할 수 있어요. 지금은 내려받기만 돼요.' }); return }
      const up = await r.json()
      if (!r.ok) throw new Error(up.error)
      const supabase = createClient()
      const { error } = await supabase.storage.from('tracks').uploadToSignedUrl(up.path, up.token, blob, { contentType: up.contentType })
      if (error) throw error
      const s = active.song
      const save = await fetch(withBase('/api/song-history'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${active.title} (마스터링)`,
          prompt: s?.prompt ?? '',
          lyrics: s?.lyrics ?? '',
          genre: s?.genre ?? '',
          image_url: s?.image_url ?? '',
          audio_url: up.path,
          status: 'completed',
          is_published: false,
          notes: `마스터링본 · ${out.integrated.toFixed(1)} LUFS · ${out.truePeak.toFixed(1)} dBTP`,
          form: { kind: 'mastering', source_id: s?.id ?? null, target_lufs: target.lufs },
        }),
      })
      if (!save.ok) throw new Error('save')
      setLibrary(null)
      setNotice({ kind: 'ok', text: `보관함에 「${active.title} (마스터링)」을 새 곡으로 저장했어요${note}. 원곡은 그대로 있어요.` })
    } catch (e) {
      if ((e as Error).message === 'cancelled') setNotice({ kind: 'info', text: '내보내기를 멈췄어요.' })
      else { console.error(e); setNotice({ kind: 'err', text: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }) }
    } finally { setBusy(null) }
  }

  const exportAll = async () => {
    if (!tracks.length) return
    cancelRef.current = { cancelled: false }
    try {
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]
        setBusy({ label: `${i + 1}/${tracks.length} 「${t.title}」 내보내는 중`, progress: 0 })
        const out = await renderOne(t, p => setBusy(b => (b ? { ...b, progress: p } : b)))
        download(out.blob, `${safeFile(t.title)} (마스터링).${out.ext}`)
      }
      setNotice({ kind: 'ok', text: `${tracks.length}곡을 같은 체인으로 내보냈어요.` })
    } catch (e) {
      if ((e as Error).message === 'cancelled') setNotice({ kind: 'info', text: '내보내기를 멈췄어요.' })
      else { console.error(e); setNotice({ kind: 'err', text: '내보내다 문제가 생겼어요.' }) }
    } finally { setBusy(null) }
  }

  const slotOn = (s: SlotId) => !params.bypass[s]
  const anyProcessing = ALL_SLOTS.some(s => slotOn(s))

  return (
    <div
      className="w-full pb-10 text-white flex flex-col gap-3"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true) } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDropActive(false) }}
      onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropActive(false); onFiles(e.dataTransfer.files) } }}
    >
      <StudioHero
        badge={<><Volume2 className="w-3.5 h-3.5" /><span>마스터링 스튜디오</span></>}
        title={<>곡을 <span className="text-primary">발매 음량</span>까지</>}
        desc="EQ·컴프·리미터를 걸고 라우드니스를 맞춘 뒤 WAV·MP3 로 내보내거나 보관함에 새 곡으로 저장해요."
        bg="/studio/hero-console.webp"
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openLibrary} className="h-9 px-3 rounded-lg bg-[var(--cm-brand)] text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:brightness-110">
            <Library className="w-4 h-4" /> 보관함에서 불러오기
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-white/15 bg-black/40 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/10">
            <FolderOpen className="w-4 h-4" /> 파일 열기
          </button>
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.flac,.aif,.aiff,.m4a" multiple hidden onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = '' }} />
        </div>
      </StudioHero>

      {notice && (
        <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${notice.kind === 'err' ? 'border-red-500/40 bg-red-500/10 text-red-200' : notice.kind === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-white/15 bg-white/5 text-zinc-200'}`}>
          <span className="flex-1">{notice.text}</span>
          <button type="button" aria-label="닫기" onClick={() => setNotice(null)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── 상단 전송 바 ── */}
      <div className="rounded-lg border border-white/[0.08] bg-[#121212] px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <TBtn label={playing ? '일시정지 (Space)' : '재생 (Space)'} onClick={togglePlay} disabled={!active} active={playing}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </TBtn>
          <TBtn label="정지 · 처음으로 (Enter)" onClick={stop} disabled={!active}><Square className="w-3.5 h-3.5" /></TBtn>
          <TBtn label="구간 반복 (L)" onClick={() => setLoopOn(v => !v)} disabled={!active} active={loopOn}><Repeat className="w-4 h-4" /></TBtn>
          <TBtn label="마커 추가 (M)" onClick={addMarker} disabled={!active}><Flag className="w-4 h-4" /></TBtn>
        </div>
        <div className="rounded-md bg-black/70 border border-white/10 px-3 h-10 flex items-center" aria-label="재생 위치">
          <span ref={counterRef} className="text-[24px] leading-none text-emerald-300 tracking-tight" style={MONO}>00:00.000</span>
          <span className="ml-2 text-[10px] text-zinc-500" style={MONO}>/ {fmtClock(duration)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">비교</span>
          <Segmented
            value={params.listenOriginal ? 'a' : 'b'}
            onChange={v => setListenOriginal(v === 'a')}
            options={[{ value: 'a', label: 'A 원본' }, { value: 'b', label: 'B 처리본' }]}
          />
          <Led on={matchAB} onClick={() => { setMatchAB(v => !v); if (params.listenOriginal) setTimeout(() => setListenOriginal(true), 0) }} label="음량 맞춤" title="원본을 처리본과 같은 라우드니스로 맞춰 들려줘요 — 큰 소리에 속지 않게" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400">타깃</span>
          <select
            value={targetId}
            onChange={e => changeTarget(e.target.value)}
            className="h-7 rounded-md bg-black/50 border border-white/10 text-[12px] text-zinc-100 px-2"
            aria-label="타깃 라우드니스"
          >
            {LOUDNESS_TARGETS.map(t => <option key={t.id} value={t.id}>{t.label} {t.lufs} LUFS</option>)}
          </select>
          <button type="button" onClick={autoMatch} disabled={!active || !!busy}
            className="h-7 px-2.5 rounded-md bg-[var(--cm-brand)] text-white text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-40 hover:brightness-110"
            title="곡 전체를 재서 리미터 게인을 타깃 라우드니스에 맞춰요">
            <Wand2 className="w-3.5 h-3.5" /> 자동 맞춤
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button type="button" onClick={() => setMuted(v => !v)} aria-label={muted ? '소리 켜기' : '소리 끄기'} className="text-zinc-400 hover:text-white">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={-40} max={6} step={0.5} value={monitorDb} onChange={e => setMonitorDb(Number(e.target.value))}
            aria-label="모니터 볼륨" className="w-24 accent-[var(--cm-brand)]" title="듣는 볼륨만 바꿔요 — 내보내는 소리에는 영향 없음" />
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
          <button type="button" onClick={() => { cancelRef.current.cancelled = true }} className="text-[12px] text-zinc-400 hover:text-white">멈추기</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_208px] xl:grid-cols-[minmax(0,1fr)_236px] gap-3 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {/* ── 파형 / 타임라인 ── */}
          <Section
            title={active ? active.title : '곡'}
            right={
              <div className="flex items-center gap-1">
                <button type="button" aria-label="축소" onClick={() => setZoom(z => Math.max(1, z / 2))} disabled={zoom <= 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="text-[10px] text-zinc-500 w-6 text-center" style={MONO}>{zoom}x</span>
                <button type="button" aria-label="확대" onClick={() => setZoom(z => Math.min(32, z * 2))} disabled={!active} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ZoomIn className="w-3.5 h-3.5" /></button>
              </div>
            }
          >
            {active && engine ? (
              <>
                <Timeline
                  peaks={peaks} processedPeaks={processedPeaks} duration={duration} audio={engine.audio}
                  markers={markers} loop={loop} loopOn={loopOn} zoom={zoom}
                  onSeek={seek} onLoop={r => { setLoop(r); if (r) setLoopOn(true) }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {loop && (
                    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-200" style={MONO}>
                      반복 {fmtClock(loop.start)} – {fmtClock(loop.end)}
                      <button type="button" aria-label="반복 구간 지우기" onClick={() => { setLoop(null); setLoopOn(false) }} className="ml-1 hover:text-white"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {markers.map((m, i) => (
                    <span key={m.id} className="inline-flex items-center gap-1 h-6 pl-1 pr-1.5 rounded-md bg-sky-500/10 border border-sky-500/30">
                      <button type="button" onClick={() => seek(m.time)} className="inline-flex items-center gap-1 text-sky-200 hover:text-white">
                        <span className="px-1 rounded bg-sky-500 text-black text-[9px] font-bold" style={MONO}>{i + 1}</span>
                        <input
                          value={m.name}
                          onChange={e => saveMarkers(markers.map(x => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent outline-none w-[72px] text-sky-100"
                          aria-label={`마커 ${i + 1} 이름`}
                        />
                        <span className="text-zinc-400" style={MONO}>{fmtClock(m.time)}</span>
                      </button>
                      <button type="button" aria-label="마커 지우기" onClick={() => saveMarkers(markers.filter(x => x.id !== m.id))} className="text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {!loop && !markers.length && <span className="text-zinc-500">파형을 드래그하면 반복 구간, M 키로 마커를 추가해요.</span>}
                  <span className="ml-auto text-zinc-500" style={MONO}>
                    원본 {srcLufs === null ? '재는 중…' : Number.isFinite(srcLufs) ? `${srcLufs.toFixed(1)} LUFS` : '-∞'}
                    {analysis && <> · 처리본 {analysis.integrated.toFixed(1)} LUFS · TP {analysis.truePeak.toFixed(1)}</>}
                  </span>
                </div>
              </>
            ) : (
              <EmptyDrop active={dropActive} onLibrary={openLibrary} onFile={() => fileRef.current?.click()} />
            )}
          </Section>

          {tracks.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {tracks.map(t => (
                <span key={t.id} className={`inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-md border text-[12px] ${t.id === activeId ? 'border-[var(--cm-brand)] bg-[var(--cm-brand)]/15 text-white' : 'border-white/10 bg-black/30 text-zinc-300'}`}>
                  <button type="button" onClick={() => activate(t)} className="max-w-[180px] truncate">{t.title}</button>
                  <button type="button" aria-label={`${t.title} 빼기`} onClick={() => removeTrack(t.id)} className="text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* ── 마스터 체인 ── */}
          <Section
            title="마스터 체인"
            right={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">장르</span>
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) applyGenre(e.target.value); e.target.value = '' }}
                  className="h-6 rounded-md bg-black/50 border border-white/10 text-[11px] text-zinc-100 px-1.5"
                  aria-label="장르 프리셋"
                >
                  <option value="">프리셋 고르기</option>
                  {GENRE_PRESETS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
                <button type="button" onClick={() => applyGenre('default')} className="h-6 px-1.5 rounded-md text-zinc-400 hover:text-white inline-flex items-center gap-1 text-[11px]" title="체인을 기본값으로">
                  <RotateCcw className="w-3 h-3" /> 초기화
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-1.5">
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
                      onClick={e => { e.stopPropagation(); setParams(p => ({ ...p, bypass: { ...p.bypass, [s]: !p.bypass[s] } })) }}
                      aria-label={slotOn(s) ? `${SLOT_LABEL[s]} 끄기` : `${SLOT_LABEL[s]} 켜기`}
                      aria-pressed={slotOn(s)}
                      className={`ml-auto w-5 h-5 rounded inline-flex items-center justify-center ${slotOn(s) ? 'text-[var(--cm-brand)]' : 'text-zinc-600'}`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5" style={MONO}>{slotSummary(s, params)}</div>
                  <div className="flex justify-between mt-1">
                    <button type="button" aria-label="앞으로" onClick={e => { e.stopPropagation(); moveSlot(s, -1) }} disabled={i === 0} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <button type="button" aria-label="뒤로" onClick={e => { e.stopPropagation(); moveSlot(s, 1) }} disabled={i === params.order.length - 1} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5" /></button>
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
                <Led on={slotOn(selectedSlot)} onClick={() => setParams(p => ({ ...p, bypass: { ...p.bypass, [selectedSlot]: !p.bypass[selectedSlot] } }))} label={slotOn(selectedSlot) ? '켜짐' : '꺼짐'} />
                <span className="ml-auto text-[10px] text-zinc-500">드래그 · Shift 미세 · 더블클릭 기본값 · 값 클릭해 입력</span>
              </header>
              <div className={`p-3 ${slotOn(selectedSlot) ? '' : 'opacity-60'}`}>
                <PluginPanel slot={selectedSlot} p={params} set={setParams} engine={engine} />
              </div>
            </section>
          )}

          {/* ── 내보내기 · 프리셋 ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <Section title="내보내기">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented value={exportFmt} onChange={v => { setExportFmt(v); setDither(v === 'wav16') }}
                    options={[{ value: 'wav24', label: 'WAV 24bit' }, { value: 'wav16', label: 'WAV 16bit' }, { value: 'mp3', label: 'MP3 320k' }]} />
                  <Segmented value={exportRate} onChange={setExportRate} options={[{ value: 44100, label: '44.1kHz' }, { value: 48000, label: '48kHz' }]} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Led on={dither && exportFmt !== 'mp3'} onClick={() => setDither(v => !v)} label="디더" title="비트 수를 줄일 때 생기는 양자화 잡음을 고르게 퍼뜨려요 (16bit 권장)" />
                  <Segmented value={exportRange} onChange={setExportRange} options={[{ value: 'all', label: '곡 전체' }, { value: 'loop', label: '반복 구간만' }]} />
                  {exportRange === 'loop' && !loop && <span className="text-[11px] text-amber-300/80">반복 구간이 없어 곡 전체를 내보내요.</span>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => exportActive(false)} disabled={!active || !!busy}
                    className="h-8 px-3 rounded-md border border-white/15 bg-black/40 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40">
                    <Download className="w-3.5 h-3.5" /> 내려받기
                  </button>
                  <button type="button" onClick={() => exportActive(true)} disabled={!active || !!busy}
                    className="h-8 px-3 rounded-md bg-[var(--cm-brand)] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110 disabled:opacity-40">
                    <Save className="w-3.5 h-3.5" /> 보관함에 새 곡으로 저장
                  </button>
                  {tracks.length > 1 && (
                    <button type="button" onClick={exportAll} disabled={!!busy}
                      className="h-8 px-3 rounded-md border border-white/15 bg-black/40 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-40">
                      <Download className="w-3.5 h-3.5" /> {tracks.length}곡 모두 내려받기
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500">들리는 소리와 같은 체인으로 이 컴퓨터에서 바로 만들어요. 원곡은 바뀌지 않아요.</p>
              </div>
            </Section>
            <Section title="내 체인 프리셋">
              <div className="flex gap-2">
                <input value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveUserPreset() }}
                  placeholder="프리셋 이름" maxLength={30}
                  className="flex-1 min-w-0 h-8 rounded-md bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none focus:border-[var(--cm-brand)]" />
                <button type="button" onClick={saveUserPreset} disabled={!presetName.trim()} className="h-8 px-3 rounded-md border border-white/15 bg-black/40 text-[12px] font-semibold hover:bg-white/10 disabled:opacity-40">지금 체인 저장</button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {userPresets.length === 0 && <span className="text-[11px] text-zinc-500">저장한 프리셋이 없어요.</span>}
                {userPresets.map(u => (
                  <span key={u.name} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-md border border-white/10 bg-black/30 text-[12px]">
                    <button type="button" onClick={() => { setParams(() => normalizeChain(u.params)); setNotice({ kind: 'info', text: `「${u.name}」을 불러왔어요.` }) }} className="text-zinc-200 hover:text-white">{u.name}</button>
                    <button type="button" aria-label={`${u.name} 지우기`} onClick={() => deleteUserPreset(u.name)} className="text-zinc-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {engine && (
          <aside className="lg:sticky lg:top-2">
            <MeterColumn engine={engine} targetLufs={target.lufs} ceiling={params.limiter.ceiling} playing={playing} />
          </aside>
        )}
      </div>

      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="보관함에서 불러오기" onClick={() => setShowLibrary(false)}>
          <div className="w-full max-w-lg max-h-[70vh] flex flex-col rounded-xl border border-white/10 bg-[#141414] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 h-12 border-b border-white/10">
              <h2 className="text-sm font-bold">보관함에서 불러오기</h2>
              <button type="button" aria-label="닫기" onClick={() => setShowLibrary(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {library === null && <div className="p-6 text-center text-sm text-zinc-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />불러오는 중</div>}
              {libraryErr && <div className="p-6 text-center text-sm text-zinc-300">{libraryErr}</div>}
              {library && !libraryErr && library.length === 0 && <div className="p-6 text-center text-sm text-zinc-400">보관함에 곡이 없어요.</div>}
              {library?.map(s => (
                <button key={s.id} type="button" onClick={() => loadSong(s)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`w-9 h-9 rounded-md inline-flex items-center justify-center border transition-colors disabled:opacity-30 ${active ? 'bg-[var(--cm-brand)] border-[var(--cm-brand)] text-white' : 'bg-black/40 border-white/10 text-zinc-200 hover:bg-white/10'}`}
    >
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
      <p className="text-[11px] text-zinc-500">WAV · MP3 · FLAC · 최대 {MAX_TRACKS}곡</p>
    </div>
  )
}
