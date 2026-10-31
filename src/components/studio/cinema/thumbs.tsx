'use client'
/**
 * 템플릿·형태 카드의 그림. 실제 그리기 코드(템플릿 draw / drawViz)로 만든 정지 프레임이다 — 가짜 이미지 없음.
 */
import { useEffect, useRef } from 'react'
import { getTemplate } from '@/lib/cinema/templates'
import { drawViz, isCircular } from '@/lib/cinema/viz'
import { makeFrame, drawFrame } from '@/lib/cinema/frame'
import { BAR_COUNT } from '@/lib/cinema/spectrum'
import type { Palette, VizShapeId } from '@/lib/cinema/types'

/** 모양 예시용 고정 막대 값(결정적) */
export function sampleBars(phase = 0): Float32Array {
  const a = new Float32Array(BAR_COUNT)
  for (let i = 0; i < BAR_COUNT; i++) {
    const x = i / BAR_COUNT
    a[i] = Math.max(0.06, Math.min(1, 0.62 * Math.pow(1 - x, 0.8) * (0.55 + 0.45 * Math.sin(i * 0.9 + phase)) + 0.18 * Math.abs(Math.sin(i * 0.37 + phase * 1.7)) + 0.08))
  }
  return a
}

export const SAMPLE_LINES = [
  { text: '지난 여름의 노래가', start: 0 },
  { text: '오늘 밤 다시 들려와', start: 6 },
  { text: '너와 걷던 그 길 위에', start: 12 },
  { text: '조용히 불이 켜지면', start: 18 },
]

export function TemplateThumb({ templateId, shape, palette, cover, kind, title, className }: {
  templateId: string; shape: VizShapeId; palette: Palette; cover: ImageBitmap | null; kind: 'lyrics' | 'instrumental'; title: string; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const f = makeFrame({
      w: c.width, h: c.height, t: 7.4, trackIndex: 0, trackCount: 3, title: title || '곡 제목', headline: '', coverSeed: 'thumb:' + templateId,
      cover, kind, lyrics: { lines: SAMPLE_LINES, mode: 'exact' }, duration: 200, bars: sampleBars(1.3), level: 0.5, shape, palette,
    })
    drawFrame(ctx, templateId, f)
  }, [templateId, shape, palette, cover, kind, title])
  return <canvas ref={ref} width={320} height={180} className={className} aria-label={getTemplate(templateId).name} />
}

export function VizThumb({ shape, palette, className }: { shape: VizShapeId; palette: Palette; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    const pad = 10
    const box = { x: pad, y: pad, w: c.width - pad * 2, h: c.height - pad * 2 }
    const side = Math.min(box.w, box.h)
    const ring = { x: c.width / 2 - side / 2, y: c.height / 2 - side / 2, w: side, h: side }
    // 원형은 안쪽 원이 비므로 작은 점을 찍어 위치를 보여 준다
    drawViz(ctx, shape, palette, sampleBars(0.6), 0.6, 1.2, { bar: box, ring })
    if (isCircular(shape)) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(c.width / 2, c.height / 2, side * 0.26, 0, Math.PI * 2); ctx.fill() }
  }, [shape, palette])
  return <canvas ref={ref} width={160} height={90} className={className} />
}
