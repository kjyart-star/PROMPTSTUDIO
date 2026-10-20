import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import NodeID3 from 'node-id3'
import {
  MasterChain, dbToLin, linToDb, measureIntegratedLufs, loudnessRange, FIR_LATENCY, defaultEdit,
  type ChainParams, type EditParams,
} from './dsp'
import { defaultChain } from './presets'
import { TEMPLATES } from './templates'
import { renderChain, autoMatchLoudness, mixStems, joinAlbum } from './render'
import { analyzeAudio, matchingCurve } from './analyze'
import { autoMaster } from './automaster'
import { encodeWav, id3v23, makeZip, readZip, crc32 } from './fileformats'
import { FFT } from './fft'

const FS = 48000

const sine = (f: number, db: number, sec: number, phase = 0) => {
  const n = Math.round(sec * FS), a = dbToLin(db), x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = a * Math.sin((2 * Math.PI * f * i) / FS + phase)
  return x
}
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
const noise = (sec: number, amp: number, seed = 1) => { const r = rng(seed), n = Math.round(sec * FS), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (r() * 2 - 1) * amp; return x }

/** 음악 비슷한 테스트 톤 — 킥·베이스·코드·하이햇 */
function musicTone(sec: number, seed = 3, bright = 0) {
  const n = Math.round(sec * FS), L = new Float32Array(n), R = new Float32Array(n), r = rng(seed)
  const beat = 0.5
  for (let i = 0; i < n; i++) {
    const t = i / FS, b = t % beat
    const kick = Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-b * 30)) * b) * Math.exp(-b * 8) * 0.5
    const pad = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277 * t + 1) + Math.sin(2 * Math.PI * 330 * t + 2)) * 0.05
    const hh = (r() * 2 - 1) * Math.exp(-((t + 0.25) % 0.25) * 40) * (0.08 + bright)
    const bass = Math.sin(2 * Math.PI * 55 * t) * 0.15
    L[i] = kick + pad + bass + hh * 0.8
    R[i] = kick + pad * 0.9 + bass + hh
  }
  return [L, R]
}

function off(): ChainParams {
  const c = defaultChain()
  for (const k of Object.keys(c.bypass) as (keyof typeof c.bypass)[]) c.bypass[k] = true
  return c
}
function only(slot: keyof ChainParams['bypass'], patch?: (c: ChainParams) => void) {
  const c = off(); c.bypass[slot] = false; patch?.(c); return c
}
function run(p: ChainParams, L: Float32Array, R: Float32Array = L, edit?: EditParams) {
  const ch = new MasterChain(FS, 512)
  ch.setParams(p)
  if (edit) ch.setEdit(edit)
  const oL = new Float32Array(L.length), oR = new Float32Array(L.length)
  for (let i = 0; i < L.length; i += 512) {
    const m = Math.min(512, L.length - i)
    ch.process(L.subarray(i, i + m), R.subarray(i, i + m), oL.subarray(i, i + m), oR.subarray(i, i + m), m)
  }
  return { oL, oR, lat: ch.latency }
}
const peakDb = (x: Float32Array, from = 0, to = x.length) => { let m = 0; for (let i = from; i < to; i++) m = Math.max(m, Math.abs(x[i])); return linToDb(m) }
const rmsDb = (x: Float32Array, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return 10 * Math.log10(s / (to - from) + 1e-30) }

describe('분석', () => {
  it('LRA: -30/-20 LUFS 가 번갈아 나오면 약 10 LU, 일정한 소리는 0 근처', () => {
    const series: number[] = []
    for (let k = 0; k < 200; k++) series.push(k % 40 < 20 ? -30 : -20)
    expect(loudnessRange(series)).toBeCloseTo(10, 0)
    expect(loudnessRange(new Array(100).fill(-14))).toBe(0)
  })
  it('사인의 크레스트 팩터 ≈ 3dB, 클리핑 위치를 찾는다, 스펙트럼·스펙트로그램 크기', async () => {
    const x = sine(1000, -6, 4)
    const a = await analyzeAudio([x, x], FS, { spectrogramCols: 50 })
    expect(a.crest).toBeCloseTo(3.01, 1)
    expect(a.clips.length).toBe(0)
    expect(a.bands.length).toBe(31)
    expect(a.spectrogram.data.length).toBe(50 * 96)
    const c = sine(200, 6, 2).map(v => Math.max(-1, Math.min(1, v)))
    const b = await analyzeAudio([c, c], FS, { spectrogramCols: 20 })
    expect(b.clips.length).toBeGreaterThanOrEqual(1)
    expect(b.clips[0].t).toBeLessThan(0.01)
    expect(b.clipSamples).toBeGreaterThan(100)
  })
  it('PLR = 트루 피크 - 통합, 음악 톤에서 PSR > 0', async () => {
    const [L, R] = musicTone(8)
    const a = await analyzeAudio([L, R], FS, { spectrogramCols: 20 })
    expect(a.plr).toBeCloseTo(a.truePeak - a.integrated, 5)
    expect(a.psrAvg).toBeGreaterThan(3)
    expect(a.shortSeries.length).toBeGreaterThan(40)
  })
})

describe('추가 플러그인', () => {
  it('리니어 페이즈 EQ: +6dB 벨이 그대로 +6dB, 지연은 FIR_LATENCY, 임펄스가 좌우 대칭', () => {
    const p = only('eq', c => { c.eq.mode = 'linear'; c.eq.hpf.on = false; c.eq.mf = { on: true, freq: 1000, gain: 6, q: 1 } })
    const x = sine(1000, -20, 1)
    const { oL, lat } = run(p, x)
    expect(lat - 0).toBeGreaterThanOrEqual(FIR_LATENCY)
    expect(peakDb(oL, FS / 2) - -20).toBeCloseTo(6, 0)
    const imp = new Float32Array(16384); imp[100] = 1
    const r = run(p, imp)
    let mi = 0; for (let i = 0; i < r.oL.length; i++) if (Math.abs(r.oL[i]) > Math.abs(r.oL[mi])) mi = i
    expect(mi - 100).toBe(r.lat)
    for (let k = 1; k < 300; k++) expect(Math.abs(r.oL[mi + k] - r.oL[mi - k])).toBeLessThan(1e-4)
  })
  it('매칭 EQ: 곡선 +6dB 이면 전 대역 +6dB, 곡선 0 이면 꺼진 것과 같다', () => {
    const p = only('match', c => { c.match.curve = c.match.curve.map(() => 6); c.match.strength = 100 })
    const { oL } = run(p, sine(500, -20, 1))
    expect(peakDb(oL, FS / 2) + 20).toBeCloseTo(6, 0)
    const p0 = only('match')
    expect(run(p0, sine(500, -20, 0.2)).lat).toBe(run(off(), sine(500, -20, 0.2)).lat)
  })
  it('M/S EQ: 사이드만 깎으면 모노 소리는 그대로', () => {
    const p = only('mseq', c => { c.mseq.side.b1 = { freq: 1000, gain: -12, q: 1 } })
    const x = sine(1000, -12, 0.5)
    const { oL, oR, lat } = run(p, x, x)
    for (let i = 2000; i < x.length - lat; i++) { expect(Math.abs(oL[i + lat] - x[i])).toBeLessThan(1e-5); expect(Math.abs(oR[i + lat] - x[i])).toBeLessThan(1e-5) }
  })
  it('다이내믹 EQ: 스레숄드 넘는 3kHz 만 range 만큼 내려간다', () => {
    const p = only('dyneq', c => {
      c.dyneq.bands = [{ on: true, freq: 3000, q: 1.5, gain: 0, threshold: -30, ratio: 8, range: 6, attack: 2, release: 50, mode: 'cut' }]
    })
    const loud = run(p, sine(3000, -6, 1)).oL
    expect(peakDb(loud, FS / 2) - -6).toBeLessThan(-4)
    expect(peakDb(loud, FS / 2) - -6).toBeGreaterThan(-6.5)
    const quiet = run(p, sine(3000, -50, 1)).oL
    expect(Math.abs(peakDb(quiet, FS / 2) + 50)).toBeLessThan(0.3)
  })
  it('디에서: 큰 7kHz 는 줄고 500Hz 는 그대로', () => {
    const p = only('deesser', c => { c.deesser = { freq: 6000, threshold: -30, range: 8, listen: false } })
    expect(peakDb(run(p, sine(7000, -6, 1)).oL, FS / 2) + 6).toBeLessThan(-3)
    expect(Math.abs(peakDb(run(p, sine(500, -6, 1)).oL, FS / 2) + 6)).toBeLessThan(0.3)
  })
  it('트랜지언트 셰이퍼: 어택 +100% 면 타격음 피크가 커진다', () => {
    const [L] = musicTone(2)
    const base = peakDb(run(off(), L).oL)
    const up = peakDb(run(only('transient', c => { c.transient.attack = 100 }), L).oL)
    expect(up - base).toBeGreaterThan(1)
  })
  it('소프트 클리퍼: 출력이 스레숄드를 넘지 않는다', () => {
    const { oL } = run(only('clipper', c => { c.clipper = { threshold: -3, softness: 40, output: 0 } }), noise(1, 1, 4))
    expect(peakDb(oL)).toBeLessThanOrEqual(-3 + 1e-4)
  })
  it('대역별 폭: 100% 는 원음, 0% 는 완전 모노', () => {
    const L = noise(0.5, 0.5, 1), R = noise(0.5, 0.5, 2)
    const w0 = run(only('imager', c => { c.imager.widths = [0, 0, 0] }), L, R)
    for (let i = 0; i < L.length; i += 97) expect(Math.abs(w0.oL[i] - w0.oR[i])).toBeLessThan(1e-6)
    const w100 = run(only('imager'), sine(1000, -12, 1), sine(1000, -12, 1, 1))
    expect(Math.abs(peakDb(w100.oL, FS / 2) + 12)).toBeLessThan(0.3)
  })
  it('저역 모노 크로스오버: 150Hz 아래 사이드는 사라지고 2kHz 사이드는 남는다', () => {
    const p = only('stereo', c => { c.stereo.bassMono = 150 })
    const lo = run(p, sine(50, -12, 1), sine(50, -12, 1).map(v => -v))
    expect(peakDb(lo.oL, FS / 2)).toBeLessThan(-30)
    const hi = run(p, sine(2000, -12, 1), sine(2000, -12, 1).map(v => -v))
    expect(Math.abs(peakDb(hi.oL, FS / 2) + 12)).toBeLessThan(0.3)
  })
  it('게이트/익스팬더: 스레숄드 아래 잡음을 range 만큼 줄인다', () => {
    const p = only('gate', c => { c.gate = { threshold: -50, ratio: 4, range: 20, attack: 1, hold: 10, release: 50 } })
    const { oL } = run(p, noise(1, dbToLin(-70), 9))
    expect(rmsDb(oL, FS / 2) - rmsDb(noise(1, dbToLin(-70), 9), FS / 2)).toBeLessThan(-15)
  })
  it('새추레이션 6종: 유한값, DC 없음', () => {
    for (const mode of ['tape', 'tube', 'clip', 'tapeWarm', 'triode', 'transformer'] as const) {
      const { oL } = run(only('saturation', c => { c.saturation = { drive: 12, mode, mix: 100, output: 0 } }), sine(100, -3, 1))
      let s = 0, bad = 0
      for (let i = FS / 2; i < oL.length; i++) { s += oL[i]; if (!Number.isFinite(oL[i])) bad++ }
      expect(bad).toBe(0)
      expect(Math.abs(s / (oL.length - FS / 2))).toBeLessThan(0.01)
    }
  })
  it('컴프 자동 메이크업이 줄어든 만큼 일부 되돌린다', () => {
    const x = sine(1000, -6, 1)
    const a = peakDb(run(only('comp', c => { c.comp = { ...c.comp, threshold: -30, ratio: 4, autoMakeup: false } }), x).oL, FS / 2)
    const b = peakDb(run(only('comp', c => { c.comp = { ...c.comp, threshold: -30, ratio: 4, autoMakeup: true } }), x).oL, FS / 2)
    expect(b - a).toBeGreaterThan(5)
  })
})

describe('편집·오토메이션', () => {
  it('볼륨 오토메이션 -6dB → 절반, 페이드 인은 0에서 시작, 자르기 밖은 무음', () => {
    const x = sine(500, -12, 3)
    const e = { ...defaultEdit(), automation: { volume: [{ t: 0, v: -6 }, { t: 10, v: -6 }] } }
    const r = run(off(), x, x, e)
    expect(peakDb(r.oL, FS) + 18).toBeCloseTo(0, 0)
    const f = run(off(), x, x, { ...defaultEdit(), fadeIn: { dur: 1, curve: 'lin' } })
    expect(Math.abs(f.oL[f.lat + 10])).toBeLessThan(0.002)
    expect(peakDb(f.oL, f.lat + FS * 0.45, f.lat + FS * 0.55)).toBeLessThan(-17)
    const t = run(off(), x, x, { ...defaultEdit(), start: 1, end: 2 })
    expect(peakDb(t.oL, 0, t.lat + FS - 10)).toBe(-240)
    expect(peakDb(t.oL, t.lat + Math.round(FS * 2.01))).toBe(-240)
  })
  it('EQ 게인·리미터 게인 오토메이션이 시간에 따라 바뀐다', () => {
    const x = sine(1000, -20, 2)
    const p = only('eq', c => { c.eq.hpf.on = false })
    const e = { ...defaultEdit(), automation: { 'eq.mf': [{ t: 0, v: 0 }, { t: 0.99, v: 0 }, { t: 1, v: 6 }] } }
    const r = run(p, x, x, e)
    expect(peakDb(r.oL, FS * 0.3, FS * 0.8) + 20).toBeCloseTo(0, 0)
    expect(peakDb(r.oL, FS * 1.3, FS * 1.9) + 20).toBeCloseTo(6, 0)
    const lp = only('limiter', c => { c.limiter.gain = 0; c.limiter.ceiling = 0 })
    const r2 = run(lp, x, x, { ...defaultEdit(), automation: { 'limiter.gain': [{ t: 0, v: 0 }, { t: 1, v: 0 }, { t: 1.01, v: 6 }] } })
    expect(peakDb(r2.oL, FS * 1.3, FS * 1.9) + 20).toBeCloseTo(6, 0)
  })
  it('구간만 처리: 구간 밖은 원본', () => {
    const x = sine(500, -12, 3)
    const p = only('eq', c => { c.eq.hpf.on = false; c.eq.mf = { on: true, freq: 500, gain: 6, q: 1 } })
    const r = run(p, x, x, { ...defaultEdit(), region: { start: 1, end: 2 } })
    expect(peakDb(r.oL, r.lat + FS * 0.3, r.lat + FS * 0.8) + 12).toBeCloseTo(0, 1)
    expect(peakDb(r.oL, r.lat + FS * 1.3, r.lat + FS * 1.8) + 12).toBeCloseTo(6, 0)
  })
})

describe('템플릿·자동 마스터링·레퍼런스', () => {
  it(`템플릿 ${TEMPLATES.length}개: 장르 25+·용도 8·질감 6, 근거 문구가 있다`, () => {
    expect(TEMPLATES.filter(t => t.category === 'genre').length).toBeGreaterThanOrEqual(25)
    expect(TEMPLATES.filter(t => t.category === 'use').length).toBe(8)
    expect(TEMPLATES.filter(t => t.category === 'texture').length).toBe(6)
    for (const t of TEMPLATES) expect(t.why.length).toBeGreaterThan(10)
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length)
  })
  it('모든 템플릿: 적용 + 자동 맞춤 후 LUFS 목표 ±1, 트루 피크 ≤ 천장+0.3', async () => {
    const [L, R] = musicTone(6)
    for (const t of TEMPLATES) {
      const res = await autoMatchLoudness([L, R], FS, t.build(), t.lufs)
      expect(Math.abs(res.integrated - t.lufs), `${t.id} ${res.integrated}`).toBeLessThanOrEqual(1)
      expect(res.truePeak, `${t.id} TP`).toBeLessThanOrEqual(t.tp + 0.3)
    }
  }, 120000)
  it('자동 마스터링: 고역이 지나친 곡이면 고역을 줄이고 이유를 적는다, 목표 라우드니스에 맞는다', async () => {
    const [L, R] = musicTone(6, 5, 0.5)
    const a = await analyzeAudio([L, R], FS, { spectrogramCols: 10 })
    const tpl = TEMPLATES.find(t => t.id === 'pop')!
    const { params, notes } = autoMaster(a, tpl)
    expect(params.eq.hf.gain).toBeLessThan(tpl.build().eq.hf.gain)
    expect(notes.length).toBeGreaterThan(0)
    const res = await autoMatchLoudness([L, R], FS, params, tpl.lufs)
    expect(Math.abs(res.integrated - tpl.lufs)).toBeLessThanOrEqual(1)
  })
  it('레퍼런스 매칭 곡선: 레퍼런스가 더 밝으면 고역 쪽이 +', async () => {
    const [L, R] = musicTone(4, 7, 0)
    const [L2, R2] = musicTone(4, 7, 0.4)
    const a = await analyzeAudio([L, R], FS, { spectrogramCols: 10 })
    const b = await analyzeAudio([L2, R2], FS, { spectrogramCols: 10 })
    const c = matchingCurve(a.bands, b.bands)
    expect(c[27]).toBeGreaterThan(1) // 10kHz 근처
    expect(c.every(v => Math.abs(v) <= 9)).toBe(true)
  })
})

describe('내보내기 형식', () => {
  it('32bit float WAV 는 값이 그대로', async () => {
    const x = new Float32Array([0.1, -0.25, 0.5])
    const v = new DataView(await encodeWav([x], 96000, 32, 'none').arrayBuffer())
    expect(v.getUint16(20, true)).toBe(3)
    expect(v.getUint32(24, true)).toBe(96000)
    const dataOff = 12 + 8 + 18 + 12 + 8
    expect(v.getFloat32(dataOff + 4, true)).toBeCloseTo(-0.25, 6)
  })
  it('노이즈 셰이핑 디더는 1~4kHz 잡음이 TPDF 보다 작다', async () => {
    const n = 16384, x = new Float32Array(n).fill(0)
    for (let i = 0; i < n; i++) x[i] = 0.3 * Math.sin(i * 0.001)
    const err = async (kind: 'tpdf' | 'shaped') => {
      const v = new DataView(await encodeWav([x], 44100, 16, kind, undefined, rng(1)).arrayBuffer())
      const re = new Float64Array(n), im = new Float64Array(n)
      for (let i = 0; i < n; i++) re[i] = v.getInt16(44 + i * 2, true) / 32767 - x[i]
      new FFT(n).transform(re, im)
      let e = 0
      for (let k = Math.round(1000 * n / 44100); k < Math.round(4000 * n / 44100); k++) e += re[k] * re[k] + im[k] * im[k]
      return e
    }
    expect(await err('shaped')).toBeLessThan((await err('tpdf')) * 0.5)
  })
  it('ID3 태그: 제목·아티스트·앨범·ISRC·커버를 다른 도구가 읽는다', () => {
    const cover = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    const tag = id3v23({ title: '우리 이야기', artist: '쿠키', album: '첫 앨범', isrc: 'KRA402600001', cover: { mime: 'image/jpeg', data: cover } })
    const read = NodeID3.read(Buffer.concat([Buffer.from(tag), Buffer.alloc(100)]))
    expect(read.title).toBe('우리 이야기')
    expect(read.artist).toBe('쿠키')
    expect(read.album).toBe('첫 앨범')
    expect(read.ISRC).toBe('KRA402600001')
    expect((read.image as { imageBuffer: Buffer }).imageBuffer.length).toBe(cover.length)
  })
  it('WAV 에 INFO·ID3 청크가 붙고 RIFF 크기가 맞다', async () => {
    const b = await encodeWav([new Float32Array(10)], 44100, 16, 'none', { title: 'A', artist: 'B' }).arrayBuffer()
    const v = new DataView(b)
    expect(v.getUint32(4, true)).toBe(b.byteLength - 8)
    const txt = new TextDecoder('latin1').decode(new Uint8Array(b))
    expect(txt.includes('LIST')).toBe(true)
    expect(txt.includes('id3 ')).toBe(true)
  })
  it('ZIP: 묶고 다시 읽으면 같다, CRC 가 맞고 unzip 도 통과', async () => {
    const a = new Blob([new Uint8Array([1, 2, 3, 4])]), b = new Blob(['한글 이름 파일'])
    const zip = await makeZip([{ name: '01 첫 곡.wav', data: a }, { name: 'session.json', data: b }])
    const back = await readZip(zip)
    expect([...back.keys()]).toEqual(['01 첫 곡.wav', 'session.json'])
    expect(new Uint8Array(await back.get('01 첫 곡.wav')!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    try {
      const dir = mkdtempSync(join(tmpdir(), 'zip-'))
      const f = join(dir, 't.zip')
      writeFileSync(f, Buffer.from(await zip.arrayBuffer()))
      const out = execFileSync('unzip', ['-t', f]).toString()
      expect(out).toMatch(/No errors/)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  })
})

describe('스템·앨범', () => {
  it('스템 믹스: 두 스템의 합, 뮤트·솔로·팬', async () => {
    const a = sine(500, -12, 0.2), b = sine(500, -12, 0.2)
    const s = (ch: Float32Array, o: Partial<{ gain: number; pan: number; mute: boolean; solo: boolean }> = {}) =>
      ({ channels: [ch, ch], gain: 0, pan: 0, mute: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, ...o })
    const [L] = await mixStems([s(a), s(b)], FS)
    expect(peakDb(L) + 12).toBeCloseTo(6, 1)
    const [L2] = await mixStems([s(a), s(b, { mute: true })], FS)
    expect(peakDb(L2) + 12).toBeCloseTo(0, 1)
    const [L3] = await mixStems([s(a), s(b, { solo: true })], FS)
    expect(peakDb(L3) + 12).toBeCloseTo(0, 1)
    const [L4, R4] = await mixStems([s(a, { pan: 100 })], FS)
    expect(peakDb(L4)).toBeLessThan(-60)
    expect(peakDb(R4) + 12).toBeCloseTo(3, 0)
  })
  it('앨범 이어 붙이기: 간격은 길이를 늘리고 크로스페이드는 겹친다', () => {
    const one = [new Float32Array(FS).fill(0.5), new Float32Array(FS).fill(0.5)]
    const gap = joinAlbum([{ channels: one, gapAfter: 2, xfadeAfter: 0 }, { channels: one, gapAfter: 0, xfadeAfter: 0 }], FS)
    expect(gap[0].length).toBe(FS * 4)
    expect(gap[0][FS + 10]).toBe(0)
    const xf = joinAlbum([{ channels: one, gapAfter: 0, xfadeAfter: 0.5 }, { channels: one, gapAfter: 0, xfadeAfter: 0 }], FS)
    expect(xf[0].length).toBe(FS * 1.5)
    // 등전력 크로스페이드 한가운데는 두 곡 합이 √2 배
    expect(xf[0][Math.round(FS * 0.75)]).toBeCloseTo(0.5 * Math.SQRT2, 2)
  })
  it('렌더: 편집 자르기만큼 길이가 줄고 페이드가 들어간다', async () => {
    const x = sine(500, -12, 3)
    const res = await renderChain([x, x], FS, off(), { edit: { ...defaultEdit(), start: 0.5, end: 2.5, fadeOut: { dur: 0.5, curve: 'lin' } } })
    expect(res.channels![0].length).toBe(FS * 2)
    expect(Math.abs(res.channels![0][FS * 2 - 5])).toBeLessThan(0.01)
    expect(measureIntegratedLufs(res.channels!, FS)).toBeLessThan(0)
  })
})

describe('무음 자르기', () => {
  it('앞 1초·뒤 2초 무음을 찾는다', async () => {
    const { detectSilence } = await import('./analyze')
    const x = new Float32Array(FS * 6)
    x.set(sine(440, -12, 3), FS)
    const r = detectSilence([x, x], FS, -60)
    expect(r.start).toBeCloseTo(0.99, 1)
    expect(r.end).toBeCloseTo(4.05, 1)
  })
})
