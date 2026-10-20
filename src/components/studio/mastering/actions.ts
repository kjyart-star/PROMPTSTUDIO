'use client'

/**
 * 마스터링 화면의 동작(디코드·분석·렌더·내보내기·레퍼런스·앨범·세션). 화면 컴포넌트는 이 함수만 부른다.
 */
import { create } from 'zustand'
import { withBase } from '@/lib/basePath'
import { createClient } from '@/lib/supabase/client'
import { encodeAudioBufferToMp3 } from '@/lib/audioUtils'
import { defaultEdit, measureIntegratedLufs, TruePeakMeter, linToDb, type ChainParams, type EditParams } from '@/lib/mastering/dsp'
import { decodeAudio, computePeaks, renderChain, autoMatchLoudness, mixStems, joinAlbum, type DecodedAudio } from '@/lib/mastering/render'
import { analyzeAudio, loudestWindow, matchingCurve, type Analysis } from '@/lib/mastering/analyze'
import { autoMaster } from '@/lib/mastering/automaster'
import { TEMPLATES, type MasterTemplate } from '@/lib/mastering/templates'
import { encodeWav, tagMp3, makeZip, readZip, type BitDepth, type DitherKind, type TrackMeta } from '@/lib/mastering/fileformats'
import { MasteringEngine } from './engine'
import { useMastering, normalizeChain, newTrack, type TrackItem, type LibrarySong, type Target, type Stem } from './store'

// ───────────────────────── 화면 상태(바쁨·알림·내보내기 옵션) ─────────────────────────

export type ExportFormat = 'wav' | 'mp3'
export interface ExportOpts { format: ExportFormat; bits: BitDepth; rate: 44100 | 48000 | 96000; dither: DitherKind; range: 'all' | 'loop' }

export interface ExportReport {
  file: string
  format: string
  integrated: number
  truePeak: number
  lra: number
  plr: number
  target: Target
  pass: { loudness: boolean; peak: boolean }
}

interface Ui {
  busy: { label: string; progress: number } | null
  notice: { kind: 'ok' | 'err' | 'info'; text: string } | null
  exportOpts: ExportOpts
  reports: ExportReport[]
  autoNotes: string[]
  loop: { start: number; end: number } | null
  loopOn: boolean
  preview: { templateId: string; prev: ChainParams } | null
  peaks: Float32Array | null
  processedPeaks: Float32Array | null
  set: (p: Partial<Omit<Ui, 'set'>>) => void
}

export const useUi = create<Ui>(set => ({
  busy: null,
  notice: null,
  exportOpts: { format: 'wav', bits: 24, rate: 44100, dither: 'tpdf', range: 'all' },
  reports: [],
  autoNotes: [],
  loop: null,
  loopOn: false,
  preview: null,
  peaks: null,
  processedPeaks: null,
  set: p => set(p),
}))

const ui = () => useUi.getState()
const st = () => useMastering.getState()
const notify = (kind: 'ok' | 'err' | 'info', text: string) => ui().set({ notice: { kind, text } })
const busy = (label: string, progress = 0) => ui().set({ busy: { label, progress } })
const progress = (p: number) => { const b = ui().busy; if (b) ui().set({ busy: { ...b, progress: p } }) }
const done = () => ui().set({ busy: null })
export const cancelRef = { cancelled: false }

let engineSingleton: MasteringEngine | null = null
export function getEngine(): MasteringEngine | null {
  if (typeof window === 'undefined') return null
  if (!engineSingleton) engineSingleton = new MasteringEngine()
  return engineSingleton
}

// ───────────────────────── 디코드 캐시 (활성 곡 하나) ─────────────────────────

let decoded: { key: string; dec: DecodedAudio } | null = null

/** 곡(스템 모드면 스템 믹스)을 PCM 으로 */
export async function decodeTrack(t: TrackItem, rate = 44100): Promise<DecodedAudio> {
  const key = `${t.id}|${rate}|${t.useStems ? stemKey(t.stems) : 'main'}`
  if (decoded?.key === key) return decoded.dec
  let dec: DecodedAudio
  if (t.useStems && t.stems.length) {
    const parts = await Promise.all(t.stems.map(async s => ({ s, d: await decodeAudio(await s.blob.arrayBuffer(), rate) })))
    const ch = await mixStems(parts.map(({ s, d }) => ({ channels: d.channels, gain: s.gain, pan: s.pan, mute: s.mute, solo: s.solo, eq: s.eq })), rate)
    dec = { channels: ch, sampleRate: rate, duration: ch[0].length / rate }
  } else dec = await decodeAudio(await t.blob.arrayBuffer(), rate)
  decoded = { key, dec }
  return dec
}
const stemKey = (s: Stem[]) => s.map(x => `${x.id}:${x.gain}:${x.pan}:${x.mute}:${x.solo}:${x.eq.low}:${x.eq.mid}:${x.eq.high}`).join(',')

// ───────────────────────── 곡 불러오기 ─────────────────────────

export async function fetchLibrary(): Promise<{ songs: LibrarySong[]; error?: string }> {
  try {
    const r = await fetch(withBase('/api/song-history'))
    if (r.status === 401) return { songs: [], error: '로그인하면 보관함 곡을 불러올 수 있어요.' }
    const rows = await r.json()
    return { songs: Array.isArray(rows) ? rows.filter((s: LibrarySong) => s.audio_url && (s.status ?? 'completed') === 'completed') : [] }
  } catch {
    return { songs: [], error: '보관함을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' }
  }
}

/** 불러오기 단계별 실패 — 화면에 어느 단계에서 막혔는지 보여 준다 */
export class SongLoadError extends Error {
  constructor(public stage: 'sign' | 'download' | 'decode', message: string) { super(message) }
}

/**
 * 보관함 곡의 음원을 받는다.
 * - 저장소 경로(audio/xxx.mp3)는 서명 주소로 바꾸고, 이미 https 주소면 그대로 쓴다.
 * - cache: 'no-store' — 플레이어 <audio> 가 CORS 없이 받아 둔 캐시를 fetch 가 재사용하면
 *   Access-Control-Allow-Origin 이 없는 응답이 돌아와 「Failed to fetch」 로 막힌다(배포본에서 확인).
 */
export async function fetchSongBlob(s: { audio_url: string }): Promise<Blob> {
  let url = s.audio_url
  if (!/^https?:/.test(url)) {
    let r: Response
    try { r = await fetch(withBase(`/api/tracks/signed-url?file_path=${encodeURIComponent(url)}`), { cache: 'no-store' }) }
    catch { throw new SongLoadError('sign', '재생 주소를 받는 중 연결이 끊겼어요. 인터넷 연결을 확인해 주세요.') }
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) throw new SongLoadError('sign', '로그인이 만료됐어요. 다시 로그인한 뒤 불러와 주세요.')
    if (r.status === 403) throw new SongLoadError('sign', '이 곡을 불러올 권한이 없어요.')
    if (!r.ok || !j.signedUrl) throw new SongLoadError('sign', `재생 주소를 만들지 못했어요(${r.status}).`)
    url = j.signedUrl
  }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 120000)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl.signal })
    if (res.status === 404) throw new SongLoadError('download', '저장소에 음원 파일이 없어요.')
    if (res.status === 401 || res.status === 403) throw new SongLoadError('download', '음원 주소가 만료됐어요. 다시 불러와 주세요.')
    if (!res.ok) throw new SongLoadError('download', `음원을 받지 못했어요(${res.status}).`)
    return await res.blob()
  } catch (e) {
    if (e instanceof SongLoadError) throw e
    if ((e as Error).name === 'AbortError') throw new SongLoadError('download', '음원을 받는 데 너무 오래 걸려 멈췄어요. 잠시 뒤 다시 시도해 주세요.')
    throw new SongLoadError('download', '음원 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.')
  } finally { clearTimeout(timer) }
}

export const loadErrorText = (e: unknown, what = '곡') =>
  e instanceof SongLoadError ? `${what}을 불러오지 못했어요 — ${e.message}` : `${what}을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.`

export const MAX_TRACKS = 20

export function addFiles(files: File[]) {
  const list = files.filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|flac|aiff?|m4a|ogg)$/i.test(f.name))
  if (!list.length) { notify('err', '오디오 파일만 올릴 수 있어요 (WAV·MP3 등).'); return }
  const room = MAX_TRACKS - st().tracks.length
  if (room <= 0) { notify('err', `한 번에 ${MAX_TRACKS}곡까지 올릴 수 있어요.`); return }
  const add = list.slice(0, room).map(f => newTrack({ title: f.name.replace(/\.[^/.]+$/, ''), source: 'file', blob: f }))
  if (add.length < list.length) notify('info', `${MAX_TRACKS}곡을 넘는 ${list.length - add.length}곡은 빼고 올렸어요.`)
  const wasEmpty = !st().tracks.length
  st().addTracks(add)
  if (wasEmpty) activate(add[0].id)
}

export async function addLibrarySong(s: LibrarySong) {
  if (st().tracks.length >= MAX_TRACKS) { notify('err', `한 번에 ${MAX_TRACKS}곡까지 올릴 수 있어요.`); return }
  busy(`「${s.title}」 불러오는 중`)
  try {
    const blob = await fetchSongBlob(s)
    const t = newTrack({ title: s.title || '제목 없음', source: 'library', blob, song: s })
    const wasEmpty = !st().tracks.length
    st().addTracks([t])
    if (wasEmpty) await activate(t.id)
  } catch (e) {
    console.error(e)
    notify('err', loadErrorText(e))
  } finally { done() }
}

/** 곡 선택 — 재생기에 싣고 파형·원본 분석 */
export async function activate(id: string) {
  const eng = getEngine()
  const t = st().tracks.find(x => x.id === id)
  if (!eng || !t) return
  eng.pause()
  st().setActive(id)
  ui().set({ peaks: null, processedPeaks: null, loop: null, loopOn: false, autoNotes: [] })
  eng.load(t.blob)
  eng.setEdit(t.edit)
  if (t.useStems && t.stems.length) await enterStems(t)
  try {
    const dec = await decodeTrack(t)
    ui().set({ peaks: computePeaks(dec.channels, 4000) })
    if (!st().srcAnalysis[id]) {
      const a = await analyzeAudio(dec.channels, dec.sampleRate)
      st().setSrcAnalysis(id, a)
    }
  } catch (e) {
    console.error(e)
    notify('err', '음원은 받았지만 소리로 풀지 못했어요(파일 형식 문제). WAV·MP3 로 다시 시도해 주세요.')
  }
}

// ───────────────────────── 스템 ─────────────────────────

export async function enterStems(t: TrackItem) {
  const eng = getEngine()
  if (!eng) return
  await eng.ensure()
  const ctx = eng.ctx!
  busy('스템을 준비하는 중')
  try {
    const bufs = await Promise.all(t.stems.map(async s => ctx.decodeAudioData(await s.blob.arrayBuffer())))
    await eng.loadStems(t.stems.map((s, i) => ({ buffer: bufs[i], gain: s.gain, pan: s.pan, mute: s.mute, solo: s.solo, eq: s.eq })))
  } finally { done() }
}

export function addStemFiles(trackId: string, files: File[]) {
  const stems: Stem[] = files.filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|flac|aiff?|m4a|ogg)$/i.test(f.name)).map(f => ({
    id: crypto.randomUUID(), title: f.name.replace(/\.[^/.]+$/, ''), blob: f, gain: 0, pan: 0, mute: false, solo: false, eq: { low: 0, mid: 0, high: 0 },
  }))
  if (!stems.length) return
  st().updateTrack(trackId, t => ({ ...t, stems: [...t.stems, ...stems] }), 'stems')
}

// ───────────────────────── 분석 · 자동 맞춤 · 자동 마스터링 ─────────────────────────

export async function autoMatch() {
  const t = activeTrackNow()
  if (!t) return
  busy('곡 전체를 재며 라우드니스를 맞추는 중')
  try {
    const dec = await decodeTrack(t)
    const { target, params } = st()
    const res = await autoMatchLoudness(dec.channels, dec.sampleRate, { ...params, listenOriginal: false }, target.lufs, progress, t.edit)
    st().setParams(() => ({ ...res.params, listenOriginal: params.listenOriginal, originalTrim: params.originalTrim }), 'auto')
    getEngine()?.resetMeters()
    notify('ok', `타깃 ${target.lufs} LUFS 에 맞췄어요 — 결과 ${res.integrated.toFixed(1)} LUFS · 트루 피크 ${res.truePeak.toFixed(1)} dBTP`)
  } catch (e) { console.error(e); notify('err', '라우드니스를 재지 못했어요.') } finally { done() }
}

/** 입력 레벨 맞춤 — 체인에 들어가는 소리를 -18 LUFS 근처로(플러그인 스레숄드 기준점) */
export function autoInputGain() {
  const t = activeTrackNow()
  const a = t && st().srcAnalysis[t.id]
  if (!a || !Number.isFinite(a.integrated)) { notify('info', '원본을 다 잰 뒤에 눌러 주세요.'); return }
  const trim = Math.round((-18 - a.integrated) * 10) / 10
  st().setParams(p => ({ ...p, inputTrim: Math.max(-24, Math.min(24, trim)) }), 'inputTrim')
  notify('ok', `입력을 ${trim > 0 ? '+' : ''}${trim.toFixed(1)}dB 맞췄어요 (원본 ${a.integrated.toFixed(1)} LUFS → -18 LUFS).`)
}

export function applyTemplate(tpl: MasterTemplate) {
  const c = tpl.build()
  st().setParams(() => c, 'template')
  st().setTemplateId(tpl.id)
  st().setTarget({ id: tpl.id, label: tpl.label, lufs: tpl.lufs, tp: tpl.tp })
  ui().set({ preview: null })
  notify('info', `「${tpl.label}」 템플릿을 적용했어요. 「자동 맞춤」으로 목표 ${tpl.lufs} LUFS 에 맞춰 보세요.`)
}

/** 템플릿 + 곡 분석 보정 + 라우드니스 맞춤 */
export async function runAutoMaster(tpl: MasterTemplate): Promise<boolean> {
  const t = activeTrackNow()
  if (!t) return false
  busy('곡을 분석하는 중')
  try {
    const dec = await decodeTrack(t)
    let a = st().srcAnalysis[t.id]
    if (!a) { a = await analyzeAudio(dec.channels, dec.sampleRate, { onProgress: p => progress(p * 0.4) }); st().setSrcAnalysis(t.id, a) }
    const { params, notes } = autoMaster(a, tpl)
    busy('목표 라우드니스에 맞추는 중', 0.4)
    const res = await autoMatchLoudness(dec.channels, dec.sampleRate, params, tpl.lufs, p => progress(0.4 + p * 0.6), t.edit)
    st().setParams(() => res.params, 'automaster')
    st().setTemplateId(tpl.id)
    st().setTarget({ id: tpl.id, label: tpl.label, lufs: tpl.lufs, tp: tpl.tp })
    ui().set({ autoNotes: [...notes, `라우드니스 ${res.integrated.toFixed(1)} LUFS · 트루 피크 ${res.truePeak.toFixed(1)} dBTP 로 맞춤`] })
    notify('ok', `「${tpl.label}」 기준으로 마스터링했어요 — 목표 음량에 맞췄어요(${res.integrated.toFixed(1)} LUFS).`)
    return true
  } catch (e) { console.error(e); notify('err', '자동 마스터링에 실패했어요. 다시 눌러 주세요.'); return false } finally { done() }
}

/** 템플릿 미리듣기 — 가장 큰 8초 구간을 반복하며 템플릿을 잠깐 켠다 */
export async function previewTemplate(tpl: MasterTemplate) {
  const t = activeTrackNow()
  const eng = getEngine()
  if (!t || !eng) return
  const cur = ui().preview
  const prev = cur ? cur.prev : st().params
  const a = st().srcAnalysis[t.id]
  const start = a ? loudestWindow(a, 8) : 0
  useMastering.setState({ params: { ...tpl.build(), listenOriginal: false } })
  ui().set({ preview: { templateId: tpl.id, prev }, loop: { start, end: start + 8 }, loopOn: true })
  eng.seek(start)
  await eng.play().catch(() => {})
}
export function endPreview(apply: boolean) {
  const pv = ui().preview
  if (!pv) return
  const tpl = TEMPLATES.find(x => x.id === pv.templateId)
  if (apply && tpl) {
    useMastering.setState({ params: pv.prev })
    applyTemplate(tpl)
  } else useMastering.setState({ params: pv.prev })
  ui().set({ preview: null, loopOn: false })
}

export async function analyzeOutput() {
  const t = activeTrackNow()
  if (!t) return
  busy('처리본을 렌더해 분석하는 중')
  try {
    const dec = await decodeTrack(t)
    const res = await renderChain(dec.channels, dec.sampleRate, { ...st().params, listenOriginal: false }, { edit: t.edit, onProgress: p => progress(p * 0.5), signal: cancelRef })
    const a = await analyzeAudio(res.channels!, dec.sampleRate, { onProgress: p => progress(0.5 + p * 0.5) })
    st().setOutAnalysis(t.id, a)
    ui().set({ processedPeaks: t.edit.start || t.edit.end ? null : computePeaks(res.channels!, 4000) })
    notify('ok', `처리본 분석 완료 — ${a.integrated.toFixed(1)} LUFS · LRA ${a.lra.toFixed(1)} LU · 트루 피크 ${a.truePeak.toFixed(1)} dBTP`)
  } catch (e) { if (!isCancel(e)) { console.error(e); notify('err', '분석하지 못했어요.') } } finally { done() }
}

// ───────────────────────── 레퍼런스 ─────────────────────────

export async function loadReference(blob: Blob, title: string, songId?: string) {
  busy(`레퍼런스 「${title}」 분석 중`)
  try {
    const dec = await decodeAudio(await blob.arrayBuffer(), 44100)
    const a = await analyzeAudio(dec.channels, dec.sampleRate, { onProgress: progress })
    st().setReference({ title, blob, analysis: a, songId })
    getEngine()?.loadReference(blob)
    notify('ok', `레퍼런스 「${title}」 — ${a.integrated.toFixed(1)} LUFS, LRA ${a.lra.toFixed(1)} LU`)
  } catch (e) { console.error(e); notify('err', '레퍼런스를 열지 못했어요.') } finally { done() }
}

export function matchToReference(strength: number) {
  const t = activeTrackNow()
  const ref = st().reference?.analysis
  const src = t && st().srcAnalysis[t.id]
  if (!ref || !src) { notify('info', '곡과 레퍼런스를 모두 불러온 뒤 눌러 주세요.'); return }
  const curve = matchingCurve(src.bands, ref.bands)
  st().setParams(p => ({ ...p, match: { curve, strength }, bypass: { ...p.bypass, match: false } }), 'match')
  notify('ok', '레퍼런스 톤에 맞춘 매칭 EQ 를 만들었어요. 「매칭 EQ」 슬롯에서 강도를 조절하세요.')
}

// ───────────────────────── 내보내기 ─────────────────────────

const isCancel = (e: unknown) => (e as Error)?.message === 'cancelled'
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)

async function coverBytes(url?: string | null): Promise<TrackMeta['cover']> {
  if (!url) return null
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const b = await r.blob()
    return { mime: b.type || 'image/jpeg', data: new Uint8Array(await b.arrayBuffer()) }
  } catch { return null }
}

/** 한 곡을 렌더해 파일로 */
export async function renderTrackFile(t: TrackItem, opts: ExportOpts, onP: (p: number) => void, extra?: { trackNo?: string; noMeta?: boolean }) {
  const dec = await decodeTrack(t, opts.rate)
  const { loop } = ui()
  const useLoop = opts.range === 'loop' && loop && t.id === st().activeId
  const base = { ...st().params, listenOriginal: false }
  if (opts.format === 'mp3') return renderMp3Safe(t, dec, base, opts, onP, extra)
  const params = base
  const res = await renderChain(dec.channels, dec.sampleRate, params, {
    start: useLoop ? loop!.start * dec.sampleRate : 0,
    end: useLoop ? loop!.end * dec.sampleRate : undefined,
    edit: t.edit,
    onProgress: p => onP(p * 0.65),
    signal: cancelRef,
  })
  const ch = res.channels!
  const meta: TrackMeta = extra?.noMeta ? {} : { title: t.meta.title, artist: t.meta.artist, album: t.meta.album, isrc: t.meta.isrc, trackNo: extra?.trackNo, cover: await coverBytes(t.meta.coverUrl) }
  const blob = encodeWav(ch, dec.sampleRate, opts.bits, opts.bits === 32 ? 'none' : opts.dither, meta)
  onP(1)
  return { blob, ext: 'wav' as const, channels: ch, sampleRate: dec.sampleRate }
}

/**
 * MP3 는 인코딩하면서 피크가 솟는다(시끄러운 마스터일수록 1~2dB).
 * 인코딩한 결과의 트루 피크를 다시 재서 천장을 넘으면 그만큼 천장을 내리고(게인은 올려 라우드니스 유지) 다시 만든다.
 */
async function renderMp3Safe(t: TrackItem, dec: DecodedAudio, base: ChainParams, opts: ExportOpts, onP: (p: number) => void, extra?: { trackNo?: string; noMeta?: boolean }) {
  const { loop } = ui()
  const useLoop = opts.range === 'loop' && loop && t.id === st().activeId
  const meta: TrackMeta = extra?.noMeta ? {} : { title: t.meta.title, artist: t.meta.artist, album: t.meta.album, isrc: t.meta.isrc, trackNo: extra?.trackNo, cover: await coverBytes(t.meta.coverUrl) }
  const range = { start: useLoop ? loop!.start * dec.sampleRate : 0, end: useLoop ? loop!.end * dec.sampleRate : undefined, edit: t.edit, signal: cancelRef }
  // 먼저 WAV 기준 라우드니스 — MP3 도 이 크기를 지킨다
  const ref = await renderChain(dec.channels, dec.sampleRate, base, { ...range, write: false, onProgress: x => onP(x * 0.1) })
  const want = base.limiter.ceiling
  let ceil = want - 1, gain = base.limiter.gain + 1
  let best: { blob: Blob; channels: Float32Array<ArrayBuffer>[]; err: number } | null = null
  for (let k = 0; k < 4; k++) {
    const p = { ...base, limiter: { ...base.limiter, ceiling: ceil, gain } }
    const res = await renderChain(dec.channels, dec.sampleRate, p, { ...range, onProgress: x => onP(0.1 + k * 0.22 + x * 0.12) })
    const ch = res.channels!
    const ab = new AudioBuffer({ length: Math.max(1, ch[0].length), numberOfChannels: 2, sampleRate: dec.sampleRate })
    ab.copyToChannel(ch[0], 0); ab.copyToChannel(ch[1], 1)
    const mp3 = await encodeAudioBufferToMp3(ab, 320, x => onP(0.1 + k * 0.22 + 0.12 + (x / 100) * 0.08))
    // 인코딩 결과를 다시 풀어 트루 피크·라우드니스를 잰다
    const back = await decodeAudio(await mp3.arrayBuffer(), dec.sampleRate)
    const tp = new TruePeakMeter()
    tp.process(back.channels[0], back.channels[1], back.channels[0].length)
    const over = linToDb(tp.max) - want
    const lufsGap = Number.isFinite(ref.integrated) ? ref.integrated - measureIntegratedLufs(back.channels, dec.sampleRate) : 0
    const err = Math.max(0, over) * 2 + Math.abs(lufsGap)
    if (!best || err < best.err) best = { blob: mp3, channels: ch, err }
    if (over <= 0 && Math.abs(lufsGap) <= 0.5) break
    // 피크가 넘치면 천장을 내리고, 작아졌으면 게인을 올린다(천장 아래에서만 커진다)
    if (over > 0) ceil -= over + 0.2
    gain += lufsGap
  }
  onP(1)
  return { blob: await tagMp3(best!.blob, meta), ext: 'mp3' as const, channels: best!.channels, sampleRate: dec.sampleRate }
}

/** 내보낸 파일을 다시 열어 재측정 */
export async function measureFile(blob: Blob, name: string, opts: ExportOpts): Promise<ExportReport> {
  const dec = await decodeAudio(await blob.arrayBuffer(), opts.rate)
  const a = await analyzeAudio(dec.channels, dec.sampleRate, { spectrogramCols: 8 })
  const target = st().target
  return {
    file: name,
    format: opts.format === 'mp3' ? 'MP3 320k' : `WAV ${opts.bits === 32 ? '32f' : opts.bits}bit · ${opts.rate / 1000}kHz`,
    integrated: a.integrated, truePeak: a.truePeak, lra: a.lra, plr: a.plr, target,
    pass: { loudness: Math.abs(a.integrated - target.lufs) <= 1, peak: a.truePeak <= target.tp + 0.1 },
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function exportActive() {
  const t = activeTrackNow()
  if (!t) return
  cancelRef.cancelled = false
  const opts = ui().exportOpts
  busy('내보내는 중')
  try {
    const out = await renderTrackFile(t, opts, progress)
    const name = `${safe(t.meta.title || t.title)} (마스터링).${out.ext}`
    download(out.blob, name)
    busy('내보낸 파일을 다시 재는 중', 0.95)
    const rep = await measureFile(out.blob, name, opts)
    ui().set({ reports: [rep, ...ui().reports].slice(0, 30) })
    notify(rep.pass.loudness && rep.pass.peak ? 'ok' : 'info', `내보냈어요 — ${rep.integrated.toFixed(1)} LUFS · 트루 피크 ${rep.truePeak.toFixed(1)} dBTP · ${rep.pass.loudness && rep.pass.peak ? '목표 합격' : '목표와 차이 있음(리포트 참고)'}`)
  } catch (e) {
    if (isCancel(e)) notify('info', '내보내기를 멈췄어요.')
    else { console.error(e); notify('err', '내보내다 문제가 생겼어요.') }
  } finally { done() }
}

/** 앨범 순서대로 모든 곡을 ZIP 하나로 */
export async function exportAlbumZip() {
  const { tracks } = st()
  if (!tracks.length) return
  cancelRef.cancelled = false
  const opts = { ...ui().exportOpts, range: 'all' as const }
  const entries: { name: string; data: Blob }[] = []
  const reps: ExportReport[] = []
  try {
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      busy(`${i + 1}/${tracks.length} 「${t.title}」 렌더 중`)
      const out = await renderTrackFile(t, opts, progress, { trackNo: `${i + 1}/${tracks.length}` })
      const name = `${String(i + 1).padStart(2, '0')} ${safe(t.meta.title || t.title)}.${out.ext}`
      entries.push({ name, data: out.blob })
      reps.push(await measureFile(out.blob, name, opts))
    }
    busy('ZIP 으로 묶는 중', 0.99)
    const zip = await makeZip(entries)
    download(zip, `${safe(tracks[0].meta.album || '앨범')} (마스터링).zip`)
    ui().set({ reports: [...reps, ...ui().reports].slice(0, 60) })
    notify('ok', `${tracks.length}곡을 ZIP 으로 내보냈어요. 재측정 리포트를 확인하세요.`)
  } catch (e) {
    if (isCancel(e)) notify('info', '내보내기를 멈췄어요.')
    else { console.error(e); notify('err', '앨범을 내보내다 문제가 생겼어요.') }
  } finally { done() }
}

/** 앨범 한 파일 — 곡 사이 간격·크로스페이드 적용 */
export async function exportAlbumJoined() {
  const { tracks } = st()
  if (!tracks.length) return
  cancelRef.cancelled = false
  const opts = { ...ui().exportOpts, range: 'all' as const }
  try {
    const pieces = []
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      busy(`${i + 1}/${tracks.length} 「${t.title}」 렌더 중`)
      const dec = await decodeTrack(t, opts.rate)
      const res = await renderChain(dec.channels, dec.sampleRate, { ...st().params, listenOriginal: false }, { edit: t.edit, onProgress: progress, signal: cancelRef })
      pieces.push({ channels: res.channels!, gapAfter: t.gapAfter, xfadeAfter: t.xfadeAfter })
    }
    busy('이어 붙이는 중', 0.99)
    const ch = joinAlbum(pieces, opts.rate)
    const album = tracks[0].meta.album || '앨범'
    let blob: Blob
    if (opts.format === 'mp3') {
      const ab = new AudioBuffer({ length: ch[0].length, numberOfChannels: 2, sampleRate: opts.rate })
      ab.copyToChannel(ch[0], 0); ab.copyToChannel(ch[1], 1)
      blob = await tagMp3(await encodeAudioBufferToMp3(ab, 320), { title: album, album, artist: tracks[0].meta.artist })
    } else blob = encodeWav(ch, opts.rate, opts.bits, opts.bits === 32 ? 'none' : opts.dither, { title: album, album, artist: tracks[0].meta.artist })
    const name = `${safe(album)} (이어 붙인 마스터링).${opts.format}`
    download(blob, name)
    const rep = await measureFile(blob, name, opts)
    ui().set({ reports: [rep, ...ui().reports] })
    notify('ok', `앨범을 한 파일로 내보냈어요 — ${rep.integrated.toFixed(1)} LUFS`)
  } catch (e) {
    if (isCancel(e)) notify('info', '내보내기를 멈췄어요.')
    else { console.error(e); notify('err', '앨범을 이어 붙이다 문제가 생겼어요.') }
  } finally { done() }
}

/** 앨범 라우드니스 일관성 — 같은 체인으로 곡마다 재서 gainOffset 을 맞춘다 */
export async function albumLoudness(mode: 'each' | 'album') {
  const { tracks, target } = st()
  if (tracks.length < 1) return
  cancelRef.cancelled = false
  try {
    const lufs: number[] = []
    for (let i = 0; i < tracks.length; i++) {
      busy(`${i + 1}/${tracks.length} 「${tracks[i].title}」 재는 중`)
      const dec = await decodeTrack(tracks[i])
      const r = await renderChain(dec.channels, dec.sampleRate, { ...st().params, listenOriginal: false }, { edit: { ...tracks[i].edit, gainOffset: 0 }, write: false, onProgress: progress, signal: cancelRef })
      lufs.push(r.integrated)
    }
    const finite = lufs.filter(Number.isFinite)
    const mean = 10 * Math.log10(finite.reduce((s, v) => s + Math.pow(10, v / 10), 0) / Math.max(1, finite.length))
    tracks.forEach((t, i) => {
      if (!Number.isFinite(lufs[i])) return
      const off = mode === 'each' ? target.lufs - lufs[i] : target.lufs - mean
      st().updateTrack(t.id, x => ({ ...x, edit: { ...x.edit, gainOffset: Math.round(off * 10) / 10 } }), 'album')
    })
    notify('ok', mode === 'each' ? `곡마다 ${target.lufs} LUFS 에 가깝게 맞췄어요(리미터가 비선형이라 ±1 LU 안팎).` : `곡 간 차이는 유지하고 앨범 평균을 ${target.lufs} LUFS 로 맞췄어요.`)
  } catch (e) { if (!isCancel(e)) { console.error(e); notify('err', '앨범 라우드니스를 재지 못했어요.') } } finally { done() }
}

// ───────────────────────── 보관함 저장 ─────────────────────────

const UPLOAD_LIMIT = 50 * 1024 * 1024

export async function saveToLibrary() {
  const t = activeTrackNow()
  if (!t) return
  cancelRef.cancelled = false
  const opts = { ...ui().exportOpts, range: 'all' as const }
  busy('마스터링본 만드는 중')
  try {
    let out = await renderTrackFile(t, opts, progress)
    let note = ''
    if (out.blob.size > UPLOAD_LIMIT) {
      busy('용량이 커서 MP3 로 바꾸는 중')
      out = await renderTrackFile(t, { ...opts, format: 'mp3' }, progress)
      note = ' (용량이 커서 MP3 320kbps 로 저장했어요)'
    }
    const rep = await measureFile(out.blob, `${t.title}.${out.ext}`, { ...opts, format: out.ext })
    busy('보관함에 올리는 중', 0.5)
    const r = await fetch(withBase('/api/studio/mastering-upload'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext: out.ext }) })
    if (r.status === 401) { notify('err', '로그인하면 보관함에 저장할 수 있어요. 지금은 내려받기만 돼요.'); return }
    const up = await r.json()
    if (!r.ok) throw new Error(up.error)
    const { error } = await createClient().storage.from('tracks').uploadToSignedUrl(up.path, up.token, out.blob, { contentType: up.contentType })
    if (error) throw error
    const s = t.song
    const save = await fetch(withBase('/api/song-history'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${t.meta.title || t.title} (마스터링)`,
        prompt: s?.prompt ?? '', lyrics: s?.lyrics ?? '', genre: s?.genre ?? '',
        image_url: t.meta.coverUrl ?? s?.image_url ?? '',
        audio_url: up.path, status: 'completed', is_published: false,
        notes: `마스터링본 · ${rep.integrated.toFixed(1)} LUFS · ${rep.truePeak.toFixed(1)} dBTP`,
        form: { kind: 'mastering', source_id: s?.id ?? null, target_lufs: st().target.lufs },
      }),
    })
    if (!save.ok) throw new Error('save')
    ui().set({ reports: [rep, ...ui().reports] })
    notify('ok', `보관함에 「${t.meta.title || t.title} (마스터링)」을 새 곡으로 저장했어요${note}. 원곡은 그대로 있어요.`)
  } catch (e) {
    if (isCancel(e)) notify('info', '저장을 멈췄어요.')
    else { console.error(e); notify('err', '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') }
  } finally { done() }
}

// ───────────────────────── 세션 · 프리셋 파일 ─────────────────────────

interface SessionJson {
  kind: 'cookiemusic-mastering-session'
  version: 1
  savedAt: string
  params: ChainParams
  target: Target
  activeIndex: number
  tracks: {
    title: string; source: 'library' | 'file'; song?: LibrarySong; file?: string
    edit: EditParams; markers: TrackItem['markers']; gapAfter: number; xfadeAfter: number; meta: TrackItem['meta']; useStems: boolean
    stems: { title: string; file: string; gain: number; pan: number; mute: boolean; solo: boolean; eq: Stem['eq'] }[]
  }[]
  reference?: { title: string; file?: string; songId?: string }
}

const extOf = (b: Blob, fallback = 'bin') => (b instanceof File && b.name.includes('.') ? b.name.split('.').pop()!.toLowerCase() : ({ 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/flac': 'flac' } as Record<string, string>)[b.type] ?? fallback)

export async function saveSession() {
  const s = st()
  if (!s.tracks.length) { notify('info', '저장할 곡이 없어요.'); return }
  busy('세션을 묶는 중')
  try {
    const files: { name: string; data: Blob }[] = []
    const json: SessionJson = {
      kind: 'cookiemusic-mastering-session', version: 1, savedAt: new Date().toISOString(),
      params: { ...s.params, listenOriginal: false, originalTrim: 0 }, target: s.target,
      activeIndex: Math.max(0, s.tracks.findIndex(t => t.id === s.activeId)),
      tracks: s.tracks.map((t, i) => {
        let file: string | undefined
        if (t.source === 'file') { file = `audio/${i}.${extOf(t.blob, 'wav')}`; files.push({ name: file, data: t.blob }) }
        return {
          title: t.title, source: t.source, song: t.song, file, edit: t.edit, markers: t.markers, gapAfter: t.gapAfter, xfadeAfter: t.xfadeAfter, meta: t.meta, useStems: t.useStems,
          stems: t.stems.map((x, k) => { const f = `stems/${i}-${k}.${extOf(x.blob, 'wav')}`; files.push({ name: f, data: x.blob }); return { title: x.title, file: f, gain: x.gain, pan: x.pan, mute: x.mute, solo: x.solo, eq: x.eq } }),
        }
      }),
    }
    if (s.reference) {
      const f = s.reference.songId ? undefined : `reference.${extOf(s.reference.blob, 'wav')}`
      if (f) files.push({ name: f, data: s.reference.blob })
      json.reference = { title: s.reference.title, file: f, songId: s.reference.songId }
    }
    const zip = await makeZip([{ name: 'session.json', data: new Blob([JSON.stringify(json)], { type: 'application/json' }) }, ...files])
    download(zip, `마스터링 세션 ${new Date().toISOString().slice(0, 10)}.cmmaster`)
    notify('ok', '세션을 파일로 저장했어요 — 곡·체인·오토메이션·마커·스템이 모두 들어 있어요. 보관함 곡은 보관함에서 다시 불러와요.')
  } catch (e) { console.error(e); notify('err', '세션을 저장하지 못했어요.') } finally { done() }
}

export async function loadSessionFile(file: File) {
  busy('세션을 여는 중')
  try {
    const files = await readZip(file)
    const raw = files.get('session.json')
    if (!raw) throw new Error('no session')
    const j = JSON.parse(await raw.text()) as SessionJson
    if (j.kind !== 'cookiemusic-mastering-session') throw new Error('kind')
    const library = j.tracks.some(t => t.source === 'library') ? (await fetchLibrary()).songs : []
    const tracks: TrackItem[] = []
    for (const t of j.tracks) {
      let blob: Blob | undefined
      if (t.file) blob = files.get(t.file)
      else if (t.song) {
        const s = library.find(x => x.id === t.song!.id) ?? t.song
        blob = await fetchSongBlob(s).catch(() => undefined)
      }
      if (!blob) { notify('err', `「${t.title}」 음원을 찾지 못해 빼고 열었어요.`); continue }
      const base = newTrack({ title: t.title, source: t.source, blob, song: t.song })
      tracks.push({
        ...base, edit: { ...defaultEdit(), ...t.edit }, markers: t.markers ?? [], gapAfter: t.gapAfter ?? 2, xfadeAfter: t.xfadeAfter ?? 0,
        meta: { ...base.meta, ...t.meta }, useStems: !!t.useStems,
        stems: (t.stems ?? []).flatMap(x => { const b = files.get(x.file); return b ? [{ id: crypto.randomUUID(), title: x.title, blob: b, gain: x.gain, pan: x.pan, mute: x.mute, solo: x.solo, eq: x.eq }] : [] }),
      })
    }
    const active = tracks[Math.min(j.activeIndex, tracks.length - 1)]?.id ?? null
    st().loadSession({ params: normalizeChain(j.params), tracks, target: j.target, activeId: active })
    if (j.reference) {
      const rb = j.reference.file ? files.get(j.reference.file) : undefined
      if (rb) await loadReference(rb, j.reference.title)
    }
    if (active) await activate(active)
    notify('ok', `세션을 열었어요 — ${tracks.length}곡.`)
  } catch (e) { console.error(e); notify('err', '세션 파일을 열지 못했어요.') } finally { done() }
}

export function exportPresetFile(name: string) {
  const p = st().params
  const json = { kind: 'cookiemusic-mastering-preset', version: 1, name, target: st().target, params: { ...p, listenOriginal: false, originalTrim: 0 } }
  download(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${safe(name || '마스터링 프리셋')}.json`)
}

export async function importPresetFile(file: File): Promise<{ name: string; params: ChainParams } | null> {
  try {
    const j = JSON.parse(await file.text())
    if (j?.kind !== 'cookiemusic-mastering-preset' || typeof j.params !== 'object') throw new Error('kind')
    const params = normalizeChain(j.params)
    st().setParams(() => params, 'preset')
    if (j.target?.lufs) st().setTarget(j.target)
    notify('ok', `프리셋 「${j.name ?? file.name}」을 불러왔어요.`)
    return { name: String(j.name ?? file.name), params }
  } catch {
    notify('err', '마스터링 프리셋 파일이 아니에요.')
    return null
  }
}

export function activeTrackNow(): TrackItem | null {
  const s = st()
  return s.tracks.find(t => t.id === s.activeId) ?? null
}

export { measureIntegratedLufs }

/** 곡에서 가장 큰 부분부터 재생 (간단 모드 「적용하고 듣기」) */
export async function playFromLoudest() {
  const t = activeTrackNow()
  const eng = getEngine()
  if (!t || !eng) return
  const a = st().srcAnalysis[t.id]
  eng.seek(a ? loudestWindow(a, 8) : 0)
  await eng.play().catch(() => {})
}
