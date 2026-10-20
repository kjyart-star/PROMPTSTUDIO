/**
 * 마스터링 전수 점검용 합성 신호·측정 함수 (오프라인 계산만, 오디오 출력 없음).
 * 신호는 시드 고정이라 항상 같다.
 */
import { Biquad, designPass, linToDb, dbToLin, measureIntegratedLufs, TruePeakMeter } from './dsp'

export const FS = 48000

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

/** 핑크 노이즈(Paul Kellet) */
function pink(n: number, seed: number) {
  const r = rng(seed), x = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
    x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926
  }
  return x
}
const rmsLin = (x: Float32Array) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length) }
function scaleTo(x: Float32Array, db: number) { const g = dbToLin(db) / rmsLin(x); for (let i = 0; i < x.length; i++) x[i] *= g; return x }

export const SIG = {
  sec: 10,
  /** 본문(조용한 꼬리 앞) */
  body: [0.5, 8.4] as [number, number],
  /** 조용한 꼬리 — 모든 소리가 -40dB 로 줄어든다(게이트 점검용) */
  quiet: [8.8, 9.9] as [number, number],
  /** 치찰음 버스트: 1초마다 0.25초 지점에서 80ms */
  sibWindows: Array.from({ length: 8 }, (_, k) => [k + 0.25, k + 0.25 + 0.08] as [number, number]),
}

/** 48kHz 스테레오: 핑크 노이즈 + 60Hz·1k·8k 톤 + 0.5초 클릭 + 6~8k 치찰음 버스트 + 좌우 다른 사이드 */
export function makeSignal(sec = SIG.sec, seed = 11): Float32Array[] {
  const n = Math.round(sec * FS)
  const mid = scaleTo(pink(n, seed), -26)
  const sideL = scaleTo(pink(n, seed + 1), -34), sideR = scaleTo(pink(n, seed + 2), -34)
  const sibN = scaleTo(pink(n, seed + 3), 0)
  // 6~8k 대역 노이즈 (대역통과 2단)
  const bp1 = new Biquad(), bp2 = new Biquad(), bp3 = new Biquad(), bp4 = new Biquad()
  bp1.set(designPass('hp', 6000, 0.7071, FS)); bp2.set(designPass('hp', 6000, 0.7071, FS))
  bp3.set(designPass('lp', 8000, 0.7071, FS)); bp4.set(designPass('lp', 8000, 0.7071, FS))
  const sib = new Float32Array(n)
  for (let i = 0; i < n; i++) sib[i] = bp4.l(bp3.l(bp2.l(bp1.l(sibN[i]))))
  scaleTo(sib, -18)
  const rr = rng(77)
  const L = new Float32Array(n), R = new Float32Array(n)
  const clickLen = Math.round(0.003 * FS)
  const clickBuf = new Float32Array(clickLen)
  for (let i = 0; i < clickLen; i++) clickBuf[i] = (rr() * 2 - 1) * Math.exp(-i / (clickLen / 5))
  const quietFrom = Math.round(8.5 * FS)
  for (let i = 0; i < n; i++) {
    const t = i / FS
    const tones = dbToLin(-24) * Math.sin(2 * Math.PI * 60 * t) + dbToLin(-28) * Math.sin(2 * Math.PI * 1000 * t) + dbToLin(-38) * Math.sin(2 * Math.PI * 8000 * t)
    const ph = t - Math.floor(t)
    const sibEnv = ph >= 0.25 && ph < 0.33 ? Math.sin(Math.PI * (ph - 0.25) / 0.08) : 0
    const m = mid[i] + tones + sib[i] * sibEnv
    L[i] = m + sideL[i]; R[i] = m - sideR[i]
  }
  // 0.5초마다 클릭(피크 약 -4dBFS)
  for (let k = 0; k * 0.5 < 8.5 && (k * 0.5 + 0.01) < sec; k++) {
    const s0 = Math.round((k * 0.5 + 0.01) * FS)
    for (let i = 0; i < clickLen && s0 + i < n; i++) { L[s0 + i] += clickBuf[i] * 0.55; R[s0 + i] += clickBuf[i] * 0.5 }
  }
  // 조용한 꼬리: 8.5초부터 -40dB
  const g = dbToLin(-40)
  for (let i = quietFrom; i < n; i++) { L[i] *= g; R[i] *= g }
  return [L, R]
}

// ───────────────────────── 측정 ─────────────────────────

const sl = (x: Float32Array, win?: [number, number]) =>
  win ? x.subarray(Math.round(win[0] * FS), Math.min(x.length, Math.round(win[1] * FS))) : x

export type BandName = 'low' | 'mid' | 'high' | 'sib' | 'hmf' | 'full'
/** 대역 필터(버터워스 24dB/oct 근사: 2단) */
export function bandFilter(x: Float32Array, band: BandName): Float32Array {
  if (band === 'full') return x
  const stages: [('lp' | 'hp'), number][] =
    band === 'low' ? [['lp', 150], ['lp', 150]]
      : band === 'mid' ? [['hp', 150], ['hp', 150], ['lp', 4000], ['lp', 4000]]
        : band === 'high' ? [['hp', 4000], ['hp', 4000]]
          : band === 'hmf' ? [['hp', 2200], ['hp', 2200], ['lp', 3600], ['lp', 3600]]
          : [['hp', 5500], ['hp', 5500], ['lp', 9000], ['lp', 9000]]
  const bq = stages.map(([k, f]) => { const b = new Biquad(); b.set(designPass(k, f, 0.7071, FS)); return b })
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) { let v = x[i]; for (const b of bq) v = b.l(v); y[i] = v }
  return y
}

const ms = (x: Float32Array) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return s / Math.max(1, x.length) }

/** 대역 에너지 dB(좌우 평균). windows 가 있으면 그 구간들만 모아서 */
export function bandDb(ch: Float32Array[], band: BandName, win?: [number, number] | [number, number][]): number {
  const fl = bandFilter(ch[0], band), fr = bandFilter(ch[1], band)
  const wins: ([number, number] | undefined)[] = !win ? [undefined] : Array.isArray(win[0]) ? (win as [number, number][]) : [win as [number, number]]
  let e = 0, cnt = 0
  for (const w of wins) { const a = sl(fl, w), b = sl(fr, w); e += (ms(a) + ms(b)) / 2 * a.length; cnt += a.length }
  return 10 * Math.log10(e / Math.max(1, cnt) + 1e-30)
}

/** 사이드 / 미드 에너지 비(dB). 대역·구간 지정 가능 */
export function sideMidDb(ch: Float32Array[], band: BandName = 'full', win?: [number, number]): number {
  const n = ch[0].length, M = new Float32Array(n), S = new Float32Array(n)
  for (let i = 0; i < n; i++) { M[i] = (ch[0][i] + ch[1][i]) / 2; S[i] = (ch[0][i] - ch[1][i]) / 2 }
  const m = ms(sl(bandFilter(M, band), win)), s = ms(sl(bandFilter(S, band), win))
  return 10 * Math.log10((s + 1e-30) / (m + 1e-30))
}

export const samplePeakDb = (ch: Float32Array[], win?: [number, number]) => {
  let m = 0
  for (const c of ch) { const x = sl(c, win); for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])) }
  return linToDb(m)
}
export const rmsDbOf = (ch: Float32Array[], win?: [number, number]) =>
  10 * Math.log10((ms(sl(ch[0], win)) + ms(sl(ch[1], win))) / 2 + 1e-30)
/** 크레스트 팩터 = 피크 - RMS (dB) */
export const crestDb = (ch: Float32Array[], win?: [number, number]) => samplePeakDb(ch, win) - rmsDbOf(ch, win)
export const lufsOf = (ch: Float32Array[]) => measureIntegratedLufs(ch, FS)
export function truePeakDb(ch: Float32Array[]) {
  const m = new TruePeakMeter(); m.process(ch[0], ch[1], ch[0].length); return linToDb(m.max)
}
/** 게인 맞춤 후 잔차 dB (y 대비). 파형이 얼마나 바뀌었나 */
export function residualDb(ref: Float32Array[], out: Float32Array[]): number {
  let num = 0, den = 0, yy = 0
  for (let c = 0; c < 2; c++) for (let i = 0; i < ref[c].length; i++) { num += ref[c][i] * out[c][i]; den += ref[c][i] * ref[c][i]; yy += out[c][i] * out[c][i] }
  const g = num / (den + 1e-30); let r = 0
  for (let c = 0; c < 2; c++) for (let i = 0; i < ref[c].length; i++) { const d = out[c][i] - g * ref[c][i]; r += d * d }
  return 10 * Math.log10(r / (yy + 1e-30) + 1e-30)
}
