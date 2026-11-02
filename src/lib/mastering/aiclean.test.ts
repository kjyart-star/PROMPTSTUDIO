import { describe, it, expect } from 'vitest'
import { defaultChain } from './presets'
import { ALL_SLOTS, Biquad, designPass, type ChainParams } from './dsp'
import { renderChainLocal } from './render'
import { harshMetrics, isAiSong, withAiClean, type AiCleanMode } from './aiclean'

const FS = 48000

/** 재현 가능한 잡음 */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1 } }

/** 분홍 비슷한 넓은 잡음(-6dB/oct 정도) — 고역이 자연스럽게 깔린 바탕 */
function bed(sec: number, seed = 1): Float32Array[] {
  const n = Math.round(sec * FS), r = rng(seed)
  const L = new Float32Array(n), R = new Float32Array(n)
  let a = 0, b = 0
  for (let i = 0; i < n; i++) {
    a = 0.97 * a + 0.1 * r(); b = 0.97 * b + 0.1 * r()
    const w1 = r() * 0.02, w2 = r() * 0.02
    L[i] = a * 0.5 + w1; R[i] = b * 0.5 + w2
  }
  return [L, R]
}

/** 한 대역(중심 f)만 짧게 솟는 버스트 — AI 곡의 쇳소리처럼 */
function addNarrowBursts(ch: Float32Array[], f: number, gain: number, every = 0.5, len = 0.06, seed = 7) {
  const bp = new Biquad(); bp.set(designPass('bp', f, 8, FS))
  const r = rng(seed)
  for (let t = 0.6; t < ch[0].length / FS - len; t += every) {
    const s = Math.round(t * FS), e = s + Math.round(len * FS)
    for (let i = s; i < e; i++) {
      const env = Math.sin(Math.PI * (i - s) / (e - s))
      const x = bp.l(r()) * gain * env
      ch[0][i] += x; ch[1][i] += x
    }
  }
  return ch
}

/** 고음 전체가 같이 오르는 버스트 — 하이햇처럼 */
function addBroadBursts(ch: Float32Array[], gain: number, every = 0.25, len = 0.04, seed = 9) {
  const hp = new Biquad(); hp.set(designPass('hp', 2500, 0.7, FS))
  const r = rng(seed)
  for (let t = 0.6; t < ch[0].length / FS - len; t += every) {
    const s = Math.round(t * FS), e = s + Math.round(len * FS)
    for (let i = s; i < e; i++) {
      const env = Math.exp(-(i - s) / (0.012 * FS))
      const x = hp.l(r()) * gain * env
      ch[0][i] += x; ch[1][i] += x
    }
  }
  return ch
}

const only = (mode: AiCleanMode | null): ChainParams => {
  const c = defaultChain()
  for (const s of ALL_SLOTS) c.bypass[s] = true
  return withAiClean(c, mode)
}
const clone = (ch: Float32Array[]) => ch.map(c => Float32Array.from(c))

describe('AI 곡 고음 정리(aiclean) — 체인 맨 앞', () => {
  it('기본 체인에서 맨 앞 칸이고 꺼져 있다', () => {
    const c = defaultChain()
    expect(c.order[0]).toBe('aiclean')
    expect(c.bypass.aiclean).toBe(true)
    expect(ALL_SLOTS).toContain('aiclean')
  })

  it('꺼 두면 소리가 바뀌지 않는다', async () => {
    const src = bed(2)
    const r = await renderChainLocal(src, FS, only(null))
    let d = 0
    for (let i = 0; i < src[0].length; i++) d = Math.max(d, Math.abs(r.channels![0][i] - src[0][i]))
    expect(d).toBeLessThan(1e-6)
    expect(r.aiCleanMaxCut).toBe(0)
  })

  it('튀는 대역이 없으면 거의 건드리지 않는다(고역 평균 손실 0.3dB 미만)', async () => {
    const src = bed(6)
    for (const mode of ['natural', 'strong'] as const) {
      const r = await renderChainLocal(clone(src), FS, only(mode))
      const b = harshMetrics(src, FS), a = harshMetrics(r.channels!, FS)
      expect(b.hfMeanDb - a.hfMeanDb).toBeLessThan(0.3)
    }
  })

  it('한 대역만 솟는 쇳소리는 줄이고(돌출 감소), 강하게가 더 줄인다', async () => {
    const src = addNarrowBursts(bed(8), 5930, 0.5)
    const before = harshMetrics(src, FS)
    const nat = await renderChainLocal(clone(src), FS, only('natural'))
    const str = await renderChainLocal(clone(src), FS, only('strong'))
    const an = harshMetrics(nat.channels!, FS), as = harshMetrics(str.channels!, FS)
    expect(before.bulgeDb - an.bulgeDb).toBeGreaterThan(1)
    expect(before.bulgeDb - as.bulgeDb).toBeGreaterThan(before.bulgeDb - an.bulgeDb)
    expect(nat.aiCleanMaxCut!).toBeLessThan(-2)
    expect(str.aiCleanMaxCut!).toBeLessThan(nat.aiCleanMaxCut!)
    // 평균 고역은 거의 그대로(1.5dB 이하)
    expect(before.hfMeanDb - as.hfMeanDb).toBeLessThanOrEqual(1.5)
  })

  it('하이햇처럼 고음 전체가 같이 오르는 타격은 거의 줄이지 않는다', async () => {
    const src = addBroadBursts(bed(6), 0.6)
    const r = await renderChainLocal(clone(src), FS, only('natural'))
    expect(r.aiCleanMaxCut!).toBeGreaterThan(-2)
    expect(harshMetrics(src, FS).hfMeanDb - harshMetrics(r.channels!, FS).hfMeanDb).toBeLessThan(0.3)
  })

  it('withAiClean 은 옛 순서에도 맨 앞에 끼워 켜고, null 이면 끈다', () => {
    const c = defaultChain()
    const old = { ...c, order: c.order.filter(s => s !== 'aiclean') }
    const on = withAiClean(old, 'strong')
    expect(on.order[0]).toBe('aiclean')
    expect(on.bypass.aiclean).toBe(false)
    expect(on.aiclean.mode).toBe('strong')
    expect(withAiClean(on, null).bypass.aiclean).toBe(true)
  })

  it('보관함 곡은 AI 곡, 직접 올린 파일은 아니다', () => {
    expect(isAiSong({ source: 'library', song: {} })).toBe(true)
    expect(isAiSong({ source: 'file' })).toBe(false)
    expect(isAiSong(null)).toBe(false)
  })
})

describe('harshMetrics', () => {
  it('무음이면 프레임 0', () => {
    const z = [new Float32Array(FS), new Float32Array(FS)]
    expect(harshMetrics(z, FS).frames).toBe(0)
  })
  it('쇳소리 버스트가 있으면 돌출 지표가 커진다', () => {
    const a = harshMetrics(bed(6), FS)
    const b = harshMetrics(addNarrowBursts(bed(6), 4350, 0.5), FS)
    expect(b.bulgeDb).toBeGreaterThan(a.bulgeDb + 2)
  })
})
