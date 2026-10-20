import { describe, it, expect } from 'vitest'
import { composeChoice, USE_CARDS, GENRE_GROUPS, TEXTURE_CARDS, GENRE_PLAIN, changeBars, recommendGenres, loudnessWords, type Choice } from './compose'
import { TEMPLATES } from './templates'
import { autoMatchLoudness } from './render'
import { analyzeAudio } from './analyze'
import { dbToLin } from './dsp'

const FS = 48000
function tone(sec: number, bright = 0) {
  const n = sec * FS, L = new Float32Array(n), R = new Float32Array(n)
  let s = 7
  for (let i = 0; i < n; i++) {
    const t = i / FS, b = t % 0.5
    s = (s * 1664525 + 1013904223) >>> 0
    const hh = ((s / 4294967296) * 2 - 1) * Math.exp(-((t + 0.25) % 0.25) * 40) * (0.08 + bright)
    const v = Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-b * 30)) * b) * Math.exp(-b * 8) * 0.5 + Math.sin(2 * Math.PI * 220 * t) * 0.05 + Math.sin(2 * Math.PI * 55 * t) * 0.15
    L[i] = v + hh * 0.8; R[i] = v + hh
  }
  return [L, R]
}

describe('간단 모드 조합', () => {
  it('카드 수: 용도 8 · 장르 그룹 7(장르 26 모두 포함) · 느낌 7, 모든 장르에 쉬운 설명', () => {
    expect(USE_CARDS.length).toBe(8)
    expect(GENRE_GROUPS.length).toBe(7)
    expect(TEXTURE_CARDS.length).toBe(7)
    const genres = TEMPLATES.filter(t => t.category === 'genre').map(t => t.id).sort()
    expect(GENRE_GROUPS.flatMap(g => g.genres).sort()).toEqual(genres)
    for (const g of genres) expect(GENRE_PLAIN[g]?.length ?? 0).toBeGreaterThan(5)
  })
  it('모든 조합(9×27×7)이 유효한 체인을 만들고, 목표는 용도 > 장르 순', () => {
    const uses = [null, ...USE_CARDS.map(u => u.id)]
    const genres = [null, ...GENRE_GROUPS.flatMap(g => g.genres)]
    const tex = [null, ...TEXTURE_CARDS.map(t => t.id)]
    let n = 0
    for (const use of uses) for (const genre of genres) for (const texture of tex) {
      const t = composeChoice({ use, genre, texture } as Choice)
      const c = t.build()
      expect(Number.isFinite(c.limiter.gain) && Number.isFinite(c.eq.hf.gain)).toBe(true)
      expect(c.limiter.ceiling).toBe(t.tp)
      if (use) expect(t.lufs).toBe(TEMPLATES.find(x => x.id === use)!.lufs)
      n++
    }
    expect(n).toBe(9 * 27 * 8)
  })
  it('대표 조합 12개: 자동 맞춤 뒤 목표 LUFS ±1, 트루 피크 ≤ 천장+0.3', async () => {
    const [L, R] = tone(6)
    const combos: Choice[] = [
      { use: 'use-stream', genre: 'k-ballad', texture: 'tex-warm' }, { use: 'use-club', genre: 'edm-house', texture: 'tex-wide' },
      { use: 'use-shorts', genre: 'kpop-dance', texture: 'tex-bright' }, { use: 'use-podcast', genre: null, texture: 'tex-clean' },
      { use: 'use-bgm', genre: 'cinematic', texture: null }, { use: 'use-cd', genre: 'rock', texture: 'tex-punch' },
      { use: 'use-broadcast', genre: 'jazz', texture: 'tex-vintage' }, { use: 'use-video', genre: 'hiphop', texture: 'none' },
      { use: null, genre: 'lofi', texture: 'tex-vintage' }, { use: null, genre: null, texture: null },
      { use: 'use-stream', genre: 'trot', texture: 'tex-bright' }, { use: 'use-club', genre: 'trap', texture: 'tex-punch' },
    ]
    for (const ch of combos) {
      const t = composeChoice(ch)
      const r = await autoMatchLoudness([L, R], FS, t.build(), t.lufs)
      expect(Math.abs(r.integrated - t.lufs), t.label).toBeLessThanOrEqual(1)
      expect(r.truePeak, t.label).toBeLessThanOrEqual(t.tp + 0.3)
    }
  }, 120000)
  it('전후 막대: 밝게는 밝기 +, 넓게는 폭 +, 음량은 원곡 대비', async () => {
    const base = changeBars(composeChoice({ use: null, genre: 'pop', texture: null }))
    expect(changeBars(composeChoice({ use: null, genre: 'pop', texture: 'tex-bright' })).bright).toBeGreaterThan(base.bright)
    expect(changeBars(composeChoice({ use: null, genre: 'pop', texture: 'tex-wide' })).width).toBeGreaterThan(base.width)
    const [L, R] = tone(4)
    const a = await analyzeAudio([L, R], FS, { spectrogramCols: 8 })
    const b = changeBars(composeChoice({ use: 'use-club', genre: null, texture: null }), a)
    expect(b.loud).toBeCloseTo(-8 - a.integrated, 1)
  })
  it('장르 추천: 1~3개, 밝은 곡과 어두운 곡의 추천이 다르다', async () => {
    const a = await analyzeAudio(tone(4, 0), FS, { spectrogramCols: 8 })
    const b = await analyzeAudio(tone(4, 0.6), FS, { spectrogramCols: 8 })
    const ra = recommendGenres(a), rb = recommendGenres(b)
    expect(ra.length).toBe(3)
    expect(ra.map(x => x.id).join()).not.toBe(rb.map(x => x.id).join())
  })
  it('음량을 쉬운 말로', () => {
    expect(loudnessWords(-14.4, -14).text).toBe('적당해요')
    expect(loudnessWords(-16, -14).text).toBe('조금 작아요')
    expect(loudnessWords(-20, -14).text).toBe('많이 작아요')
    expect(loudnessWords(-12, -14).text).toBe('조금 커요')
    expect(dbToLin(0)).toBe(1)
  })
})
