'use client'
/**
 * 템플릿·형태 카드의 그림. 실제 그리기 코드(템플릿 draw / drawViz)로 만든 정지 프레임이다 — 가짜 이미지 없음.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { getTemplate } from '@/lib/cinema/templates'
import { drawViz, isCircular } from '@/lib/cinema/viz'
import { makeFrame, drawFrame, prepareScene } from '@/lib/cinema/frame'
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

/**
 * 캔버스를 실제 표시 크기 × 기기 픽셀 비율로 그리기 위한 크기. 크기가 바뀌면(창 크기·열 수) 다시 잰다.
 * 작은 캔버스를 늘려 보여 주면 글자·파형이 뭉개지므로 항상 이 크기로 그린다. max 는 긴 변 상한(성능).
 */
export function useDeviceSize(ref: RefObject<HTMLElement | null>, ratio: number, fallbackW: number, max = 2560): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: fallbackW, h: Math.round(fallbackW / ratio) }))
  useEffect(() => {
    const el = ref.current; if (!el) return
    const measure = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const cw = el.clientWidth || fallbackW
      let w = Math.round(cw * dpr), h = Math.round((cw / ratio) * dpr)
      const k = Math.min(1, max / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k))
      setSize(s => (s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [ref, ratio, fallbackW, max])
  return size
}

export function TemplateThumb({ templateId, shape, palette, cover, kind, title, className }: {
  templateId: string; shape: VizShapeId; palette: Palette; cover: ImageBitmap | null; kind: 'lyrics' | 'instrumental'; title: string; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = useDeviceSize(ref, 16 / 9, 320, 1280)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const f = makeFrame({
      w: c.width, h: c.height, t: 7.4, trackIndex: 0, trackCount: 3, title: title || '곡 제목', headline: '', coverSeed: 'thumb:' + templateId,
      cover, kind, lyrics: { lines: SAMPLE_LINES, mode: 'exact' }, duration: 200, bars: sampleBars(1.3), level: 0.5, shape, palette,
    })
    drawFrame(ctx, templateId, f)
    // 배경 사진·서체가 늦게 오면 한 번 더 그린다
    let dead = false
    void prepareScene(templateId, f.trackTitle + SAMPLE_LINES.map(l => l.text).join('')).then(() => { if (!dead) drawFrame(ctx, templateId, f) })
    return () => { dead = true }
  }, [templateId, shape, palette, cover, kind, title, w, h])
  return <canvas ref={ref} width={w} height={h} className={className} aria-label={getTemplate(templateId).name} />
}

export function VizThumb({ shape, palette, className }: { shape: VizShapeId; palette: Palette; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = useDeviceSize(ref, 16 / 9, 160, 640)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    const pad = Math.round(c.width / 16)
    const box = { x: pad, y: pad, w: c.width - pad * 2, h: c.height - pad * 2 }
    const side = Math.min(box.w, box.h)
    const ring = { x: c.width / 2 - side / 2, y: c.height / 2 - side / 2, w: side, h: side }
    // 원형은 안쪽 원이 비므로 작은 점을 찍어 위치를 보여 준다
    drawViz(ctx, shape, palette, sampleBars(0.6), 0.6, 1.2, { bar: box, ring })
    if (isCircular(shape)) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(c.width / 2, c.height / 2, side * 0.26, 0, Math.PI * 2); ctx.fill() }
  }, [shape, palette, w, h])
  return <canvas ref={ref} width={w} height={h} className={className} />
}
