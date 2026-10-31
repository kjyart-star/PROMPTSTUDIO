/**
 * 플레이리스트 시네마 내보내기 — 전부 브라우저에서(서버 렌더 없음, 비용 0원).
 *  - 곡을 한 곡씩 디코드 → 프레임 그리기(미리보기와 같은 draw) → VideoEncoder(H.264) / AudioEncoder(AAC, 없으면 Opus)
 *  - 먹싱: mp4-muxer(MIT). 파일 저장 위치를 고르면 디스크로 바로 흘려 써서 메모리에 전 구간을 쌓지 않는다.
 *  - 가려진 탭: rAF 를 쓰지 않고 인코더 큐 신호(dequeue)로만 진행하므로 멈추지 않는다.
 */
import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from 'mp4-muxer'
import { ASPECTS, type FontStyle, type Layout, type LyricLines, type VizShapeId } from './types'
import { resolvePalette, type ColorMode } from './palettes'
import { createSpectrumAnalyzer } from './spectrum'
import { gainToTarget } from './loudness'
import type { CinemaLyrics } from './lyrics'
import { makeFrame, drawFrame, prepareScene } from './frame'
import { avcCodecString, outputSize, videoBitrate, type ShortSide } from './output'

export interface CinemaTrackInput {
  id: string
  title: string
  audio: Blob
  cover: Blob | null
  lyrics: CinemaLyrics
  /** 디코드 전에 아는 길이(진행률 표시용 힌트) */
  durationHint: number
}

export interface CinemaSettings {
  aspect: (typeof ASPECTS)[number]['id']
  shortSide: ShortSide
  fps: number
  loops: number
  lufsTarget: number | null
  templateId: string
  shape: VizShapeId
  paletteId: string
  /** 색상 방식(없으면 팔레트). 단색·그라데이션은 customColors 를 쓴다 */
  colorMode?: ColorMode
  customColors?: string[]
  /** 글꼴(실사 장면 템플릿 제목·가사, 가사는 전 템플릿) */
  fontStyle?: FontStyle
  /** 가사 표시 줄 수 */
  lyricLines?: LyricLines
  /** 템플릿별 요소 조정값(미리보기에서 직접 옮기고 키운 값) */
  layouts?: Record<string, Layout>
  headline: string
  kind: 'lyrics' | 'instrumental'
}

export interface RenderProgress {
  phase: 'prepare' | 'render' | 'finish'
  /** 0..1 */
  fraction: number
  message: string
  /** 마지막으로 진행이 일어난 시각(ms) — 화면에서 멈춤 감지에 쓴다 */
  at: number
}

export interface RenderResult {
  blob: Blob | null
  seconds: number
  width: number
  height: number
  bytes: number
  audioCodec: 'aac' | 'opus'
  /** 피크 때문에 목표 음량까지 못 올린 곡 수 */
  limitedTracks: number
}

export class RenderAbort extends Error { constructor() { super('취소했어요.') } }

export function webCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof AudioData !== 'undefined'
}

const SR = 48000

export async function decodeToChannels(blob: Blob): Promise<Float32Array[]> {
  const buf = await blob.arrayBuffer()
  const ctx = new OfflineAudioContext(2, 1, SR)
  const ab = await ctx.decodeAudioData(buf)
  const l = ab.getChannelData(0)
  const r = ab.numberOfChannels > 1 ? ab.getChannelData(1) : l.slice()
  return [l, r]
}

function waitDequeue(enc: { addEventListener: (t: 'dequeue', cb: () => void, o?: { once: boolean }) => void }): Promise<void> {
  return new Promise(res => enc.addEventListener('dequeue', () => res(), { once: true }))
}

function makeCanvas(w: number, h: number): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    return { canvas, ctx: canvas.getContext('2d') as unknown as CanvasRenderingContext2D }
  }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  return { canvas, ctx: canvas.getContext('2d')! }
}

export async function renderCinema(o: {
  tracks: CinemaTrackInput[]
  settings: CinemaSettings
  /** 저장 위치를 골랐다면 그 파일 스트림(메모리에 쌓지 않음) */
  fileStream?: FileSystemWritableFileStream
  onProgress: (p: RenderProgress) => void
  signal: AbortSignal
}): Promise<RenderResult> {
  if (!webCodecsSupported()) throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 최신 크롬이나 엣지에서 열어 주세요.')
  const { tracks, settings: s, signal } = o
  if (!tracks.length) throw new Error('곡을 하나 이상 골라 주세요.')
  const { w, h } = outputSize(s.aspect, s.shortSide)
  const palette = resolvePalette(s)
  const fps = s.fps
  const frameUs = 1e6 / fps
  const progress = (phase: RenderProgress['phase'], fraction: number, message: string) => o.onProgress({ phase, fraction: Math.min(1, Math.max(0, fraction)), message, at: Date.now() })
  progress('prepare', 0, '준비하고 있어요…')

  const vCodec = avcCodecString(w, h, fps)
  const vcfg: VideoEncoderConfig = { codec: vCodec, width: w, height: h, framerate: fps, bitrate: videoBitrate(w, h, fps), latencyMode: 'quality', avc: { format: 'avc' } }
  const vs = await VideoEncoder.isConfigSupported(vcfg)
  if (!vs.supported) throw new Error(`이 기기에서는 ${w}×${h} ${fps}프레임 영상을 만들 수 없어요. 해상도나 프레임을 낮춰 보세요.`)
  let audioCodec: 'aac' | 'opus' = 'aac'
  let acfg: AudioEncoderConfig = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192000 }
  if (!(await AudioEncoder.isConfigSupported(acfg)).supported) {
    audioCodec = 'opus'
    acfg = { codec: 'opus', sampleRate: SR, numberOfChannels: 2, bitrate: 160000 }
    if (!(await AudioEncoder.isConfigSupported(acfg)).supported) throw new Error('이 기기에서는 소리를 영상에 넣을 수 없어요. 다른 브라우저에서 열어 주세요.')
  }

  const memTarget = o.fileStream ? null : new ArrayBufferTarget()
  const muxer = new Muxer({
    target: o.fileStream ? new FileSystemWritableFileStreamTarget(o.fileStream, { chunkSize: 8 * 1024 * 1024 }) : memTarget!,
    video: { codec: 'avc', width: w, height: h, frameRate: fps },
    audio: { codec: audioCodec, numberOfChannels: 2, sampleRate: SR },
    fastStart: o.fileStream ? false : 'in-memory',
    firstTimestampBehavior: 'strict',
  })
  let encError: Error | null = null
  const venc = new VideoEncoder({
    output: (c, m) => muxer.addVideoChunk(c, m),
    error: e => { encError = new Error(`영상 인코딩 중 오류가 났어요: ${e.message}`) },
  })
  venc.configure(vcfg)
  const aenc = new AudioEncoder({
    output: (c, m) => muxer.addAudioChunk(c, m),
    error: e => { encError = new Error(`소리 인코딩 중 오류가 났어요: ${e.message}`) },
  })
  aenc.configure(acfg)

  const { canvas, ctx } = makeCanvas(w, h)
  const hintTotal = tracks.reduce((a, t) => a + (t.durationHint || 180), 0) * s.loops
  let doneSec = 0
  let globalFrame = 0
  let audioSamples = 0
  let limitedTracks = 0
  const gainCache = new Map<string, { gain: number; limited: boolean }>()
  const covers = new Map<string, ImageBitmap | null>()
  const check = () => { if (signal.aborted) throw new RenderAbort(); if (encError) throw encError }

  try {
    for (const t of tracks) {
      let bmp: ImageBitmap | null = null
      if (t.cover) { try { bmp = await createImageBitmap(t.cover) } catch { bmp = null } }
      covers.set(t.id, bmp)
    }
    // 배경 사진·서체를 다 불러 둔 뒤 그린다(미리보기와 같은 화면)
    await prepareScene(s.templateId, [s.headline, ...tracks.map(t => t.title + t.lyrics.lines.map(l => l.text).join(''))].join(''), !!s.fontStyle && s.fontStyle !== 'auto')
    for (let loop = 0; loop < s.loops; loop++) {
      for (let ti = 0; ti < tracks.length; ti++) {
        check()
        const tr = tracks[ti]
        progress('render', doneSec / hintTotal, `${ti + 1}/${tracks.length}번째 곡 소리를 읽고 있어요…`)
        const ch = await decodeToChannels(tr.audio)
        let gain = 1
        if (s.lufsTarget !== null) {
          let g = gainCache.get(tr.id)
          if (!g) { const r = gainToTarget(ch, SR, s.lufsTarget); g = { gain: r.gain, limited: r.limited }; gainCache.set(tr.id, g); if (r.limited) limitedTracks++ }
          gain = g.gain
        }
        if (gain !== 1) for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= gain
        const dur = ch[0].length / SR
        const nFrames = Math.max(1, Math.ceil(dur * fps))
        const audioTotal = Math.round(nFrames * SR / fps)
        const spec = createSpectrumAnalyzer(ch, SR)
        const cover = covers.get(tr.id) ?? null
        let nextAudio = 0
        const sendAudioUpTo = (upto: number) => {
          while (nextAudio < upto) {
            const n = Math.min(SR, upto - nextAudio) // 1초 단위
            const data = new Float32Array(n * 2)
            for (let c = 0; c < 2; c++) {
              const src = ch[c]
              for (let i = 0; i < n; i++) { const idx = nextAudio + i; data[c * n + i] = idx < src.length ? Math.max(-1, Math.min(1, src[idx])) : 0 }
            }
            const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((audioSamples + nextAudio) * 1e6 / SR), data })
            aenc.encode(ad); ad.close()
            nextAudio += n
          }
        }
        for (let fi = 0; fi < nFrames; fi++) {
          check()
          const tt = fi / fps
          const sp = spec.at(tt)
          const frame = makeFrame({
            w, h, t: tt, trackIndex: ti, trackCount: tracks.length, title: tr.title, headline: s.headline,
            coverSeed: tr.id + tr.title, cover, kind: s.kind, lyrics: tr.lyrics, duration: dur,
            bars: sp.bars, level: sp.level, shape: s.shape, palette, fontStyle: s.fontStyle, lyricLines: s.lyricLines, layout: s.layouts?.[s.templateId],
          })
          drawFrame(ctx, s.templateId, frame)
          const vf = new VideoFrame(canvas as CanvasImageSource, { timestamp: Math.round(globalFrame * frameUs), duration: Math.round(frameUs) })
          venc.encode(vf, { keyFrame: globalFrame % (fps * 2) === 0 })
          vf.close()
          globalFrame++
          sendAudioUpTo(Math.min(audioTotal, Math.round((fi + 1) * SR / fps)))
          while (venc.encodeQueueSize > 6 || aenc.encodeQueueSize > 40) { await waitDequeue(venc.encodeQueueSize > 6 ? venc : aenc); check() }
          if (fi % 15 === 0) progress('render', (doneSec + tt) / hintTotal, `${ti + 1}/${tracks.length}번째 곡 · ${loop + 1}/${s.loops}회차 그리는 중`)
        }
        sendAudioUpTo(audioTotal)
        audioSamples += audioTotal
        doneSec += dur
      }
    }
    progress('finish', 0.98, '파일로 묶고 있어요…')
    await venc.flush(); await aenc.flush()
    check()
    muxer.finalize()
    venc.close(); aenc.close()
    for (const b of covers.values()) b?.close()
    let blob: Blob | null = null
    let bytes = 0
    if (o.fileStream) { await o.fileStream.close() } else { blob = new Blob([memTarget!.buffer], { type: 'video/mp4' }); bytes = blob.size }
    return { blob, seconds: globalFrame / fps, width: w, height: h, bytes, audioCodec, limitedTracks }
  } catch (e) {
    try { venc.close() } catch {}
    try { aenc.close() } catch {}
    for (const b of covers.values()) b?.close()
    if (o.fileStream) { try { await o.fileStream.abort() } catch {} }
    throw e
  }
}
