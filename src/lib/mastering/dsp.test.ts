import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MasterChain, measureIntegratedLufs, dbToLin, linToDb, eqResponseDb, type ChainParams } from './dsp'
import { defaultChain, buildGenrePreset, GENRE_PRESETS } from './presets'
import { renderChain, encodeWav } from './render'
import { buildWorkletSource } from '../../../scripts/build-mastering-worklet.mjs'

const FS = 48000

function sine(freq: number, dbfs: number, seconds: number, fs = FS) {
  const n = Math.round(seconds * fs)
  const a = dbToLin(dbfs)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = a * Math.sin((2 * Math.PI * freq * i) / fs)
  return x
}

function noise(seconds: number, amp: number, seed = 1) {
  const n = Math.round(seconds * FS)
  const x = new Float32Array(n)
  let s = seed
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = ((s / 4294967296) * 2 - 1) * amp }
  return x
}

function allOff(): ChainParams {
  const c = defaultChain()
  for (const k of Object.keys(c.bypass) as (keyof typeof c.bypass)[]) c.bypass[k] = true
  return c
}

function runChain(p: ChainParams, L: Float32Array, R: Float32Array) {
  const chain = new MasterChain(FS, 512)
  chain.setParams(p)
  const oL = new Float32Array(L.length), oR = new Float32Array(R.length)
  for (let i = 0; i < L.length; i += 512) {
    const n = Math.min(512, L.length - i)
    chain.process(L.subarray(i, i + n), R.subarray(i, i + n), oL.subarray(i, i + n), oR.subarray(i, i + n), n)
  }
  return { oL, oR, lat: chain.latency, chain }
}

describe('라우드니스 (BS.1770)', () => {
  it('1kHz -20dBFS 사인 한 채널 → 약 -23 LUFS', () => {
    const x = sine(1000, -20, 5)
    const lufs = measureIntegratedLufs([x], FS)
    expect(lufs).toBeGreaterThan(-23.2)
    expect(lufs).toBeLessThan(-22.8)
  })
  it('1kHz -20dBFS 사인 양 채널 → 약 -20 LUFS', () => {
    const x = sine(1000, -20, 5)
    const lufs = measureIntegratedLufs([x, x], FS)
    expect(lufs).toBeCloseTo(-20, 0)
  })
  it('1kHz 0dBFS 사인 한 채널 → -3.01 LUFS (표준 기준점), 44.1kHz 에서도', () => {
    expect(measureIntegratedLufs([sine(1000, 0, 4)], FS)).toBeCloseTo(-3.01, 1)
    expect(measureIntegratedLufs([sine(1000, 0, 4, 44100)], 44100)).toBeCloseTo(-3.01, 1)
  })
  it('-70 LUFS 아래 무음은 게이트로 빠진다', () => {
    const x = new Float32Array(FS * 2)
    expect(measureIntegratedLufs([x, x], FS)).toBe(-Infinity)
  })
})

describe('EQ', () => {
  it('모든 밴드 0dB · 필터 끔이면 입력 = 출력', () => {
    const p = allOff()
    p.bypass.eq = false
    p.eq.hpf.on = false
    p.eq.lpf.on = false
    const L = noise(0.5, 0.5, 3), R = noise(0.5, 0.5, 7)
    const { oL, oR, lat } = runChain(p, L, R)
    // 리미터를 꺼도 지연은 유지된다
    for (let i = 0; i < L.length - lat; i++) {
      expect(oL[i + lat]).toBe(L[i])
      expect(oR[i + lat]).toBe(R[i])
    }
  })
  it('벨 +6dB 는 중심 주파수에서 +6dB', () => {
    const p = defaultChain().eq
    p.hpf.on = false
    p.mf = { on: true, freq: 1000, gain: 6, q: 1 }
    expect(eqResponseDb(p, 1000, FS)).toBeCloseTo(6, 1)
    expect(Math.abs(eqResponseDb(p, 50, FS))).toBeLessThan(0.2)
  })
})

describe('리미터', () => {
  it('출력 샘플 피크가 ceiling 을 넘지 않는다 (+12dB 밀어 넣기)', () => {
    const p = allOff()
    p.bypass.limiter = false
    p.limiter = { gain: 12, ceiling: -1, release: 50, truePeak: true }
    const L = noise(2, 0.9, 11), R = noise(2, 0.9, 12)
    const { oL, oR } = runChain(p, L, R)
    const ceil = dbToLin(-1)
    let mx = 0
    for (let i = 0; i < oL.length; i++) mx = Math.max(mx, Math.abs(oL[i]), Math.abs(oR[i]))
    expect(mx).toBeLessThanOrEqual(ceil + 1e-6)
    expect(mx).toBeGreaterThan(ceil * 0.8)
  })
  it('트루 피크(4배 보간)도 ceiling 근처(+0.5dB 이내)', async () => {
    const p = allOff()
    p.bypass.limiter = false
    p.limiter = { gain: 10, ceiling: -1, release: 60, truePeak: true }
    const L = noise(2, 0.8, 21)
    const res = await renderChain([L, L], FS, p, { write: false })
    expect(res.truePeak).toBeLessThan(-0.5)
  })
  it('ceiling 아래 신호는 그대로 (지연만)', () => {
    const p = allOff()
    p.bypass.limiter = false
    p.limiter = { gain: 0, ceiling: -1, release: 80, truePeak: true }
    const L = sine(440, -12, 0.5)
    const { oL, lat } = runChain(p, L, L)
    for (let i = 1000; i < L.length - lat; i++) expect(Math.abs(oL[i + lat] - L[i])).toBeLessThan(1e-6)
  })
})

describe('멀티밴드·체인', () => {
  it('멀티밴드 압축 없음이면 진폭이 거의 그대로 (크로스오버 합이 평탄)', () => {
    for (const f of [60, 120, 1000, 4000, 10000]) {
      const p = allOff()
      p.bypass.multiband = false
      p.multiband.bands.forEach(b => { b.threshold = 0; b.ratio = 1 })
      const L = sine(f, -12, 1)
      const { oL } = runChain(p, L, L)
      let mx = 0
      for (let i = FS / 2; i < oL.length; i++) mx = Math.max(mx, Math.abs(oL[i]))
      expect(Math.abs(linToDb(mx) - -12)).toBeLessThan(0.3)
    }
  })
  it('장르 프리셋 모두 NaN 없이 처리되고 ceiling 을 지킨다', async () => {
    const L = noise(1, 0.7, 5), R = noise(1, 0.7, 9)
    for (const g of GENRE_PRESETS) {
      const p = buildGenrePreset(g.id)
      const res = await renderChain([L, R], FS, p)
      const out = res.channels!
      let mx = 0
      for (const ch of out) for (let i = 0; i < ch.length; i++) { expect(Number.isFinite(ch[i])).toBe(true); mx = Math.max(mx, Math.abs(ch[i])) }
      expect(mx).toBeLessThanOrEqual(dbToLin(p.limiter.ceiling) + 1e-6)
      expect(out[0].length).toBe(L.length)
    }
  })
  it('렌더는 지연을 잘라 입력과 시간축이 맞는다', async () => {
    const p = allOff()
    const L = noise(0.3, 0.5, 4)
    const res = await renderChain([L, L], FS, p)
    for (let i = 0; i < L.length; i++) expect(res.channels![0][i]).toBe(L[i])
  })
})

describe('WAV 쓰기', () => {
  it('24bit 헤더와 값', async () => {
    const x = new Float32Array([0, 0.5, -0.5, 1])
    const blob = encodeWav([x, x], 44100, 24, false)
    const v = new DataView(await blob.arrayBuffer())
    expect(v.getUint16(34, true)).toBe(24)
    expect(v.getUint32(40, true)).toBe(4 * 2 * 3)
    const s = (o: number) => { const u = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16); return u & 0x800000 ? u - 0x1000000 : u }
    expect(s(44 + 6)).toBe(Math.round(0.5 * 8388607))
    expect(s(44 + 12)).toBe(Math.round(-0.5 * 8388607))
  })
  it('16bit 디더는 ±1 LSB 안', async () => {
    const x = new Float32Array(1000).fill(0.25)
    const blob = encodeWav([x], 48000, 16, true)
    const v = new DataView(await blob.arrayBuffer())
    for (let i = 0; i < 1000; i++) expect(Math.abs(v.getInt16(44 + i * 2, true) - 8192)).toBeLessThanOrEqual(2)
  })
})

describe('워크릿 파일', () => {
  it('public/mastering/master-chain-worklet.js 가 dsp.ts 와 같다 (npm run build:worklet)', async () => {
    const built = readFileSync(join(process.cwd(), 'public/mastering/master-chain-worklet.js'), 'utf8')
    expect(built).toBe(await buildWorkletSource())
  })
})
