'use client'

/**
 * 마스터링 화면 상태 — 체인·곡(편집·마커·스템·메타)·목표, 실행 취소/다시 실행.
 * 오디오 엔진은 상태가 아니라 store 밖의 단일 객체다(engine.ts).
 */
import { create } from 'zustand'
import { defaultEdit, ALL_SLOTS, MATCH_FREQS, type ChainParams, type EditParams } from '@/lib/mastering/dsp'
import { defaultChain } from '@/lib/mastering/presets'
import type { TrackMeta } from '@/lib/mastering/fileformats'
import type { Analysis } from '@/lib/mastering/analyze'

export interface Marker { id: string; time: number; name: string }

export interface LibrarySong {
  id: string
  title: string
  audio_url: string
  image_url?: string | null
  lyrics?: string | null
  prompt?: string | null
  genre?: string | null
  status?: string
}

export interface Stem {
  id: string
  title: string
  blob: Blob
  gain: number
  pan: number
  mute: boolean
  solo: boolean
  eq: { low: number; mid: number; high: number }
}

export interface TrackItem {
  id: string
  title: string
  source: 'library' | 'file'
  blob: Blob
  song?: LibrarySong
  edit: EditParams
  markers: Marker[]
  gapAfter: number
  xfadeAfter: number
  stems: Stem[]
  useStems: boolean
  meta: Omit<TrackMeta, 'cover'> & { coverUrl?: string | null }
}

export interface Target { id: string; label: string; lufs: number; tp: number }

export interface ReferenceTrack { title: string; blob: Blob; analysis: Analysis | null; songId?: string }

interface Snapshot { params: ChainParams; tracks: TrackItem[] }

interface State {
  params: ChainParams
  tracks: TrackItem[]
  activeId: string | null
  target: Target
  templateId: string | null
  reference: ReferenceTrack | null
  /** 곡 id → 원본 분석 / 처리본 분석 */
  srcAnalysis: Record<string, Analysis>
  outAnalysis: Record<string, Analysis>
  past: Snapshot[]
  future: Snapshot[]
  lastPush: number
  lastKey: string
  setParams: (fn: (p: ChainParams) => ChainParams, key?: string) => void
  replaceParams: (p: ChainParams) => void
  addTracks: (t: TrackItem[]) => void
  removeTrack: (id: string) => void
  moveTrack: (id: string, dir: -1 | 1) => void
  updateTrack: (id: string, fn: (t: TrackItem) => TrackItem, key?: string) => void
  setActive: (id: string | null) => void
  setTarget: (t: Target) => void
  setTemplateId: (id: string | null) => void
  setReference: (r: ReferenceTrack | null) => void
  setSrcAnalysis: (id: string, a: Analysis) => void
  setOutAnalysis: (id: string, a: Analysis | null) => void
  undo: () => void
  redo: () => void
  loadSession: (s: { params: ChainParams; tracks: TrackItem[]; target: Target; activeId: string | null }) => void
}

const LS_CHAIN = 'cm.mastering.chain.v3'

/** 저장해 둔 체인이 옛 모양이어도 깨지지 않게 기본값 위에 얹는다 */
export function normalizeChain(saved: Partial<ChainParams> | null | undefined): ChainParams {
  const d = defaultChain()
  if (!saved || typeof saved !== 'object') return d
  const order = Array.isArray(saved.order) && saved.order.length === ALL_SLOTS.length && ALL_SLOTS.every(s => saved.order!.includes(s)) ? saved.order : d.order
  const s = saved as ChainParams
  return {
    ...d,
    inputTrim: typeof s.inputTrim === 'number' ? s.inputTrim : 0,
    order,
    listenOriginal: false, originalTrim: 0,
    bypass: { ...d.bypass, ...(s.bypass ?? {}) },
    gate: { ...d.gate, ...(s.gate ?? {}) },
    eq: { ...d.eq, ...(s.eq ?? {}) },
    mseq: { mid: { ...d.mseq.mid, ...(s.mseq?.mid ?? {}) }, side: { ...d.mseq.side, ...(s.mseq?.side ?? {}) } },
    dyneq: { bands: Array.isArray(s.dyneq?.bands) && s.dyneq.bands.length ? s.dyneq.bands.slice(0, 4) : d.dyneq.bands },
    deesser: { ...d.deesser, ...(s.deesser ?? {}) },
    match: { strength: s.match?.strength ?? d.match.strength, curve: s.match?.curve?.length === MATCH_FREQS.length ? s.match.curve : d.match.curve },
    comp: { ...d.comp, ...(s.comp ?? {}) },
    multiband: { ...d.multiband, ...(s.multiband ?? {}), bands: s.multiband?.bands?.length === 3 ? s.multiband.bands : d.multiband.bands },
    transient: { ...d.transient, ...(s.transient ?? {}) },
    imager: { ...d.imager, ...(s.imager ?? {}), widths: s.imager?.widths?.length === 3 ? s.imager.widths : d.imager.widths },
    stereo: { ...d.stereo, ...(s.stereo ?? {}) },
    saturation: { ...d.saturation, ...(s.saturation ?? {}) },
    clipper: { ...d.clipper, ...(s.clipper ?? {}) },
    limiter: { ...d.limiter, ...(s.limiter ?? {}) },
  }
}

export function readChainLS(): ChainParams {
  try { const v = localStorage.getItem(LS_CHAIN); return normalizeChain(v ? JSON.parse(v) : null) } catch { return defaultChain() }
}
const writeChainLS = (p: ChainParams) => { try { localStorage.setItem(LS_CHAIN, JSON.stringify({ ...p, listenOriginal: false, originalTrim: 0 })) } catch {} }

export function newTrack(o: { title: string; source: 'library' | 'file'; blob: Blob; song?: LibrarySong }): TrackItem {
  return {
    id: crypto.randomUUID(), ...o,
    edit: defaultEdit(), markers: [], gapAfter: 2, xfadeAfter: 0, stems: [], useStems: false,
    meta: { title: o.title, artist: '', album: '', isrc: '', coverUrl: o.song?.image_url ?? null },
  }
}

const HISTORY_MAX = 100
const COALESCE_MS = 600

export const useMastering = create<State>((set, get) => {
  /** 바꾸기 전 상태를 기록 — 같은 종류의 연속 변경(드래그)은 하나로 묶는다 */
  const record = (key: string) => {
    const s = get()
    const now = Date.now()
    if (key && key === s.lastKey && now - s.lastPush < COALESCE_MS) { set({ lastPush: now }); return }
    const past = [...s.past, { params: s.params, tracks: s.tracks }].slice(-HISTORY_MAX)
    set({ past, future: [], lastPush: now, lastKey: key })
  }
  return {
    params: defaultChain(),
    tracks: [],
    activeId: null,
    target: { id: 'album', label: '음반 (CD · 디지털 앨범)', lufs: -9, tp: -0.3 }, // 기본 납품처 = 음반(destinations.ts DEFAULT_DESTINATION)
    templateId: null,
    reference: null,
    srcAnalysis: {},
    outAnalysis: {},
    past: [],
    future: [],
    lastPush: 0,
    lastKey: '',
    setParams: (fn, key = 'params') => {
      const next = fn(get().params)
      if (next === get().params) return
      // A/B 전환은 실행 취소 대상이 아니다
      const onlyAB = Object.keys(next).every(k => k === 'listenOriginal' || k === 'originalTrim' || (next as never)[k] === (get().params as never)[k])
      if (!onlyAB) record(key)
      set({ params: next })
      writeChainLS(next)
    },
    replaceParams: p => { record('replace'); set({ params: p }); writeChainLS(p) },
    addTracks: t => { record('tracks'); set(s => ({ tracks: [...s.tracks, ...t], activeId: s.activeId ?? t[0]?.id ?? null })) },
    removeTrack: id => {
      record('tracks')
      set(s => {
        const tracks = s.tracks.filter(t => t.id !== id)
        return { tracks, activeId: s.activeId === id ? tracks[0]?.id ?? null : s.activeId }
      })
    },
    moveTrack: (id, dir) => {
      const t = [...get().tracks]
      const i = t.findIndex(x => x.id === id), j = i + dir
      if (i < 0 || j < 0 || j >= t.length) return
      record('order')
      ;[t[i], t[j]] = [t[j], t[i]]
      set({ tracks: t })
    },
    updateTrack: (id, fn, key = 'track') => {
      record(`${key}:${id}`)
      set(s => ({ tracks: s.tracks.map(t => (t.id === id ? fn(t) : t)) }))
    },
    setActive: id => set({ activeId: id }),
    setTarget: t => set({ target: t }),
    setTemplateId: id => set({ templateId: id }),
    setReference: r => set({ reference: r }),
    setSrcAnalysis: (id, a) => set(s => ({ srcAnalysis: { ...s.srcAnalysis, [id]: a } })),
    setOutAnalysis: (id, a) => set(s => {
      const o = { ...s.outAnalysis }
      if (a) o[id] = a; else delete o[id]
      return { outAnalysis: o }
    }),
    undo: () => {
      const s = get()
      const prev = s.past[s.past.length - 1]
      if (!prev) return
      set({
        past: s.past.slice(0, -1),
        future: [{ params: s.params, tracks: s.tracks }, ...s.future],
        params: { ...prev.params, listenOriginal: s.params.listenOriginal, originalTrim: s.params.originalTrim },
        tracks: prev.tracks,
        activeId: prev.tracks.some(t => t.id === s.activeId) ? s.activeId : prev.tracks[0]?.id ?? null,
        lastKey: '',
      })
      writeChainLS(prev.params)
    },
    redo: () => {
      const s = get()
      const nx = s.future[0]
      if (!nx) return
      set({
        future: s.future.slice(1),
        past: [...s.past, { params: s.params, tracks: s.tracks }],
        params: { ...nx.params, listenOriginal: s.params.listenOriginal, originalTrim: s.params.originalTrim },
        tracks: nx.tracks,
        activeId: nx.tracks.some(t => t.id === s.activeId) ? s.activeId : nx.tracks[0]?.id ?? null,
        lastKey: '',
      })
      writeChainLS(nx.params)
    },
    loadSession: ss => {
      record('session')
      set({ params: ss.params, tracks: ss.tracks, target: ss.target, activeId: ss.activeId, srcAnalysis: {}, outAnalysis: {} })
      writeChainLS(ss.params)
    },
  }
})

export const activeTrack = (s: State) => s.tracks.find(t => t.id === s.activeId) ?? null
