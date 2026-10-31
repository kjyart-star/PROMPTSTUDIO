import type { CinemaFrame, Palette, VizShapeId } from './types'
import { activeIndexAt, type CinemaLyrics } from './lyrics'
import { getTemplate } from './templates'

export interface FrameInput {
  w: number; h: number; t: number
  trackIndex: number; trackCount: number
  title: string; headline: string; coverSeed: string
  cover: CanvasImageSource | null
  kind: 'lyrics' | 'instrumental'
  lyrics: CinemaLyrics
  duration: number
  bars: Float32Array; level: number
  shape: VizShapeId; palette: Palette
}

/** 미리보기·썸네일·내보내기가 모두 이 함수로 한 프레임 입력을 만든다 */
export function makeFrame(i: FrameInput): CinemaFrame {
  const lines = i.kind === 'lyrics' ? i.lyrics.lines : []
  return {
    w: i.w, h: i.h, t: i.t, trackIndex: i.trackIndex, trackCount: i.trackCount,
    trackTitle: i.title, headline: i.headline, cover: i.cover, coverSeed: i.coverSeed,
    kind: i.kind, lines, activeIndex: activeIndexAt(lines, i.t),
    lyricsEstimated: i.kind === 'lyrics' && (i.lyrics.mode === 'estimated' || i.lyrics.mode === 'auto'),
    duration: i.duration, bars: i.bars, level: i.level, shape: i.shape, palette: i.palette,
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, templateId: string, f: CinemaFrame) {
  ctx.save()
  ctx.clearRect(0, 0, f.w, f.h)
  getTemplate(templateId).draw(ctx, f)
  ctx.restore()
}
