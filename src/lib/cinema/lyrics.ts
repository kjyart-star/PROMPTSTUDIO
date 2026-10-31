/**
 * 가사 확인 단계 계산 — 가사 원문은 그대로 두고 줄마다 시작 시간만 붙인다.
 * 시간 출처 4가지: exact(가사에 [mm:ss] 시간표) · estimated(길이 비례 추정) · auto(소리 구간에 맞춰 보정, 근사) · manual(탭으로 직접).
 * 무료 브라우저 경로만 쓴다(서버·유료 API 없음). 정밀 음성 정렬은 아니므로 auto 는 「근사」로 표시한다.
 */
import { buildTimedLyrics } from '@/lib/player/lyricTiming'
import type { LyricLineT } from './types'

export type LyricsMode = 'exact' | 'estimated' | 'auto' | 'manual' | 'none'
export interface CinemaLyrics { lines: LyricLineT[]; mode: LyricsMode }

export function initialLyrics(raw: string | null | undefined, durationSec: number): CinemaLyrics {
  const t = buildTimedLyrics(raw, durationSec)
  const lines = t.lines.filter(l => l.kind === 'line' && isFinite(l.start)).map(l => ({ text: l.text, start: l.start }))
  if (!lines.length) return { lines: [], mode: 'none' }
  return { lines, mode: t.mode === 'exact' ? 'exact' : 'estimated' }
}

/** 시간이 없는 일반 텍스트를 줄 목록으로(구간 표지 [Verse] 등은 뺀다) */
export function plainLines(raw: string | null | undefined): string[] {
  return (raw ?? '').split(/\r?\n/).map(r => r.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim())
    .filter(r => r && !/^\[[^\]]*\]$/.test(r) && !/^\(?\s*(verse|chorus|bridge|intro|outro|hook|pre-chorus|refrain|instrumental)\b[^)]*\)?$/i.test(r))
}

/** t 초에 강조할 줄 번호(-1 = 아직 시작 전). 마지막 줄 뒤 12초가 지나면 -1 */
export function activeIndexAt(lines: LyricLineT[], t: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].start <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  if (ans === lines.length - 1 && ans >= 0 && t > lines[ans].start + 12) return -1
  return ans
}

/** 맞지 않아 보이는 줄: 앞 줄보다 이르거나(역행), 앞 줄과 0.6초 안, 곡 길이 밖, 앞 줄과 25초 넘게 벌어진 줄 */
export function suspectLines(lines: LyricLineT[], durationSec: number): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!isFinite(l.start) || l.start < 0 || (durationSec > 0 && l.start > durationSec - 0.5)) { bad.add(i); continue }
    if (i > 0) {
      const gap = l.start - lines[i - 1].start
      if (gap < 0.6 || gap > 25) bad.add(i)
    }
  }
  return bad
}

export function toLrc(lines: LyricLineT[]): string {
  return lines.map(l => {
    const m = Math.floor(l.start / 60), s = l.start - m * 60
    return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]${l.text}`
  }).join('\n')
}

/**
 * 소리 에너지(100ms 단위)를 보고 줄 시간을 보정한다.
 * 1) 노래가 실제로 시작·끝나는 구간을 찾아 그 안에 글자 수 비례로 줄을 놓고
 * 2) 각 줄 시작을 ±1.2초 안의 가장 조용한 지점(숨 쉬는 곳)으로 당긴다.
 */
export function autoAlign(texts: string[], env: Float32Array, stepSec: number, durationSec: number): LyricLineT[] {
  if (!texts.length) return []
  const n = env.length
  const sorted = Array.from(env).sort((a, b) => a - b)
  const p90 = sorted[Math.floor(n * 0.9)] || 0
  const thr = p90 * 0.18
  const run = Math.max(2, Math.round(0.5 / stepSec))
  let a = 0, b = n - 1
  for (let i = 0; i + run < n; i++) { let ok = true; for (let k = 0; k < run; k++) if (env[i + k] < thr) { ok = false; break } if (ok) { a = i; break } }
  for (let i = n - 1; i - run >= 0; i--) { let ok = true; for (let k = 0; k < run; k++) if (env[i - k] < thr) { ok = false; break } if (ok) { b = i; break } }
  const start = a * stepSec, end = Math.max(start + 1, Math.min(durationSec, (b + 1) * stepSec))
  // 완만하게 다듬은 에너지
  const sm = new Float32Array(n)
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < n) { s += env[j]; c++ } } sm[i] = s / c }
  const weights = texts.map(t => Math.max(t.length, 6) + 4)
  const total = weights.reduce((x, y) => x + y, 0)
  const out: LyricLineT[] = []
  let acc = 0
  for (let i = 0; i < texts.length; i++) {
    let t = start + (acc / total) * (end - start)
    acc += weights[i]
    if (i > 0) {
      const c = Math.round(t / stepSec), r = Math.round(1.2 / stepSec)
      let best = c, bv = Infinity
      for (let j = Math.max(0, c - r); j <= Math.min(n - 1, c + r); j++) {
        const v = sm[j] + Math.abs(j - c) * stepSec * p90 * 0.02 // 가까운 곳 우선
        if (v < bv) { bv = v; best = j }
      }
      t = best * stepSec
    }
    if (i > 0 && t < out[i - 1].start + 0.8) t = out[i - 1].start + 0.8
    out.push({ text: texts[i], start: Math.round(t * 100) / 100 })
  }
  return out
}
