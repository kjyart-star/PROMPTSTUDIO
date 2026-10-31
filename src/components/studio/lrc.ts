export interface TimedLine { t: number; text: string }

const clean = (s: string) => s.replace(/^﻿/, '').replace(/\r/g, '')

/** [mm:ss.xx] 줄들 → 시간순 가사 줄. 한 줄에 시간표가 여러 개여도 풀어 준다. */
export function parseLrc(raw: string): TimedLine[] {
  const out: TimedLine[] = []
  for (const line of clean(raw).split('\n')) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue
    const text = line.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

/** SRT 큐 → 시작 시각 기준 가사 줄 */
export function parseSrt(raw: string): TimedLine[] {
  const out: TimedLine[] = []
  for (const block of clean(raw).split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const idx = lines.findIndex((l) => /-->/.test(l))
    if (idx < 0) continue
    const m = lines[idx].match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/)
    if (!m) continue
    const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`)
    out.push({ t, text: lines.slice(idx + 1).join(' ') })
  }
  return out.sort((a, b) => a.t - b.t)
}

export function parseTiming(fileName: string, raw: string): TimedLine[] {
  const isSrt = /\.srt$/i.test(fileName) || (/-->/.test(raw) && !/\[\d+:\d+/.test(raw))
  return (isSrt ? parseSrt(raw) : parseLrc(raw)).filter((l) => l.text || l.t >= 0)
}

const two = (n: number) => String(n).padStart(2, '0')
/** 시간표 → LRC 텍스트 ([mm:ss.xx]가사) */
export function toLrc(lines: TimedLine[]): string {
  return lines.map((l) => `[${two(Math.floor(l.t / 60))}:${two(Math.floor(l.t % 60))}.${two(Math.floor((l.t % 1) * 100))}]${l.text}`).join('\n') + '\n'
}
