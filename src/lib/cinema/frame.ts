import type { CinemaFrame, FontStyle, LyricLines, Palette, VizShapeId } from './types'
import { activeIndexAt, type CinemaLyrics } from './lyrics'
import { getTemplate } from './templates'
import { loadFonts, loadPlate } from './scene'

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
  fontStyle?: FontStyle; lyricLines?: LyricLines
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
    fontStyle: i.fontStyle, lyricLines: i.lyricLines,
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, templateId: string, f: CinemaFrame) {
  ctx.save()
  ctx.clearRect(0, 0, f.w, f.h)
  getTemplate(templateId).draw(ctx, f)
  ctx.restore()
}

/**
 * 템플릿이 쓰는 배경 사진·서체를 불러 둔다. text 에는 화면에 나올 글자(제목·가사·문구)를 넘긴다.
 * 실패해도 throw 하지 않는다(대체 그림·대체 서체로 그린다). 내보내기는 반드시 이걸 기다린 뒤 그린다.
 */
export async function prepareScene(templateId: string, text = '', userFonts = false): Promise<void> {
  const t = getTemplate(templateId)
  const jobs: Promise<void>[] = (t.assets ?? []).map(loadPlate)
  if (t.fonts || userFonts) jobs.push(loadFonts(text))
  await Promise.all(jobs)
}
