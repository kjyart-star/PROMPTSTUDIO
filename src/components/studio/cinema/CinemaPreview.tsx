'use client'
/**
 * 실시간 미리보기 — 내보내기와 같은 draw(makeFrame/drawFrame)·같은 스펙트럼 분석을 쓴다.
 * 소리는 디코드한 버퍼를 AudioBufferSource 로 재생해 화면 시계를 오디오 시계에 맞춘다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { decodeToChannels, type CinemaSettings } from '@/lib/cinema/render'
import { createSpectrumAnalyzer, type SpectrumAnalyzer } from '@/lib/cinema/spectrum'
import { resolvePalette } from '@/lib/cinema/palettes'
import { makeFrame, drawFrame, prepareScene } from '@/lib/cinema/frame'
import { ASPECTS } from '@/lib/cinema/types'
import { formatClock } from '@/lib/cinema/output'
import { loadAudioBlob, loadCoverBlob, loadSampleCoverBlob, type CTrack } from './model'
import { SAMPLE_LINES, sampleBars } from './thumbs'
import { EditOverlay, type AdjustPhase } from './EditOverlay'
import type { Box, ElAdjust, ElKey } from '@/lib/cinema/types'

interface Loaded { id: string; channels: Float32Array[]; spec: SpectrumAnalyzer; cover: ImageBitmap | null }

const QUICK_ASPECTS = ['16:9', '9:16', '1:1'] as const

export function CinemaPreview({ tracks, settings, index, onIndex, seekRequest, onAspect, selected = null, onSelect, onAdjust }: {
  tracks: CTrack[]; settings: CinemaSettings; index: number; onIndex: (i: number) => void
  /** 직접 편집: 고른 요소, 고르기·풀기, 조정값 바꾸기(끄면 편집 없음) */
  selected?: ElKey | null
  onSelect?: (k: ElKey | null) => void
  onAdjust?: (k: ElKey, adj: ElAdjust, phase: AdjustPhase) => void
  /** 미리보기 위 비율 전환(16:9·9:16·1:1) */
  onAspect?: (a: CinemaSettings['aspect']) => void
  /** 가사 확인 단계에서 특정 시각으로 보내고 싶을 때(nonce 로 같은 값 재요청 가능) */
  seekRequest?: { nonce: number; t: number } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const track = tracks[index] ?? null
  const ctxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const startRef = useRef({ at: 0, offset: 0 })
  const posRef = useRef(0)
  const loadedRef = useRef<Loaded | null>(null)
  const settingsRef = useRef(settings); settingsRef.current = settings
  const trackRef = useRef(track); trackRef.current = track
  const indexRef = useRef(index)
  indexRef.current = index
  const tracksRef = useRef(tracks); tracksRef.current = tracks

  const aspect = ASPECTS.find(a => a.id === settings.aspect)?.ratio ?? 16 / 9
  // 표시 크기 × 기기 픽셀 비율로 그린다(늘려 보여 주면 글자·파형이 뭉개진다). 세로로 긴 비율은 화면 높이의 72% 까지만
  const boxRef = useRef<HTMLDivElement>(null)
  const [disp, setDisp] = useState({ w: 960, h: 540, dpr: 1 })
  const [full, setFull] = useState(false)
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const measure = () => {
      const isFull = typeof document !== 'undefined' && document.fullscreenElement === el
      setFull(isFull)
      const cw = (el.clientWidth || 960) - (isFull ? 0 : 24)
      const maxH = isFull ? window.innerHeight - 110 : Math.max(200, window.innerHeight * (window.innerWidth < 768 ? 0.4 : 0.55))
      const w = Math.min(cw, maxH * aspect), h = w / aspect
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      setDisp(d => (Math.abs(d.w - w) < 1 && Math.abs(d.h - h) < 1 && d.dpr === dpr ? d : { w, h, dpr }))
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el); window.addEventListener('resize', measure); document.addEventListener('fullscreenchange', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); document.removeEventListener('fullscreenchange', measure) }
  }, [aspect])
  const k = Math.min(1, 2560 / Math.max(disp.w * disp.dpr, disp.h * disp.dpr))
  const W = Math.max(2, Math.round(disp.w * disp.dpr * k)), H = Math.max(2, Math.round(disp.h * disp.dpr * k))

  // 곡이 없을 때 보여 줄 예시 화면(예시 커버·예시 가사)
  const demoRef = useRef<ImageBitmap | null>(null)
  /** 마지막으로 그린 프레임의 요소 박스(캔버스 픽셀) — 선택·드래그용 */
  const hitsRef = useRef<Partial<Record<ElKey, Box>> | null>(null)
  const draw = useCallback((t: number) => {
    const c = canvasRef.current, tr = trackRef.current, L = loadedRef.current
    if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const s = settingsRef.current
    if (!tr) {
      const f = makeFrame({
        w: c.width, h: c.height, t: 7.4, trackIndex: 0, trackCount: 3, title: '여름밤의 노래', headline: s.headline, coverSeed: 'demo',
        cover: demoRef.current, kind: s.kind, lyrics: { lines: SAMPLE_LINES, mode: 'exact' }, duration: 200, bars: sampleBars(1.3), level: 0.5,
        shape: s.shape, palette: resolvePalette(s), fontStyle: s.fontStyle, lyricLines: s.lyricLines, layout: s.layouts?.[s.templateId], hits: {},
      })
      drawFrame(ctx, s.templateId, f)
      hitsRef.current = f.hits ?? null
      return
    }
    const sp = L && L.id === tr.id ? L.spec.at(t) : { bars: new Float32Array(64).fill(0.08), level: 0 }
    const f = makeFrame({
      w: c.width, h: c.height, t, trackIndex: indexRef.current, trackCount: tracksRef.current.length, title: tr.title, headline: s.headline,
      coverSeed: tr.id + tr.title, cover: L && L.id === tr.id ? L.cover : null, kind: s.kind, lyrics: tr.lyrics, duration: tr.duration,
      bars: sp.bars, level: sp.level, shape: s.shape, palette: resolvePalette(s), fontStyle: s.fontStyle, lyricLines: s.lyricLines, layout: s.layouts?.[s.templateId], hits: {},
    })
    drawFrame(ctx, s.templateId, f)
    hitsRef.current = f.hits ?? null
  }, [])

  const stop = useCallback(() => {
    try { srcRef.current?.stop() } catch {}
    srcRef.current = null
    setPlaying(false)
  }, [])

  const playFrom = useCallback((offset: number) => {
    const L = loadedRef.current, tr = trackRef.current
    if (!L || !tr || L.id !== tr.id) return
    const ac = ctxRef.current ?? (ctxRef.current = new AudioContext({ sampleRate: 48000 }))
    void ac.resume()
    try { srcRef.current?.stop() } catch {}
    const buf = ac.createBuffer(2, L.channels[0].length, 48000)
    buf.copyToChannel(L.channels[0] as Float32Array<ArrayBuffer>, 0); buf.copyToChannel(L.channels[1] as Float32Array<ArrayBuffer>, 1)
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination)
    const off = Math.max(0, Math.min(offset, buf.duration - 0.05))
    src.start(0, off)
    startRef.current = { at: ac.currentTime, offset: off }
    L.spec.reset()
    src.onended = () => { if (srcRef.current === src) { srcRef.current = null; if (posRef.current >= buf.duration - 0.3) { const n = indexRef.current + 1; if (n < tracksRef.current.length) { onIndex(n); setAutoPlay(true) } else { setPlaying(false); posRef.current = 0; setPos(0); draw(0) } } } }
    srcRef.current = src
    setPlaying(true)
  }, [draw, onIndex])

  const [autoPlay, setAutoPlay] = useState(false)

  // 곡이 바뀌면 소리·커버를 불러온다
  useEffect(() => {
    stop(); posRef.current = 0; setPos(0); setError('')
    loadedRef.current = null; setLoaded(null)
    if (!track) {
      draw(0)
      if (!demoRef.current) void loadSampleCoverBlob(0).then(b => (b ? createImageBitmap(b) : null)).then(bm => { if (bm) { demoRef.current = bm; if (!trackRef.current) draw(0) } }).catch(() => {})
      return
    }
    let dead = false
    setLoading(true)
    ;(async () => {
      try {
        const [blob, cb] = await Promise.all([loadAudioBlob(track), loadCoverBlob(track)])
        const channels = await decodeToChannels(blob)
        const cover = cb ? await createImageBitmap(cb).catch(() => null) : null
        if (dead) return
        const L: Loaded = { id: track.id, channels, spec: createSpectrumAnalyzer(channels, 48000), cover }
        loadedRef.current = L; setLoaded(L)
        draw(0)
        if (autoPlay) { setAutoPlay(false); playFrom(0) }
      } catch (e) { if (!dead) setError(e instanceof Error && e.message ? '곡을 불러오지 못했어요. 로그인과 인터넷 연결을 확인해 주세요.' : '곡을 불러오지 못했어요.') }
      finally { if (!dead) setLoading(false) }
    })()
    return () => { dead = true; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id])

  // 그림 루프(오디오 시계 기준)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const ac = ctxRef.current
      if (srcRef.current && ac) {
        const t = startRef.current.offset + (ac.currentTime - startRef.current.at)
        posRef.current = t; setPos(t); draw(t)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [draw])

  // 설정·가사가 바뀌면 멈춘 상태에서도 다시 그린다
  useEffect(() => { if (!srcRef.current) draw(posRef.current) }, [settings, track, loaded, draw, W, H])

  // 장면 템플릿의 배경 사진·서체를 불러오면 다시 그린다
  const sceneText = track ? track.title + settings.headline + track.lyrics.lines.map(l => l.text).join('') : settings.headline
  useEffect(() => {
    let dead = false
    void prepareScene(settings.templateId, sceneText, !!settings.fontStyle && settings.fontStyle !== 'auto').then(() => { if (!dead && !srcRef.current) draw(posRef.current) })
    return () => { dead = true }
  }, [settings.templateId, settings.fontStyle, sceneText, draw])

  useEffect(() => {
    if (!seekRequest || !track) return
    const t = Math.max(0, seekRequest.t)
    posRef.current = t; setPos(t)
    if (srcRef.current) playFrom(t); else draw(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRequest?.nonce])

  useEffect(() => () => { try { srcRef.current?.stop() } catch {}; void ctxRef.current?.close() }, [])

  const toggle = () => { if (playing) { stop() } else playFrom(posRef.current >= (track?.duration ?? 0) - 0.3 ? 0 : posRef.current) }
  const seek = (t: number) => { posRef.current = t; setPos(t); if (playing) playFrom(t); else draw(t) }

  return (
    <div className={`rounded-xl border border-outline-variant bg-black/40 p-3 ${full ? 'flex flex-col justify-center bg-black' : ''}`} ref={boxRef}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {onAspect && QUICK_ASPECTS.map(a => (
          <button key={a} type="button" onClick={() => onAspect(a)} aria-pressed={settings.aspect === a}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${settings.aspect === a ? 'bg-white text-black border-white' : 'border-white/15 text-zinc-300 hover:border-white/40'}`}>{a}</button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={() => { const el = boxRef.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.() }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border border-white/15 text-zinc-300 hover:border-white/40">
          {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}{full ? '전체 화면 닫기' : '전체 화면 보기'}
        </button>
      </div>
      <div className="relative mx-auto bg-black rounded-lg overflow-hidden" style={{ width: disp.w, height: disp.h }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full h-full block" data-testid="cinema-preview-canvas" />
        {onSelect && onAdjust && <EditOverlay hitsRef={hitsRef} canvasW={W} canvasH={H} selected={selected} layout={settings.layouts?.[settings.templateId] ?? {}} onSelect={onSelect} onAdjust={onAdjust} />}
        {!track && <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-zinc-200">예시 화면이에요. 곡을 추가하면 실제 음악으로 재생돼요.</div>}
        {loading && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="w-6 h-6 animate-spin text-zinc-300" /></div>}
        {error && <div className="absolute inset-x-0 bottom-0 bg-red-950/80 text-red-200 text-xs px-3 py-2">{error}</div>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
        <button type="button" disabled={index <= 0} onClick={() => onIndex(index - 1)} className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30" aria-label="이전 곡"><SkipBack className="w-4 h-4" /></button>
        <button type="button" disabled={!loaded} onClick={toggle} className="p-2 rounded-full bg-white text-black disabled:opacity-40" aria-label={playing ? '일시정지' : '재생'}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button type="button" disabled={index >= tracks.length - 1} onClick={() => onIndex(index + 1)} className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30" aria-label="다음 곡"><SkipForward className="w-4 h-4" /></button>
        <span className="tabular-nums w-10 text-right">{formatClock(pos)}</span>
        <input type="range" min={0} max={Math.max(1, track?.duration ?? 1)} step={0.1} value={Math.min(pos, track?.duration ?? 1)} onChange={e => seek(Number(e.target.value))} className="flex-1 accent-emerald-400" aria-label="재생 위치" />
        <span className="tabular-nums w-10">{formatClock(track?.duration ?? 0)}</span>
      </div>
      {!full && <p className="mt-1 text-[11px] text-zinc-500">화면의 글자·커버·스펙트럼을 눌러 고르고 끌어서 옮겨요. 모서리를 끌면 크기가 바뀌어요. 실제 음원을 분석해 그리고, 미리보기 소리는 음량 맞추기 전 소리예요.</p>}
    </div>
  )
}
