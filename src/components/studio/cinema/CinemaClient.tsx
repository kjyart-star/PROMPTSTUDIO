'use client'
/**
 * 쿠키뮤직 스튜디오 「플레이리스트 영상」 — 재생목록(여러 곡)을 하나의 음악 영상으로.
 * 영상은 전부 이 브라우저에서 만든다(WebCodecs + Canvas, 서버 렌더·비용 없음). 크레딧을 쓰지 않는다.
 * 화면 구성 아이디어는 boks-music 「PLAYLIST CINEMA」 를 참고했고 코드는 복사하지 않았다(직접 구현).
 * 구조: 장면 템플릿 × 형태(visualizer 16종) × 색상 — 세 축은 독립(src/lib/cinema).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, ArrowUp, ArrowDown, Loader2, Download, FileAudio, Library, Save, Trash2, AlertTriangle, Clapperboard } from 'lucide-react'
import { TEMPLATES } from '@/lib/cinema/templates'
import { VIZ_SHAPES } from '@/lib/cinema/viz'
import { PALETTES, resolvePalette } from '@/lib/cinema/palettes'
import { ASPECTS } from '@/lib/cinema/types'
import { FPS_OPTIONS, LUFS_OPTIONS, RESOLUTIONS, estimateBytes, formatClock, outputSize } from '@/lib/cinema/output'
import { initialLyrics } from '@/lib/cinema/lyrics'
import { renderCinema, webCodecsSupported, RenderAbort, type CinemaTrackInput, type RenderProgress } from '@/lib/cinema/render'
import { fetchLibrary } from '../mastering/actions'
import type { LibrarySong } from '../mastering/store'
import { CinemaPreview } from './CinemaPreview'
import { LyricsStep } from './LyricsStep'
import { TemplateThumb, VizThumb } from './thumbs'
import { DEFAULT_SETTINGS, loadAudioBlob, loadCoverBlob, loadSampleCoverBlob, newId, probeDuration, type CTrack, type FullSettings } from './model'
import './cinema.css'

const LS_SETTINGS = 'cm.cinema.settings.v1'
const LS_PRESETS = 'cm.cinema.presets.v1'
const readLS = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d } catch { return d } }

const STALL_MS = 20000

const FONT_STYLES = [['auto', '템플릿 기본'], ['serif', '명조'], ['sans', '고딕'], ['hand', '손글씨']] as const
const LYRIC_LINES = [['auto', '템플릿 기본'], ['one', '한 줄만'], ['three', '앞뒤 줄 함께']] as const

const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${on ? 'bg-white text-black border-white' : 'border-white/15 text-zinc-300 hover:border-white/40'}`

export default function CinemaClient() {
  const [settings, setSettings] = useState<FullSettings>(DEFAULT_SETTINGS)
  const [hydrated, setHydrated] = useState(false)
  const [tracks, setTracks] = useState<CTrack[]>([])
  const [active, setActive] = useState(0)
  const [seek, setSeek] = useState<{ nonce: number; t: number } | null>(null)
  const [lib, setLib] = useState<{ songs: LibrarySong[]; error?: string } | null>(null)
  const [libOpen, setLibOpen] = useState(false)
  const [adding, setAdding] = useState('')
  const [presets, setPresets] = useState<Record<string, FullSettings>>({})
  const [presetName, setPresetName] = useState('')
  const [notice, setNotice] = useState('')
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [stalled, setStalled] = useState(false)
  const [result, setResult] = useState<{ url: string; name: string; seconds: number; width: number; height: number; bytes: number; audioCodec: string; saved: boolean; limited: number } | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'scene' | 'viz' | 'text' | 'lyrics' | 'export'>('scene')
  /** 카드에 마우스를 올린 동안만 미리보기에 덮어 보여 줄 설정 */
  const [hover, setHover] = useState<Partial<FullSettings> | null>(null)
  const [coverBmp, setCoverBmp] = useState<ImageBitmap | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastProgress = useRef(0)
  const wake = useRef<{ release: () => Promise<void> } | null>(null)

  // 개발 중에만: 브라우저 콘솔에서 템플릿 시트·렌더 검증을 돌릴 수 있게 노출
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    void Promise.all([import('@/lib/cinema/frame'), import('./thumbs'), import('@/lib/cinema/render'), import('./devSheet'), import('@/lib/cinema/spectrum')]).then(([f, t, r, d, sp]) => {
      ;(window as unknown as { __cinema: unknown }).__cinema = { TEMPLATES, VIZ_SHAPES, PALETTES, makeFrame: f.makeFrame, drawFrame: f.drawFrame, sampleBars: t.sampleBars, SAMPLE_LINES: t.SAMPLE_LINES, renderCinema: r.renderCinema, sheet: d.sheet, testWav: d.testWav, prepareScene: f.prepareScene, decodeToChannels: r.decodeToChannels, createSpectrumAnalyzer: sp.createSpectrumAnalyzer, resolvePalette }
    })
  }, [])
  useEffect(() => {
    setSettings(readLS(LS_SETTINGS, DEFAULT_SETTINGS))
    try { setPresets(JSON.parse(localStorage.getItem(LS_PRESETS) || '{}')) } catch {}
    setHydrated(true)
  }, [])
  useEffect(() => { if (hydrated) { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)) } catch {} } }, [settings, hydrated])
  const set = useCallback(<K extends keyof FullSettings>(k: K, v: FullSettings[K]) => setSettings(s => ({ ...s, [k]: v })), [])

  const palette = resolvePalette(settings)
  const rendering = !!progress && progress.phase !== undefined && !result && !error && !!abortRef.current

  // 썸네일에 쓸 커버: 첫 곡 커버(없으면 시드 그림)
  const first = tracks[0]
  useEffect(() => {
    let dead = false
    setCoverBmp(null)
    const p = first ? loadCoverBlob(first) : loadSampleCoverBlob('sea-sunset')
    p.then(b => b ? createImageBitmap(b) : null).then(b => { if (!dead) setCoverBmp(b) }).catch(() => {})
    return () => { dead = true }
  }, [first])

  const durations = tracks.map(t => t.duration)
  const baseSec = durations.reduce((a, b) => a + b, 0)
  const totalSec = baseSec * settings.loops
  const { w: outW, h: outH } = outputSize(settings.aspect, settings.shortSide)
  const sizeMb = estimateBytes(totalSec, outW, outH, settings.fps) / 1048576
  const canFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window

  const addTrack = async (base: Omit<CTrack, 'id' | 'duration' | 'lyrics'>, saved?: { t: number; text: string }[]) => {
    const t: CTrack = { ...base, id: newId(), duration: 0, lyrics: { lines: [], mode: 'none' } }
    setAdding(`「${t.title}」 길이를 재는 중…`)
    try {
      t.duration = await probeDuration(t)
      // 보관함의 「가사 시간 편집기」에서 맞춰 둔 시간표가 있으면 그대로 쓴다(정확)
      const ok = saved && saved.length > 0 && saved.every(l => typeof l.t === 'number' && l.t >= 0 && l.text)
      t.lyrics = ok ? { lines: saved!.map(l => ({ text: l.text, start: l.t })), mode: 'exact' } : initialLyrics(t.lyricsRaw, t.duration)
      setTracks(ts => [...ts, t])
    } catch { setNotice(`「${t.title}」 을(를) 불러오지 못했어요. 로그인과 파일 형식을 확인해 주세요.`) } finally { setAdding('') }
  }
  const addSong = (s: LibrarySong) => addTrack({ title: s.title || '제목 없음', song: s, lyricsRaw: s.lyrics ?? '' }, (s as LibrarySong & { form?: { lrc?: { t: number; text: string }[] } }).form?.lrc)
  const addFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) await addTrack({ title: f.name.replace(/\.[^.]+$/, ''), file: f, lyricsRaw: '' })
  }
  const openLib = async () => { setLibOpen(v => !v); if (!lib) setLib(await fetchLibrary()) }
  const move = (i: number, d: number) => setTracks(ts => { const a = [...ts], j = i + d; if (j < 0 || j >= a.length) return ts; [a[i], a[j]] = [a[j], a[i]]; return a })
  const remove = (i: number) => { setTracks(ts => ts.filter((_, k) => k !== i)); setActive(a => Math.max(0, Math.min(a, tracks.length - 2))) }
  const patchTrack = useCallback((id: string, p: Partial<CTrack>) => setTracks(ts => ts.map(t => (t.id === id ? { ...t, ...p } : t))), [])

  // 저장한 설정
  const savePreset = () => {
    const name = presetName.trim(); if (!name) return
    const next = { ...presets, [name]: { ...settings, headline: settings.headline } }
    setPresets(next); try { localStorage.setItem(LS_PRESETS, JSON.stringify(next)) } catch {}
    setPresetName(''); setNotice(`「${name}」 설정을 저장했어요.`)
  }
  const loadPreset = (name: string) => { const p = presets[name]; if (p) setSettings({ ...DEFAULT_SETTINGS, ...p }) }
  const delPreset = (name: string) => { const n = { ...presets }; delete n[name]; setPresets(n); try { localStorage.setItem(LS_PRESETS, JSON.stringify(n)) } catch {} }

  // 멈춤 감시: 진행이 20초 넘게 없으면 탭을 보이게 두라고 안내
  useEffect(() => {
    if (!rendering) { setStalled(false); return }
    const id = setInterval(() => setStalled(Date.now() - lastProgress.current > STALL_MS), 2000)
    return () => clearInterval(id)
  }, [rendering])

  const start = async () => {
    setError(''); setResult(null)
    if (!tracks.length) { setError('곡을 하나 이상 골라 주세요.'); return }
    if (!webCodecsSupported()) { setError('이 브라우저는 영상 만들기를 지원하지 않아요. 최신 크롬이나 엣지에서 열어 주세요.'); return }
    if (settings.kind === 'lyrics' && tracks.some(t => !t.lyrics.lines.length)) { setError('가사가 없는 곡이 있어요. 가사 탭에서 가사를 붙여 넣거나, 경음악 영상으로 바꿔 주세요.'); return }
    const name = (settings.name.trim() || tracks[0].title || '플레이리스트 영상').replace(/[\\/:*?"<>|]/g, '_')
    let fileStream: FileSystemWritableFileStream | undefined
    if (settings.saveMode === 'file' && canFilePicker) {
      try {
        const h = await (window as unknown as { showSaveFilePicker: (o: object) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }> })
          .showSaveFilePicker({ suggestedName: `${name}.mp4`, types: [{ description: 'MP4 영상', accept: { 'video/mp4': ['.mp4'] } }] })
        fileStream = await h.createWritable()
      } catch { return } // 취소
    } else if (sizeMb > 1200) {
      setError('영상이 너무 길어서 메모리에 담을 수 없어요. 「저장 위치」를 파일로 고르거나(크롬·엣지) 반복 횟수를 줄여 주세요.'); return
    }
    const ac = new AbortController(); abortRef.current = ac
    lastProgress.current = Date.now(); setStalled(false)
    setProgress({ phase: 'prepare', fraction: 0, message: '준비하고 있어요…', at: Date.now() })
    try { wake.current = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null } catch { wake.current = null }
    try {
      const inputs: CinemaTrackInput[] = []
      for (const t of tracks) inputs.push({ id: t.id, title: t.title, audio: await loadAudioBlob(t), cover: await loadCoverBlob(t), lyrics: t.lyrics, durationHint: t.duration })
      const r = await renderCinema({
        tracks: inputs, settings, fileStream, signal: ac.signal,
        onProgress: p => { lastProgress.current = Date.now(); setStalled(false); setProgress(p) },
      })
      const url = r.blob ? URL.createObjectURL(r.blob) : ''
      setResult({ url, name: `${name}.mp4`, seconds: r.seconds, width: r.width, height: r.height, bytes: r.bytes, audioCodec: r.audioCodec, saved: !!fileStream, limited: r.limitedTracks })
    } catch (e) {
      setError(e instanceof RenderAbort ? '만들기를 멈췄어요.' : (e instanceof Error && e.message) || '영상을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      abortRef.current = null; setProgress(null)
      try { await wake.current?.release() } catch {}
    }
  }
  useEffect(() => () => { abortRef.current?.abort() }, [])
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result])

  const needLyrics = settings.kind === 'lyrics'
  const lyricsBad = needLyrics && tracks.some(t => !t.lyrics.lines.length)

  const TABS = [['scene', '장면'], ['viz', '스펙트럼'], ['text', '글자'], ['lyrics', '가사'], ['export', '내보내기']] as const
  const previewSettings = hover ? { ...settings, ...hover } : settings

  return (
    <div className="p-3 md:p-4 cinema-root">
      <div className="flex flex-wrap items-center gap-x-2 mb-3">
        <Clapperboard className="w-5 h-5 text-emerald-300" />
        <h2 className="text-lg font-black text-white whitespace-nowrap">플레이리스트 영상</h2>
        <span className="text-xs text-zinc-400">재생목록을 한 편의 영상으로 만들어요. 바꾸는 즉시 미리보기에 보이고, 영상도 똑같이 나와요. 무료예요.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,62fr)_minmax(320px,38fr)] items-start">
        {/* 왼쪽: 늘 보이는 큰 미리보기 + 곡 띠 */}
        <div className="sticky top-0 z-20 min-w-0 space-y-2 bg-[#0d0f12] md:bg-transparent pb-2 md:pb-0">
          <CinemaPreview tracks={tracks} settings={previewSettings} index={Math.min(active, Math.max(0, tracks.length - 1))} onIndex={setActive} seekRequest={seek}
            onAspect={a => set('aspect', a)} />
          <div className="flex flex-wrap gap-1.5" data-testid="cinema-song-strip">
            {tracks.map((t, i) => (
              <button key={t.id} type="button" onClick={() => setActive(i)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs max-w-[220px] ${i === active ? 'border-emerald-400/70 bg-emerald-400/10 text-white' : 'border-white/10 text-zinc-300 hover:border-white/30'}`}>
                {t.song?.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.song.image_url} alt="" className="w-6 h-6 rounded object-cover" /> : <span className="w-6 h-6 rounded bg-white/10 grid place-items-center text-[10px] tabular-nums">{String(i + 1).padStart(2, '0')}</span>}
                <span className="truncate">{t.title}</span>
              </button>
            ))}
            <button type="button" onClick={() => setTab('lyrics')} className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-xs text-zinc-300 hover:border-white/40"><Plus className="w-3.5 h-3.5" />곡 추가</button>
          </div>
        </div>

        {/* 오른쪽: 설정 탭(패널 안에서만 스크롤), 맨 아래 「영상 만들기」 고정 */}
        <div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-low flex flex-col md:sticky md:top-0 md:h-[calc(100vh-21.5rem)] md:min-h-[480px]">
          <div className="flex flex-wrap border-b border-white/10 px-1" role="tablist" aria-label="설정">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 -mb-px ${tab === id ? 'border-emerald-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}>{label}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div hidden={tab !== 'scene'} className="space-y-3">
              <div className="flex gap-2">
                <button type="button" className={chip(settings.kind === 'lyrics')} onClick={() => set('kind', 'lyrics')}>가사 영상</button>
                <button type="button" className={chip(settings.kind === 'instrumental')} onClick={() => set('kind', 'instrumental')}>경음악 영상</button>
              </div>
              <p className="text-[11px] text-zinc-500">{needLyrics ? '싱크 가사를 화면에 띄워요. 가사 시간이 없으면 길이 비례로 추정해 「가사 시간 추정」을 표시해요.' : '가사 없이 커버와 음악 반응 화면만 보여 줘요.'}</p>
              <p className="text-[11px] text-zinc-500">카드에 마우스를 올리면 미리보기에서 잠깐 보여 주고, 누르면 바뀌어요.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="장면 템플릿">
              {TEMPLATES.map(t => (
                <button key={t.id} type="button" role="radio" aria-checked={settings.templateId === t.id}
                  onClick={() => { setHover(null); setSettings(s => ({ ...s, templateId: t.id, shape: s.templateId === t.id ? s.shape : t.defaultShape })) }}
                  onMouseEnter={() => setHover({ templateId: t.id, shape: settings.templateId === t.id ? settings.shape : t.defaultShape })} onMouseLeave={() => setHover(null)}
                  className={`text-left rounded-lg overflow-hidden border-2 transition-colors ${settings.templateId === t.id ? 'border-emerald-400' : 'border-transparent hover:border-white/30'} bg-black/30`}>
                  <TemplateThumb templateId={t.id} shape={t.id === settings.templateId ? settings.shape : t.defaultShape} palette={palette} cover={coverBmp} kind={settings.kind} title={first?.title ?? ''} className="w-full block aspect-video" />
                  <div className="px-2 py-1.5"><div className="text-xs font-bold text-white truncate">{t.name}</div><div className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{t.blurb}</div></div>
                </button>
              ))}
            </div>

            </div>

            <div hidden={tab !== 'viz'} className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">형태</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="스펙트럼 형태">
              {VIZ_SHAPES.map(v => (
                <button key={v.id} type="button" role="radio" aria-checked={settings.shape === v.id} onClick={() => { setHover(null); set('shape', v.id) }} onMouseEnter={() => setHover({ shape: v.id })} onMouseLeave={() => setHover(null)}
                  className={`relative rounded-lg border-2 p-1 bg-black/40 ${settings.shape === v.id ? 'border-emerald-400' : 'border-transparent hover:border-white/30'}`}>
                  <VizThumb shape={v.id} palette={palette} className="w-full block aspect-video" />
                  <div className="text-[11px] text-zinc-200 text-center pb-0.5">{v.name}</div>
                  {v.recommended && <span className="absolute top-1 right-1 text-[9px] font-bold px-1 rounded bg-emerald-400 text-black">추천</span>}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">형태 예시 · 영상에서는 실제 음악에 반응합니다</p>

            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-300">색상</h4>
              <select value={settings.colorMode === 'solid' || settings.colorMode === 'gradient' ? settings.colorMode : settings.paletteId === 'rainbow' ? 'rainbow' : 'palette'}
                onChange={e => { const v = e.target.value; setSettings(s => v === 'rainbow' ? { ...s, colorMode: 'palette', paletteId: 'rainbow' } : { ...s, colorMode: v as 'palette' | 'solid' | 'gradient' }) }}
                className="sel-cin" aria-label="색상 방식">
                <option value="rainbow">레인보우</option>
                <option value="palette">팔레트</option>
                <option value="solid">단색</option>
                <option value="gradient">그라데이션</option>
              </select>
              {(settings.colorMode === 'solid' || settings.colorMode === 'gradient') && (
                <>
                  <input type="color" value={settings.customColors?.[0] ?? '#f2d6a8'} onChange={e => setSettings(s => ({ ...s, customColors: [e.target.value, s.customColors?.[1] ?? '#7aa7ff'] }))} className="h-7 w-10 rounded border border-white/15 bg-transparent" aria-label={settings.colorMode === 'solid' ? '색' : '시작 색'} />
                  {settings.colorMode === 'gradient' && <input type="color" value={settings.customColors?.[1] ?? '#7aa7ff'} onChange={e => setSettings(s => ({ ...s, customColors: [s.customColors?.[0] ?? '#f2d6a8', e.target.value] }))} className="h-7 w-10 rounded border border-white/15 bg-transparent" aria-label="끝 색" />}
                </>
              )}
            </div>
            {(settings.colorMode ?? 'palette') === 'palette' && <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="색상">
              {PALETTES.map(p => (
                <button key={p.id} type="button" role="radio" aria-checked={settings.paletteId === p.id} onClick={() => set('paletteId', p.id)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 ${settings.paletteId === p.id ? 'border-emerald-400' : 'border-white/10 hover:border-white/30'}`}>
                  <span className="w-10 h-4 rounded" style={{ background: `linear-gradient(90deg, ${p.colors.join(',')})` }} />
                  <span className="text-xs text-zinc-200">{p.name}</span>
                </button>
              ))}
            </div>}
            </div>

            <div hidden={tab !== 'text'} className="space-y-3">
              <label className="fld-cin"><span>타이틀 문구 <em>(다음 영상에도 유지돼요)</em></span><input value={settings.headline} onChange={e => set('headline', e.target.value)} placeholder="화면 위쪽에 작게 들어가요 (예: COOKIEMUSIC)" maxLength={40} className="inp-cin" /></label>
              <div className="fld-cin"><span>글꼴 <em>(실사 장면 템플릿의 제목·가사)</em></span>
                <div className="flex flex-wrap gap-1.5">{FONT_STYLES.map(([id, label]) => <button key={id} type="button" className={chip((settings.fontStyle ?? 'auto') === id)} onClick={() => set('fontStyle', id)}>{label}</button>)}</div>
              </div>
              <div className="fld-cin"><span>가사 표시 방식</span>
                <div className="flex flex-wrap gap-1.5">{LYRIC_LINES.map(([id, label]) => <button key={id} type="button" className={chip((settings.lyricLines ?? 'auto') === id)} onClick={() => set('lyricLines', id)}>{label}</button>)}</div>
              </div>
            </div>

            <div hidden={tab !== 'lyrics'} className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-300">곡 순서</h4>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openLib} className="btn-cin"><Library className="w-3.5 h-3.5" />보관함에서 고르기</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-cin"><FileAudio className="w-3.5 h-3.5" />내 파일 추가</button>
              <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={e => { void addFiles(e.target.files); e.target.value = '' }} data-testid="cinema-file" />
            </div>
            {adding && <p className="text-xs text-zinc-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />{adding}</p>}
            {libOpen && (
              <div className="rounded-lg border border-white/10 max-h-56 overflow-y-auto divide-y divide-white/5">
                {!lib && <p className="p-3 text-xs text-zinc-500">불러오는 중…</p>}
                {lib?.error && <p className="p-3 text-xs text-amber-300">{lib.error}</p>}
                {lib && !lib.error && lib.songs.length === 0 && <p className="p-3 text-xs text-zinc-500">보관함에 곡이 없어요.</p>}
                {lib?.songs.map(s => (
                  <button key={s.id} type="button" onClick={() => void addSong(s)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5">
                    {s.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-white/10" />}
                    <span className="flex-1 truncate text-sm text-zinc-100">{s.title || '제목 없음'}</span>
                    <Plus className="w-4 h-4 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
            {tracks.length === 0 ? <p className="text-xs text-zinc-500">아직 곡이 없어요. 위에서 곡을 추가해 주세요.</p> : (
              <ol className="space-y-1" data-testid="cinema-tracks">
                {tracks.map((t, i) => (
                  <li key={t.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${i === active ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-white/10'}`}>
                    <button type="button" onClick={() => setActive(i)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                      <span className="text-xs tabular-nums text-zinc-500 w-5">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate text-sm text-zinc-100">{t.title}</span>
                      <span className="text-xs text-zinc-500 tabular-nums">{formatClock(t.duration)}</span>
                    </button>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-25" aria-label="위로"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === tracks.length - 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-25" aria-label="아래로"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-white/10" aria-label="빼기"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ol>
            )}
              {needLyrics && tracks.length > 0 && (
                <>
                  <h4 className="text-xs font-bold text-zinc-300 pt-2">가사 시간 확인</h4>
                  <LyricsStep tracks={tracks} active={Math.min(active, tracks.length - 1)} onActive={setActive} onChange={patchTrack} onSeek={(i, t) => { setActive(i); setSeek({ nonce: Date.now(), t }) }} />
                </>
              )}
            </div>

            <div hidden={tab !== 'export'} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value="" onChange={e => { if (e.target.value) loadPreset(e.target.value) }} className="sel-cin" aria-label="저장한 설정 불러오기">
                <option value="">저장한 설정 불러오기{Object.keys(presets).length ? '' : ' (없음)'}</option>
                {Object.keys(presets).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {Object.keys(presets).includes(presetName) && <button type="button" onClick={() => delPreset(presetName)} className="btn-cin"><Trash2 className="w-3.5 h-3.5" />삭제</button>}
              <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="설정 이름" className="inp-cin w-32" aria-label="저장할 설정 이름" list="cinema-presets" />
              <datalist id="cinema-presets">{Object.keys(presets).map(n => <option key={n} value={n} />)}</datalist>
              <button type="button" disabled={!presetName.trim()} onClick={savePreset} className="btn-cin"><Save className="w-3.5 h-3.5" />현재 설정 저장</button>
            </div>
            <div className="grid gap-3">
              <label className="fld-cin"><span>영상 이름</span><input value={settings.name} onChange={e => set('name', e.target.value)} placeholder="비워 두면 첫 곡 제목" className="inp-cin" /></label>
            </div>
            <div className="grid gap-3">
              <div className="fld-cin"><span>화면 비율</span><div className="flex flex-wrap gap-1.5">{ASPECTS.map(a => <button key={a.id} type="button" className={chip(settings.aspect === a.id)} onClick={() => set('aspect', a.id)}>{a.label}</button>)}</div></div>
              <div className="fld-cin"><span>해상도</span><div className="flex flex-wrap gap-1.5">{RESOLUTIONS.map(r => <button key={r.id} type="button" className={chip(settings.shortSide === r.id)} onClick={() => set('shortSide', r.id)}>{r.label}</button>)}</div></div>
              <div className="fld-cin"><span>프레임</span><div className="flex gap-1.5">{FPS_OPTIONS.map(f => <button key={f} type="button" className={chip(settings.fps === f)} onClick={() => set('fps', f)}>{f}fps</button>)}</div></div>
              <div className="fld-cin"><span>파일 형식 · 코덱</span><div className="text-xs text-zinc-300 py-1.5">MP4 · H.264 (소리는 AAC, 안 되는 기기는 Opus)</div></div>
              <div className="fld-cin"><span>전체 반복 횟수</span>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={50} value={settings.loops} onChange={e => set('loops', Math.max(1, Math.min(50, Math.round(Number(e.target.value)) || 1)))} className="inp-cin w-20" aria-label="전체 반복 횟수" />
                  <span className="text-[11px] text-zinc-500">원래 길이 {formatClock(baseSec)} · 반복 적용 {formatClock(totalSec)}</span>
                </div>
              </div>
              <label className="fld-cin"><span>곡 음량 맞추기</span>
                <select value={String(settings.lufsTarget)} onChange={e => set('lufsTarget', e.target.value === 'null' ? null : Number(e.target.value))} className="sel-cin">
                  {LUFS_OPTIONS.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                </select>
              </label>
              <label className="fld-cin"><span>저장 위치</span>
                <select value={settings.saveMode === 'file' && canFilePicker ? 'file' : 'download'} onChange={e => set('saveMode', e.target.value as 'file' | 'download')} className="sel-cin">
                  <option value="download">내려받기 (브라우저 다운로드 폴더)</option>
                  {canFilePicker && <option value="file">파일로 직접 저장 (위치 고르기 · 긴 영상에 알맞아요)</option>}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">{outW}×{outH} · {settings.fps}fps · 예상 용량 약 {sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(1)}GB` : `${Math.max(1, Math.round(sizeMb))}MB`}</p>
            </div>
          </div>
          <div className="border-t border-white/10 p-3 space-y-2">
            {lyricsBad && <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />가사가 없는 곡이 있어요. 가사 확인에서 채우거나 경음악 영상으로 바꿔 주세요.</p>}
            {!rendering ? (
              <button type="button" onClick={() => void start()} disabled={!tracks.length || !hydrated} className="px-5 py-2.5 rounded-lg font-bold text-sm text-black bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40" data-testid="cinema-start">
                영상 만들기 · {formatClock(totalSec)}
              </button>
            ) : (
              <div className="space-y-2" data-testid="cinema-progress">
                <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }} /></div>
                <p className="text-xs text-zinc-300">{progress?.message} · {Math.round((progress?.fraction ?? 0) * 100)}%</p>
                {stalled && <p className="text-xs text-amber-300">진행이 멈춘 것 같아요. 이 탭을 화면에 보이게 두면 다시 움직여요. (다른 탭에 가려지면 브라우저가 작업을 늦출 수 있어요)</p>}
                <button type="button" onClick={() => abortRef.current?.abort()} className="btn-cin">멈추기</button>
              </div>
            )}
            {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
            {result && (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 p-3 space-y-2" data-testid="cinema-result">
                <p className="text-sm text-white font-bold">영상이 완성됐어요</p>
                <p className="text-xs text-zinc-300">{result.name} · {result.width}×{result.height} · {formatClock(result.seconds)} · {result.audioCodec === 'aac' ? 'AAC' : 'Opus'} 소리{result.bytes ? ` · ${(result.bytes / 1048576).toFixed(1)}MB` : ''}</p>
                {result.limited > 0 && <p className="text-[11px] text-zinc-500">소리가 커서 목표 음량까지 못 올린 곡이 {result.limited}곡 있어요(찌그러지지 않게 둠).</p>}
                {result.saved ? <p className="text-xs text-emerald-300">고른 위치에 저장했어요.</p> : (
                  <>
                    <video src={result.url} controls className="w-full max-h-80 rounded bg-black" data-testid="cinema-video" />
                    <a href={result.url} download={result.name} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-sm font-bold"><Download className="w-4 h-4" />내려받기</a>
                  </>
                )}
              </div>
            )}
            {notice && <p className="text-xs text-zinc-400">{notice}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
