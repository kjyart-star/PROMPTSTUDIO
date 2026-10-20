/**
 * 마스터링 체인 DSP 코어.
 *
 * import 는 ./fft 하나뿐 — scripts/build-mastering-worklet.mjs 가 fft.ts 와 이 파일을 이어 붙여
 * AudioWorklet(실시간 재생)으로 싣고, 내보내기(오프라인 청크 렌더)와 단위 테스트도 같은 코드를 쓴다.
 * 그래서 들리는 소리와 내보낸 파일이 같다.
 */
import { PartitionedConvolver, designLinearPhaseFir } from './fft'

export const dbToLin = (db: number) => Math.pow(10, db / 20)
export const linToDb = (x: number) => (x > 1e-12 ? 20 * Math.log10(x) : -240)

// ───────────────────────── 파라미터 ─────────────────────────

export type SlotId =
  | 'gate' | 'eq' | 'mseq' | 'dyneq' | 'deesser' | 'match' | 'comp' | 'multiband'
  | 'transient' | 'imager' | 'stereo' | 'saturation' | 'clipper' | 'limiter'
export const ALL_SLOTS: SlotId[] = [
  'gate', 'eq', 'mseq', 'dyneq', 'deesser', 'match', 'comp', 'multiband',
  'transient', 'imager', 'stereo', 'saturation', 'clipper', 'limiter',
]

export interface EqBandParams { on: boolean; freq: number; gain: number; q: number }
export interface EqShelfParams extends EqBandParams { shape: 'shelf' | 'bell' }
export interface EqPassParams { on: boolean; freq: number; slope: 12 | 24 | 36 | 48 }
export interface EqParams {
  /** min: 최소 위상(지연 없음) · linear: 리니어 페이즈(위상 변화 없음, 지연 약 45ms) */
  mode: 'min' | 'linear'
  input: number
  output: number
  /** 거친 고역 다듬기 0~100 (3.5kHz 노치 + 10kHz 셸프 감쇠) */
  deharsh: number
  hpf: EqPassParams
  lf: EqShelfParams
  lmf: EqBandParams
  mf: EqBandParams
  hmf: EqBandParams
  hf: EqShelfParams
  lpf: EqPassParams
}
export interface MsBandSet {
  low: { freq: number; gain: number }
  b1: { freq: number; gain: number; q: number }
  b2: { freq: number; gain: number; q: number }
  high: { freq: number; gain: number }
}
export interface MsEqParams { mid: MsBandSet; side: MsBandSet }
export interface DynBandParams {
  on: boolean; freq: number; q: number
  /** 고정 게인 */
  gain: number
  threshold: number; ratio: number
  /** 다이내믹으로 움직일 최대 dB */
  range: number
  attack: number; release: number
  mode: 'cut' | 'boost'
}
export interface DynEqParams { bands: DynBandParams[] }
export interface DeesserParams { freq: number; threshold: number; range: number; listen: boolean }
/** 매칭 EQ — MATCH_FREQS 위치의 dB 곡선 */
export interface MatchParams { curve: number[]; strength: number }
export interface CompParams {
  threshold: number; ratio: number; attack: number; release: number
  knee: number; makeup: number; mix: number; autoMakeup: boolean
}
export interface MbBandParams {
  threshold: number; ratio: number; attack: number; release: number
  gain: number; on: boolean; solo: boolean
}
export interface MultibandParams { lowX: number; highX: number; bands: MbBandParams[] }
export interface ImagerParams { lowX: number; highX: number; widths: number[] }
export interface StereoParams { width: number; mid: number; side: number; bassMono: number }
export interface TransientParams { attack: number; sustain: number; output: number }
export interface GateParams { threshold: number; ratio: number; range: number; attack: number; hold: number; release: number }
export type SatMode = 'tape' | 'tube' | 'clip' | 'tapeWarm' | 'triode' | 'transformer'
export interface SaturationParams { drive: number; mode: SatMode; mix: number; output: number }
export interface ClipperParams { threshold: number; softness: number; output: number }
export interface LimiterParams { gain: number; ceiling: number; release: number; truePeak: boolean }

export interface ChainParams {
  order: SlotId[]
  /** 슬롯별 켬/끔 — true 면 그 슬롯을 거치지 않는다 */
  bypass: Record<SlotId, boolean>
  /** A/B: true 면 원본(지연 보정된 입력)을 들려준다 */
  listenOriginal: boolean
  /** 원본을 들려줄 때 곱할 음량 맞춤 dB */
  originalTrim: number
  inputTrim: number
  gate: GateParams
  eq: EqParams
  mseq: MsEqParams
  dyneq: DynEqParams
  deesser: DeesserParams
  match: MatchParams
  comp: CompParams
  multiband: MultibandParams
  transient: TransientParams
  imager: ImagerParams
  stereo: StereoParams
  saturation: SaturationParams
  clipper: ClipperParams
  limiter: LimiterParams
}

// ───────────────────────── 편집(시간축) 파라미터 ─────────────────────────

export interface AutoPoint { t: number; v: number }
export type FadeCurve = 'lin' | 'exp' | 'log' | 'scurve' | 'equal'
export type AutoTarget = 'volume' | 'eq.lf' | 'eq.lmf' | 'eq.mf' | 'eq.hmf' | 'eq.hf' | 'limiter.gain'
export const AUTO_TARGETS: AutoTarget[] = ['volume', 'eq.lf', 'eq.lmf', 'eq.mf', 'eq.hmf', 'eq.hf', 'limiter.gain']

export interface EditParams {
  /** 곡의 앞뒤 자르기(초). end 0 이하면 끝까지 */
  start: number
  end: number
  fadeIn: { dur: number; curve: FadeCurve }
  fadeOut: { dur: number; curve: FadeCurve }
  /** 이 구간만 처리(밖은 원본). null 이면 전체 처리 */
  region: { start: number; end: number } | null
  /** 오토메이션 — volume 은 상대 dB, 나머지는 그 파라미터의 절대값 */
  automation: Partial<Record<AutoTarget, AutoPoint[]>>
  /** 앨범 맞춤 등에서 더하는 입력 게인 dB */
  gainOffset: number
}

export function defaultEdit(): EditParams {
  return {
    start: 0, end: 0,
    fadeIn: { dur: 0, curve: 'scurve' }, fadeOut: { dur: 0, curve: 'scurve' },
    region: null, automation: {}, gainOffset: 0,
  }
}

export function fadeShape(x: number, c: FadeCurve): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  switch (c) {
    case 'lin': return x
    case 'exp': return x * x
    case 'log': return Math.sqrt(x)
    case 'scurve': return 0.5 - 0.5 * Math.cos(Math.PI * x)
    case 'equal': return Math.sin((Math.PI / 2) * x)
  }
}

/** 브레이크포인트 직선 보간 (점이 없으면 fallback) */
export function evalAuto(pts: AutoPoint[] | undefined, t: number, fallback: number): number {
  if (!pts || !pts.length) return fallback
  if (t <= pts[0].t) return pts[0].v
  const last = pts[pts.length - 1]
  if (t >= last.t) return last.v
  let lo = 0, hi = pts.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m }
  const a = pts[lo], b = pts[hi]
  return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1e-9, b.t - a.t)
}

// ───────────────────────── 바이쿼드 ─────────────────────────

export type Coefs = [number, number, number, number, number] // b0 b1 b2 a1 a2 (a0=1)

export const IDENTITY: Coefs = [1, 0, 0, 0, 0]

export function designPeaking(f: number, gain: number, q: number, fs: number): Coefs {
  const A = Math.pow(10, gain / 40)
  const w = (2 * Math.PI * clampF(f, fs)) / fs
  const alpha = Math.sin(w) / (2 * Math.max(q, 0.05))
  const cs = Math.cos(w)
  const a0 = 1 + alpha / A
  return [(1 + alpha * A) / a0, (-2 * cs) / a0, (1 - alpha * A) / a0, (-2 * cs) / a0, (1 - alpha / A) / a0]
}

export function designShelf(kind: 'low' | 'high', f: number, gain: number, q: number, fs: number): Coefs {
  const A = Math.pow(10, gain / 40)
  const w = (2 * Math.PI * clampF(f, fs)) / fs
  const cs = Math.cos(w)
  const alpha = Math.sin(w) / (2 * Math.max(q, 0.05))
  const s = 2 * Math.sqrt(A) * alpha
  if (kind === 'low') {
    const a0 = A + 1 + (A - 1) * cs + s
    return [
      (A * (A + 1 - (A - 1) * cs + s)) / a0,
      (2 * A * (A - 1 - (A + 1) * cs)) / a0,
      (A * (A + 1 - (A - 1) * cs - s)) / a0,
      (-2 * (A - 1 + (A + 1) * cs)) / a0,
      (A + 1 + (A - 1) * cs - s) / a0,
    ]
  }
  const a0 = A + 1 - (A - 1) * cs + s
  return [
    (A * (A + 1 + (A - 1) * cs + s)) / a0,
    (-2 * A * (A - 1 + (A + 1) * cs)) / a0,
    (A * (A + 1 + (A - 1) * cs - s)) / a0,
    (2 * (A - 1 - (A + 1) * cs)) / a0,
    (A + 1 - (A - 1) * cs - s) / a0,
  ]
}

export function designPass(kind: 'lp' | 'hp' | 'ap' | 'bp', f: number, q: number, fs: number): Coefs {
  const w = (2 * Math.PI * clampF(f, fs)) / fs
  const cs = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  if (kind === 'lp') return [(1 - cs) / 2 / a0, (1 - cs) / a0, (1 - cs) / 2 / a0, (-2 * cs) / a0, (1 - alpha) / a0]
  if (kind === 'hp') return [(1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, (-2 * cs) / a0, (1 - alpha) / a0]
  if (kind === 'bp') return [alpha / a0, 0, -alpha / a0, (-2 * cs) / a0, (1 - alpha) / a0]
  return [(1 - alpha) / a0, (-2 * cs) / a0, (1 + alpha) / a0, (-2 * cs) / a0, (1 - alpha) / a0]
}

/** 버터워스 기울기별 2차 단의 Q 값 */
export const BUTTER_Q: Record<number, number[]> = {
  12: [0.70710678],
  24: [0.54119610, 1.30656296],
  36: [0.51763809, 0.70710678, 1.93185165],
  48: [0.50979558, 0.60134489, 0.89997622, 2.56291545],
}

function clampF(f: number, fs: number) {
  return Math.min(Math.max(f, 5), fs * 0.49)
}

/** 바이쿼드 한 단의 dB 응답 (그래프용) */
export function coefsMagDb(c: Coefs, f: number, fs: number): number {
  const w = (2 * Math.PI * f) / fs
  const cos1 = Math.cos(w), sin1 = Math.sin(w), cos2 = Math.cos(2 * w), sin2 = Math.sin(2 * w)
  const nr = c[0] + c[1] * cos1 + c[2] * cos2
  const ni = -(c[1] * sin1 + c[2] * sin2)
  const dr = 1 + c[3] * cos1 + c[4] * cos2
  const di = -(c[3] * sin1 + c[4] * sin2)
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-30)
}

/** 스테레오 바이쿼드 (TDF-II) */
export class Biquad {
  c: Coefs = IDENTITY
  private l1 = 0; private l2 = 0; private r1 = 0; private r2 = 0
  set(c: Coefs) { this.c = c }
  reset() { this.l1 = this.l2 = this.r1 = this.r2 = 0 }
  l(x: number) {
    const c = this.c
    const y = c[0] * x + this.l1
    this.l1 = c[1] * x - c[3] * y + this.l2
    this.l2 = c[2] * x - c[4] * y
    return y
  }
  r(x: number) {
    const c = this.c
    const y = c[0] * x + this.r1
    this.r1 = c[1] * x - c[3] * y + this.r2
    this.r2 = c[2] * x - c[4] * y
    return y
  }
}

// ───────────────────────── 리니어 페이즈 FIR 공통 ─────────────────────────

export const FIR_TAPS = 4095
export const FIR_BLOCK = 128
export const FIR_LATENCY = FIR_BLOCK + (FIR_TAPS - 1) / 2

class FirStage {
  conv: PartitionedConvolver | null = null
  private key = ''
  constructor(private fs: number) {}
  design(key: string, mag: (f: number) => number) {
    if (key === this.key && this.conv) return
    this.key = key
    this.conv = new PartitionedConvolver(designLinearPhaseFir(mag, this.fs, FIR_TAPS), FIR_BLOCK)
  }
  process(L: Float32Array, R: Float32Array, n: number) { this.conv?.process(L, R, n) }
}

// ───────────────────────── 7밴드 EQ ─────────────────────────

/** EQ 파라미터를 바이쿼드 계수 목록으로 (게인 0 인 벨·셸프는 빼서 정확히 투명하게) */
export function eqSections(p: EqParams, fs: number): Coefs[] {
  const out: Coefs[] = []
  if (p.hpf.on) for (const q of BUTTER_Q[p.hpf.slope] ?? BUTTER_Q[12]) out.push(designPass('hp', p.hpf.freq, q, fs))
  const shelfOrBell = (b: EqShelfParams, kind: 'low' | 'high') => {
    if (!b.on || Math.abs(b.gain) < 1e-6) return
    out.push(b.shape === 'shelf' ? designShelf(kind, b.freq, b.gain, b.q, fs) : designPeaking(b.freq, b.gain, b.q, fs))
  }
  shelfOrBell(p.lf, 'low')
  for (const b of [p.lmf, p.mf, p.hmf]) if (b.on && Math.abs(b.gain) >= 1e-6) out.push(designPeaking(b.freq, b.gain, b.q, fs))
  shelfOrBell(p.hf, 'high')
  if (p.lpf.on) for (const q of BUTTER_Q[p.lpf.slope] ?? BUTTER_Q[12]) out.push(designPass('lp', p.lpf.freq, q, fs))
  if (p.deharsh > 0) {
    const t = Math.min(p.deharsh, 100) / 100
    out.push(designPeaking(3500, -6 * t, 1 + 1.5 * t, fs))
    out.push(designShelf('high', 10000, -4 * t, 0.7071, fs))
  }
  return out
}

export function eqResponseDb(p: EqParams, f: number, fs: number): number {
  let db = p.input + p.output
  for (const c of eqSections(p, fs)) db += coefsMagDb(c, f, fs)
  return db
}

class EqStage {
  private secs: Biquad[] = []
  private gIn = 1
  private gOut = 1
  private key = ''
  linear = false
  private fir: FirStage
  constructor(private fs: number) { this.fir = new FirStage(fs) }
  set(p: EqParams) {
    const key = JSON.stringify(p)
    if (key === this.key) return
    this.key = key
    this.linear = p.mode === 'linear'
    if (this.linear) {
      const secs = eqSections(p, this.fs)
      const g = p.input + p.output
      this.fir.design(key, f => {
        let db = g
        for (const c of secs) db += coefsMagDb(c, Math.max(f, 1), this.fs)
        return dbToLin(db)
      })
      return
    }
    const coefs = eqSections(p, this.fs)
    // 단 개수가 같으면 상태를 유지해 클릭을 줄인다
    if (coefs.length !== this.secs.length) this.secs = coefs.map(() => new Biquad())
    coefs.forEach((c, i) => this.secs[i].set(c))
    this.gIn = dbToLin(p.input)
    this.gOut = dbToLin(p.output)
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    if (this.linear) { this.fir.process(L, R, n); return }
    const g = this.gIn * this.gOut
    const s = this.secs
    for (let i = 0; i < n; i++) {
      let l = L[i], r = R[i]
      for (let k = 0; k < s.length; k++) { l = s[k].l(l); r = s[k].r(r) }
      L[i] = l * g; R[i] = r * g
    }
  }
}

// ───────────────────────── M/S EQ ─────────────────────────

export function msSections(b: MsBandSet, fs: number): Coefs[] {
  const out: Coefs[] = []
  if (Math.abs(b.low.gain) >= 1e-6) out.push(designShelf('low', b.low.freq, b.low.gain, 0.7071, fs))
  if (Math.abs(b.b1.gain) >= 1e-6) out.push(designPeaking(b.b1.freq, b.b1.gain, b.b1.q, fs))
  if (Math.abs(b.b2.gain) >= 1e-6) out.push(designPeaking(b.b2.freq, b.b2.gain, b.b2.q, fs))
  if (Math.abs(b.high.gain) >= 1e-6) out.push(designShelf('high', b.high.freq, b.high.gain, 0.7071, fs))
  return out
}

class MsEqStage {
  private mid: Biquad[] = []; private side: Biquad[] = []
  private key = ''
  constructor(private fs: number) {}
  set(p: MsEqParams) {
    const key = JSON.stringify(p)
    if (key === this.key) return
    this.key = key
    const m = msSections(p.mid, this.fs), s = msSections(p.side, this.fs)
    if (m.length !== this.mid.length) this.mid = m.map(() => new Biquad())
    if (s.length !== this.side.length) this.side = s.map(() => new Biquad())
    m.forEach((c, i) => this.mid[i].set(c)); s.forEach((c, i) => this.side[i].set(c))
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const M = this.mid, S = this.side
    if (!M.length && !S.length) return
    for (let i = 0; i < n; i++) {
      let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5
      for (let k = 0; k < M.length; k++) m = M[k].l(m)
      for (let k = 0; k < S.length; k++) s = S[k].r(s)
      L[i] = m + s; R[i] = m - s
    }
  }
}

// ───────────────────────── 컴프레서 ─────────────────────────

/** 정적 게인 커브: 입력 레벨 dB → 출력 레벨 dB (소프트 니) */
export function compCurve(x: number, threshold: number, ratio: number, knee: number): number {
  const over = x - threshold
  if (knee > 0 && 2 * Math.abs(over) <= knee) {
    return x + ((1 / ratio - 1) * (over + knee / 2) ** 2) / (2 * knee)
  }
  if (2 * over > knee) return threshold + over / ratio
  return x
}

/** 자동 메이크업: 0dBFS 입력에서 줄어드는 양의 절반을 되돌린다 */
export function autoMakeupDb(threshold: number, ratio: number, knee: number): number {
  return -0.5 * (compCurve(0, threshold, ratio, knee) - 0)
}

/** 스테레오 링크 피드포워드 컴프 — env(dB, ≤0)를 갱신한다 */
class CompCore {
  env = 0 // 현재 게인 리덕션 dB (음수)
  maxGr = 0
  private aA = 0; private aR = 0
  private T = -18; private R = 2; private K = 6
  constructor(private fs: number) {}
  set(threshold: number, ratio: number, attackMs: number, releaseMs: number, knee: number) {
    this.T = threshold; this.R = Math.max(1, ratio); this.K = Math.max(0, knee)
    this.aA = Math.exp(-1 / (Math.max(attackMs, 0.01) * 0.001 * this.fs))
    this.aR = Math.exp(-1 / (Math.max(releaseMs, 1) * 0.001 * this.fs))
  }
  /** 샘플 하나의 링크된 레벨로 게인 리덕션 dB 를 갱신해 돌려준다 */
  grDb(level: number) {
    const x = linToDb(level)
    const gr = compCurve(x, this.T, this.R, this.K) - x
    this.env = gr < this.env ? this.aA * this.env + (1 - this.aA) * gr : this.aR * this.env + (1 - this.aR) * gr
    if (this.env < this.maxGr) this.maxGr = this.env
    return this.env
  }
  gain(level: number) { return dbToLin(this.grDb(level)) }
}

class CompStage {
  core: CompCore
  private makeup = 1; private mix = 1
  constructor(fs: number) { this.core = new CompCore(fs) }
  set(p: CompParams) {
    this.core.set(p.threshold, p.ratio, p.attack, p.release, p.knee)
    this.makeup = dbToLin(p.makeup + (p.autoMakeup ? autoMakeupDb(p.threshold, p.ratio, p.knee) : 0))
    this.mix = Math.min(Math.max(p.mix, 0), 100) / 100
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const m = this.mix, d = 1 - m
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i]
      const g = this.core.gain(Math.max(Math.abs(l), Math.abs(r))) * this.makeup
      L[i] = l * (d + m * g); R[i] = r * (d + m * g)
    }
  }
}

// ───────────────────────── 다이내믹 EQ / 디에서 ─────────────────────────

/** 감지(대역) → 게인 리덕션 → 그 대역을 움직이는 벨/셸프 한 밴드 */
class DynBand {
  private det = new Biquad()
  private flt = new Biquad()
  private core: CompCore
  private p: DynBandParams | null = null
  private shape: 'bell' | 'hshelf' = 'bell'
  private cnt = 0
  private lastGain = NaN
  dyn = 0
  constructor(private fs: number) { this.core = new CompCore(fs) }
  set(p: DynBandParams, shape: 'bell' | 'hshelf' = 'bell') {
    this.p = p; this.shape = shape
    this.det.set(shape === 'hshelf' ? designPass('hp', p.freq, 0.7071, this.fs) : designPass('bp', p.freq, Math.max(0.3, p.q), this.fs))
    this.core.set(p.threshold, Math.max(1, p.ratio), p.attack, p.release, 2)
    this.lastGain = NaN
  }
  /** 감지 신호(리슨용) — step 뒤에 읽는다 */
  dl = 0; dr = 0
  step(l: number, r: number, out: Float32Array, i: number, outR: Float32Array) {
    const p = this.p!
    const dl = this.det.l(l), dr = this.det.r(r)
    this.dl = dl; this.dr = dr
    const gr = this.core.grDb(Math.max(Math.abs(dl), Math.abs(dr)))
    const dynDb = p.mode === 'cut' ? Math.max(-p.range, gr) : Math.min(p.range, -gr)
    this.dyn = dynDb
    if ((this.cnt++ & 15) === 0) {
      const g = p.gain + dynDb
      if (!(Math.abs(g - this.lastGain) <= 0.02)) {
        this.lastGain = g
        this.flt.set(this.shape === 'hshelf' ? designShelf('high', p.freq, g, 0.7071, this.fs) : designPeaking(p.freq, g, p.q, this.fs))
      }
    }
    out[i] = this.flt.l(l); outR[i] = this.flt.r(r)
  }
}

class DynEqStage {
  bands: DynBand[] = []
  private on: boolean[] = []
  constructor(private fs: number) {}
  set(p: DynEqParams) {
    while (this.bands.length < p.bands.length) this.bands.push(new DynBand(this.fs))
    p.bands.forEach((b, i) => { this.bands[i].set(b); this.on[i] = b.on })
    this.on.length = p.bands.length
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    for (let k = 0; k < this.on.length; k++) {
      if (!this.on[k]) continue
      const b = this.bands[k]
      for (let i = 0; i < n; i++) b.step(L[i], R[i], L, i, R)
    }
  }
}

class DeesserStage {
  band: DynBand
  private listen = false
  constructor(fs: number) { this.band = new DynBand(fs) }
  set(p: DeesserParams) {
    this.listen = p.listen
    this.band.set({ on: true, freq: p.freq, q: 1, gain: 0, threshold: p.threshold, ratio: 6, range: p.range, attack: 0.5, release: 60, mode: 'cut' }, 'hshelf')
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    for (let i = 0; i < n; i++) {
      this.band.step(L[i], R[i], L, i, R)
      if (this.listen) { L[i] = this.band.dl; R[i] = this.band.dr }
    }
  }
}

// ───────────────────────── 매칭 EQ (리니어 페이즈) ─────────────────────────

/** 1/3 옥타브 중심 주파수 31개 (20Hz~20kHz) */
export const MATCH_FREQS: number[] = Array.from({ length: 31 }, (_, i) => 20 * Math.pow(2, i / 3))

export function matchCurveDb(curve: number[], strength: number, f: number): number {
  if (!curve.length) return 0
  const x = Math.log2(Math.max(f, 1) / 20) * 3
  let v: number
  if (x <= 0) v = curve[0]
  else if (x >= curve.length - 1) v = curve[curve.length - 1]
  else { const i = Math.floor(x), t = x - i; v = curve[i] * (1 - t) + curve[i + 1] * t }
  return (v * strength) / 100
}

export const matchActive = (p: ChainParams) =>
  !p.bypass.match && p.match.strength > 0 && p.match.curve.some(v => Math.abs(v) > 0.01)

class MatchStage {
  private fir: FirStage
  constructor(fs: number) { this.fir = new FirStage(fs) }
  set(p: MatchParams) {
    const key = JSON.stringify(p)
    this.fir.design(key, f => dbToLin(matchCurveDb(p.curve, p.strength, f)))
  }
  process(L: Float32Array, R: Float32Array, n: number) { this.fir.process(L, R, n) }
}

// ───────────────────────── 3밴드 크로스오버 (LR4) ─────────────────────────

class Crossover3 {
  private lp1a = new Biquad(); private lp1b = new Biquad()
  private hp1a = new Biquad(); private hp1b = new Biquad()
  private lp2a = new Biquad(); private lp2b = new Biquad()
  private hp2a = new Biquad(); private hp2b = new Biquad()
  private ap2 = new Biquad()
  private key = ''
  // 결과 [저L, 저R, 중L, 중R, 고L, 고R]
  o = new Float64Array(6)
  constructor(private fs: number) {}
  set(lowX: number, highX: number) {
    const key = `${lowX}|${highX}`
    if (key === this.key) return
    this.key = key
    const fs = this.fs
    const lo = Math.min(lowX, highX * 0.8), hi = highX
    const q = Math.SQRT1_2
    const lp1 = designPass('lp', lo, q, fs), hp1 = designPass('hp', lo, q, fs)
    const lp2 = designPass('lp', hi, q, fs), hp2 = designPass('hp', hi, q, fs)
    this.lp1a.set(lp1); this.lp1b.set(lp1); this.hp1a.set(hp1); this.hp1b.set(hp1)
    this.lp2a.set(lp2); this.lp2b.set(lp2); this.hp2a.set(hp2); this.hp2b.set(hp2)
    this.ap2.set(designPass('ap', hi, q, fs))
  }
  split(l: number, r: number) {
    const o = this.o
    // 저역: LR4 LP(f1) → 위상 맞춤용 올패스(f2) / LR4 는 저·고가 같은 위상이라 합이 평탄
    o[0] = this.ap2.l(this.lp1b.l(this.lp1a.l(l)))
    o[1] = this.ap2.r(this.lp1b.r(this.lp1a.r(r)))
    const restL = this.hp1b.l(this.hp1a.l(l))
    const restR = this.hp1b.r(this.hp1a.r(r))
    o[2] = this.lp2b.l(this.lp2a.l(restL)); o[3] = this.lp2b.r(this.lp2a.r(restR))
    o[4] = this.hp2b.l(this.hp2a.l(restL)); o[5] = this.hp2b.r(this.hp2a.r(restR))
    return o
  }
}

class MultibandStage {
  private x: Crossover3
  cores: CompCore[]
  private gains = [1, 1, 1]
  private active = [1, 1, 1]
  constructor(fs: number) { this.x = new Crossover3(fs); this.cores = [new CompCore(fs), new CompCore(fs), new CompCore(fs)] }
  set(p: MultibandParams) {
    this.x.set(p.lowX, p.highX)
    const anySolo = p.bands.some(b => b.solo)
    p.bands.slice(0, 3).forEach((b, i) => {
      this.cores[i].set(b.threshold, b.ratio, b.attack, b.release, 3)
      this.gains[i] = b.on ? dbToLin(b.gain) : 1
      this.active[i] = b.on ? 1 : 0
      if (anySolo && !b.solo) this.gains[i] = 0
    })
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const [c0, c1, c2] = this.cores
    const [g0, g1, g2] = this.gains
    const [a0, a1, a2] = this.active
    for (let i = 0; i < n; i++) {
      const o = this.x.split(L[i], R[i])
      let lL = o[0], lR = o[1], mL = o[2], mR = o[3], hL = o[4], hR = o[5]
      if (a0) { const g = c0.gain(Math.max(Math.abs(lL), Math.abs(lR))); lL *= g; lR *= g }
      if (a1) { const g = c1.gain(Math.max(Math.abs(mL), Math.abs(mR))); mL *= g; mR *= g }
      if (a2) { const g = c2.gain(Math.max(Math.abs(hL), Math.abs(hR))); hL *= g; hR *= g }
      L[i] = lL * g0 + mL * g1 + hL * g2
      R[i] = lR * g0 + mR * g1 + hR * g2
    }
  }
}

/** 멀티밴드 이미저 — 대역마다 스테레오 폭 */
class ImagerStage {
  private x: Crossover3
  private w = [1, 1, 1]
  constructor(fs: number) { this.x = new Crossover3(fs) }
  set(p: ImagerParams) {
    this.x.set(p.lowX, p.highX)
    this.w = [0, 1, 2].map(i => Math.max(0, p.widths[i] ?? 100) / 100)
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const w = this.w
    for (let i = 0; i < n; i++) {
      const o = this.x.split(L[i], R[i])
      let l = 0, r = 0
      for (let b = 0; b < 3; b++) {
        const m = (o[b * 2] + o[b * 2 + 1]) * 0.5, s = (o[b * 2] - o[b * 2 + 1]) * 0.5 * w[b]
        l += m + s; r += m - s
      }
      L[i] = l; R[i] = r
    }
  }
}

// ───────────────────────── 스테레오 폭 / M-S / 저역 모노 크로스오버 ─────────────────────────

class StereoStage {
  private hpA = new Biquad(); private hpB = new Biquad()
  private bassMono = 0
  private mid = 1; private side = 1
  constructor(private fs: number) {}
  set(p: StereoParams) {
    this.mid = dbToLin(p.mid)
    this.side = dbToLin(p.side) * Math.max(0, p.width) / 100
    if (p.bassMono !== this.bassMono) {
      this.bassMono = p.bassMono
      if (p.bassMono > 0) {
        // 사이드에 LR4 하이패스 — 크로스오버 아래는 완전 모노, 미드는 손대지 않는다
        const c = designPass('hp', p.bassMono, Math.SQRT1_2, this.fs)
        this.hpA.set(c); this.hpB.set(c)
      }
    }
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const bm = this.bassMono > 0
    for (let i = 0; i < n; i++) {
      const m = (L[i] + R[i]) * 0.5 * this.mid
      let s = (L[i] - R[i]) * 0.5 * this.side
      if (bm) s = this.hpB.l(this.hpA.l(s))
      L[i] = m + s; R[i] = m - s
    }
  }
}

// ───────────────────────── 트랜지언트 셰이퍼 ─────────────────────────

class TransientStage {
  private fA = 0; private sA = 0; private fR = 0; private sR = 0
  private c: { fa: number; sa: number; r1: number; r2: number; rel: number }
  private atk = 0; private sus = 0; private out = 1
  gainDb = 0
  constructor(fs: number) {
    const k = (ms: number) => Math.exp(-1 / (ms * 0.001 * fs))
    this.c = { fa: k(0.5), sa: k(25), r1: k(40), r2: k(250), rel: k(80) }
  }
  set(p: TransientParams) { this.atk = p.attack / 100; this.sus = p.sustain / 100; this.out = dbToLin(p.output) }
  process(L: Float32Array, R: Float32Array, n: number) {
    const c = this.c
    for (let i = 0; i < n; i++) {
      const x = Math.max(Math.abs(L[i]), Math.abs(R[i])) + 1e-9
      // 어택: 빠른 엔벨로프가 느린 엔벨로프보다 앞설 때
      this.fA = x > this.fA ? c.fa * this.fA + (1 - c.fa) * x : c.rel * this.fA + (1 - c.rel) * x
      this.sA = x > this.sA ? c.sa * this.sA + (1 - c.sa) * x : c.rel * this.sA + (1 - c.rel) * x
      // 서스테인: 느리게 떨어지는 엔벨로프가 빨리 떨어지는 것보다 클 때(꼬리)
      this.fR = x > this.fR ? c.fa * this.fR + (1 - c.fa) * x : c.r1 * this.fR + (1 - c.r1) * x
      this.sR = x > this.sR ? c.fa * this.sR + (1 - c.fa) * x : c.r2 * this.sR + (1 - c.r2) * x
      const aDiff = Math.max(0, linToDb(this.fA) - linToDb(this.sA))
      const sDiff = Math.max(0, linToDb(this.sR) - linToDb(this.fR))
      let g = this.atk * aDiff * 1.5 + this.sus * sDiff * 0.8
      g = Math.max(-15, Math.min(12, g))
      this.gainDb = g
      const lin = dbToLin(g) * this.out
      L[i] *= lin; R[i] *= lin
    }
  }
}

// ───────────────────────── 게이트 / 익스팬더 ─────────────────────────

class GateStage {
  private env = 0
  private holdCnt = 0
  private gDb = 0
  private aA = 0; private aR = 0; private hold = 0; private eA = 0
  private T = -60; private ratio = 2; private range = 40
  gr = 0
  constructor(private fs: number) { this.eA = Math.exp(-1 / (0.005 * fs)) }
  set(p: GateParams) {
    this.T = p.threshold; this.ratio = Math.max(1, p.ratio); this.range = Math.max(0, p.range)
    this.aA = Math.exp(-1 / (Math.max(0.05, p.attack) * 0.001 * this.fs))
    this.aR = Math.exp(-1 / (Math.max(1, p.release) * 0.001 * this.fs))
    this.hold = Math.round(p.hold * 0.001 * this.fs)
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    for (let i = 0; i < n; i++) {
      const x = Math.max(Math.abs(L[i]), Math.abs(R[i]))
      this.env = x > this.env ? x : this.eA * this.env + (1 - this.eA) * x
      const lv = linToDb(this.env)
      let target = 0
      if (lv < this.T) target = Math.max(-this.range, (lv - this.T) * (this.ratio - 1))
      if (target >= this.gDb) { this.gDb = this.aA * this.gDb + (1 - this.aA) * target; this.holdCnt = this.hold }
      else if (this.holdCnt > 0) this.holdCnt--
      else this.gDb = this.aR * this.gDb + (1 - this.aR) * target
      this.gr = this.gDb
      const g = dbToLin(this.gDb)
      L[i] *= g; R[i] *= g
    }
  }
}

// ───────────────────────── 새추레이션 ─────────────────────────

export function saturate(x: number, mode: SatMode): number {
  switch (mode) {
    case 'tube': return Math.tanh(x + 0.15 * x * x)
    // 3극관: 양의 반파는 일찍, 음의 반파는 늦게 눌린다 → 짝수 배음
    case 'triode': return Math.tanh(x >= 0 ? x * 1.15 : x * 0.85)
    case 'clip':
      if (x > 1) return 2 / 3
      if (x < -1) return -2 / 3
      return x - (x * x * x) / 3
    default: return Math.tanh(x)
  }
}

class SaturationStage {
  private drive = 1; private mix = 1; private out = 1
  private mode: SatMode = 'tape'
  private dcL = 0; private dcR = 0; private dcxL = 0; private dcxR = 0
  private dcA: number
  private pre = new Biquad(); private post = new Biquad(); private lowLP = new Biquad(); private lowLP2 = new Biquad()
  constructor(fs: number) {
    this.dcA = Math.exp((-2 * Math.PI * 10) / fs)
    // 테이프 엠퍼시스: 녹음 때 고역을 올렸다가 재생 때 내린다 → 고역은 덜 찌그러지고 따뜻해진다
    this.pre.set(designShelf('high', 3000, 6, 0.7071, fs))
    this.post.set(designShelf('high', 3000, -6, 0.7071, fs))
    const lp = designPass('lp', 180, Math.SQRT1_2, fs)
    this.lowLP.set(lp); this.lowLP2.set(lp)
  }
  set(p: SaturationParams) {
    this.drive = dbToLin(p.drive); this.mode = p.mode
    this.mix = Math.min(Math.max(p.mix, 0), 100) / 100
    this.out = dbToLin(p.output)
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const g = this.drive, m = this.mix, o = this.out, a = this.dcA
    const norm = 1 / g
    const mode = this.mode
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i]
      let sl: number, sr: number
      if (mode === 'tapeWarm') {
        sl = this.post.l(Math.tanh(this.pre.l(l) * g) * norm)
        sr = this.post.r(Math.tanh(this.pre.r(r) * g) * norm)
      } else if (mode === 'transformer') {
        // 저역만 포화 — 트랜스포머 코어처럼 베이스가 두꺼워진다
        const lowL = this.lowLP2.l(this.lowLP.l(l)), lowR = this.lowLP2.r(this.lowLP.r(r))
        sl = l - lowL + Math.tanh(lowL * g) * norm
        sr = r - lowR + Math.tanh(lowR * g) * norm
      } else {
        sl = saturate(l * g, mode) * norm
        sr = saturate(r * g, mode) * norm
      }
      if (mode === 'tube' || mode === 'triode') {
        // 비대칭 왜곡이 만드는 DC 제거 (1차 하이패스 10Hz)
        const yl = sl - this.dcxL + a * this.dcL; this.dcxL = sl; this.dcL = yl; sl = yl
        const yr = sr - this.dcxR + a * this.dcR; this.dcxR = sr; this.dcR = yr; sr = yr
      }
      L[i] = (l * (1 - m) + sl * m) * o
      R[i] = (r * (1 - m) + sr * m) * o
    }
  }
}

// ───────────────────────── 소프트 클리퍼 ─────────────────────────

export function softClip(x: number, t: number, k: number): number {
  const a = Math.abs(x)
  const knee = t * Math.max(0.001, k)
  const lin = t - knee
  if (a <= lin) return x
  const y = lin + knee * Math.tanh((a - lin) / knee)
  return Math.sign(x) * Math.min(t, y)
}

class ClipperStage {
  private t = 1; private k = 0.3; private out = 1
  clipped = 0
  set(p: ClipperParams) { this.t = dbToLin(Math.min(0, p.threshold)); this.k = Math.min(1, Math.max(0, p.softness / 100)); this.out = dbToLin(p.output) }
  process(L: Float32Array, R: Float32Array, n: number) {
    const t = this.t, k = this.k, o = this.out
    let c = 0
    for (let i = 0; i < n; i++) {
      const l = softClip(L[i], t, k), r = softClip(R[i], t, k)
      if (l !== L[i] || r !== R[i]) c++
      L[i] = l * o; R[i] = r * o
    }
    this.clipped = c
  }
}

// ───────────────────────── 트루 피크 보간 (4배) ─────────────────────────

const TP_HALF = 6 // 위상당 12탭
/** 4배 오버샘플 보간 필터 (윈도 sinc), 위상 1·2·3 */
export const TP_PHASES: Float64Array[] = (() => {
  const phases: Float64Array[] = []
  for (let p = 1; p < 4; p++) {
    const frac = p / 4
    const taps = new Float64Array(TP_HALF * 2)
    let sum = 0
    for (let k = 0; k < TP_HALF * 2; k++) {
      const t = k - (TP_HALF - 1) - frac
      const x = Math.PI * t
      const sinc = Math.abs(t) < 1e-9 ? 1 : Math.sin(x) / x
      const win = 0.5 + 0.5 * Math.cos((Math.PI * t) / (TP_HALF + 0.5))
      taps[k] = sinc * win
      sum += taps[k]
    }
    for (let k = 0; k < taps.length; k++) taps[k] /= sum
    phases.push(taps)
  }
  return phases
})()

/** 한 채널의 최근 2*TP_HALF 샘플 링버퍼로 샘플 사이 피크를 추정 */
class TpHistory {
  buf = new Float64Array(TP_HALF * 2)
  pos = 0
  push(x: number) { this.buf[this.pos] = x; this.pos = (this.pos + 1) % this.buf.length }
  peak(): number {
    const N = this.buf.length
    let m = Math.abs(this.buf[(this.pos + TP_HALF - 1) % N])
    for (const taps of TP_PHASES) {
      let acc = 0
      for (let k = 0; k < N; k++) acc += taps[k] * this.buf[(this.pos + k) % N]
      const a = Math.abs(acc)
      if (a > m) m = a
    }
    return m
  }
}

// ───────────────────────── 브릭월 리미터 ─────────────────────────

class LimiterStage {
  readonly look: number
  readonly latency: number
  private dL: Float32Array; private dR: Float32Array; private dPos = 0
  private tpL = new TpHistory(); private tpR = new TpHistory()
  private qv: Float64Array; private qi: Int32Array; private qh = 0; private qt = 0
  private box: Float64Array; private boxPos = 0; private boxSum: number
  private t = 0
  private g = 1
  private relA = 0
  private inGain = 1; private ceil = 0.89
  private tp = true
  private fs: number
  gr = 0
  maxGr = 0
  constructor(fs: number) {
    this.look = Math.max(8, Math.round(fs * 0.0015))
    this.latency = this.look - 1 + TP_HALF
    this.dL = new Float32Array(this.latency + 1)
    this.dR = new Float32Array(this.latency + 1)
    this.qv = new Float64Array(this.look + 1)
    this.qi = new Int32Array(this.look + 1)
    this.box = new Float64Array(this.look).fill(1)
    this.boxSum = this.look
    this.fs = fs
  }
  set(p: LimiterParams) {
    this.inGain = dbToLin(p.gain)
    this.ceil = dbToLin(Math.min(p.ceiling, 0))
    this.tp = p.truePeak
    this.relA = Math.exp(-1 / (Math.max(p.release, 1) * 0.001 * this.fs))
  }
  setGain(db: number) { this.inGain = dbToLin(db) }
  private pushMin(v: number) {
    const cap = this.qv.length
    while (this.qt !== this.qh) {
      const last = (this.qt - 1 + cap) % cap
      if (this.qv[last] >= v) this.qt = last
      else break
    }
    this.qv[this.qt] = v; this.qi[this.qt] = this.t; this.qt = (this.qt + 1) % cap
    while (this.qi[this.qh] <= this.t - this.look) this.qh = (this.qh + 1) % cap
    return this.qv[this.qh]
  }
  process(L: Float32Array, R: Float32Array, n: number) {
    const ceil = this.ceil, N = this.dL.length
    let minG = 1
    for (let i = 0; i < n; i++) {
      const l = L[i] * this.inGain, r = R[i] * this.inGain
      this.tpL.push(l); this.tpR.push(r)
      let pk: number
      if (this.tp) pk = Math.max(this.tpL.peak(), this.tpR.peak())
      else {
        const b = this.tpL.buf, c = this.tpR.buf, k = (this.tpL.pos + TP_HALF - 1) % b.length
        pk = Math.max(Math.abs(b[k]), Math.abs(c[k]))
      }
      const req = pk > ceil ? ceil / pk : 1
      const held = this.pushMin(req)
      this.t++
      this.boxSum += held - this.box[this.boxPos]
      this.box[this.boxPos] = held
      this.boxPos = (this.boxPos + 1) % this.look
      const smooth = this.boxSum / this.look
      const rel = this.g + (1 - this.g) * (1 - this.relA)
      this.g = Math.min(smooth, rel)
      if (this.g < minG) minG = this.g
      this.dL[this.dPos] = l; this.dR[this.dPos] = r
      const rd = (this.dPos + 1) % N
      this.dPos = rd
      let ol = this.dL[rd] * this.g, or = this.dR[rd] * this.g
      // 안전 클립 — 샘플 피크는 절대 ceiling 을 넘지 않는다
      if (ol > ceil) ol = ceil; else if (ol < -ceil) ol = -ceil
      if (or > ceil) or = ceil; else if (or < -ceil) or = -ceil
      L[i] = ol; R[i] = or
    }
    this.gr = linToDb(minG)
    if (this.gr < this.maxGr) this.maxGr = this.gr
  }
}

/** 지연선 — 읽는 지연을 바꿀 수 있다(원본 A/B, 꺼진 리미터 지연 맞춤) */
class DelayLine {
  private bl: Float32Array; private br: Float32Array; private p = 0
  delay: number
  constructor(maxLen: number, delay = maxLen) { this.bl = new Float32Array(maxLen + 1); this.br = new Float32Array(maxLen + 1); this.delay = delay }
  process(L: Float32Array, R: Float32Array, n: number) {
    const N = this.bl.length
    const d = Math.min(this.delay, N - 1)
    for (let i = 0; i < n; i++) {
      this.bl[this.p] = L[i]; this.br[this.p] = R[i]
      const rd = (this.p - d + N) % N
      L[i] = this.bl[rd]; R[i] = this.br[rd]
      this.p = (this.p + 1) % N
    }
  }
}

// ───────────────────────── 라우드니스 (ITU-R BS.1770-4 / EBU R128) ─────────────────────────

export function kWeightingCoefs(fs: number): [Coefs, Coefs] {
  let f0 = 1681.974450955533
  const G = 3.999843853973347
  let Q = 0.7071752369554196
  let K = Math.tan((Math.PI * f0) / fs)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  let a0 = 1 + K / Q + K * K
  const pre: Coefs = [
    (Vh + (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - Vh)) / a0,
    (Vh - (Vb * K) / Q + K * K) / a0,
    (2 * (K * K - 1)) / a0,
    (1 - K / Q + K * K) / a0,
  ]
  f0 = 38.13547087602444
  Q = 0.5003270373238773
  K = Math.tan((Math.PI * f0) / fs)
  a0 = 1 + K / Q + K * K
  const rlb: Coefs = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0]
  return [pre, rlb]
}

export class LoudnessMeter {
  private pre = new Biquad(); private rlb = new Biquad()
  private sub: number
  private subCount = 0; private subSum = 0
  private ring = new Float64Array(30); private ringN = 0; private ringPos = 0
  /** 400ms 블록 에너지 (적분 라우드니스 게이팅용) */
  blocks: number[] = []
  /** 100ms 마다의 단기(3s) 라우드니스 — LRA·그래프용 (3s 가 차기 전은 넣지 않는다) */
  shortSeries: number[] = []
  /** 100ms 마다의 모멘터리 */
  momentarySeries: number[] = []
  momentary = -Infinity
  shortTerm = -Infinity
  maxMomentary = -Infinity
  maxShortTerm = -Infinity
  constructor(fs: number) {
    const [a, b] = kWeightingCoefs(fs)
    this.pre.set(a); this.rlb.set(b)
    this.sub = Math.round(fs / 10)
  }
  reset() {
    this.pre.reset(); this.rlb.reset()
    this.subCount = 0; this.subSum = 0; this.ring.fill(0); this.ringN = 0; this.ringPos = 0
    this.blocks = []; this.shortSeries = []; this.momentarySeries = []
    this.momentary = this.shortTerm = this.maxMomentary = this.maxShortTerm = -Infinity
  }
  process(L: Float32Array, R: Float32Array | null, n: number) {
    for (let i = 0; i < n; i++) {
      const l = this.rlb.l(this.pre.l(L[i]))
      let e = l * l
      if (R) { const r = this.rlb.r(this.pre.r(R[i])); e += r * r }
      this.subSum += e
      if (++this.subCount === this.sub) this.closeSub()
    }
  }
  private closeSub() {
    this.ring[this.ringPos] = this.subSum / this.sub
    this.ringPos = (this.ringPos + 1) % 30
    if (this.ringN < 30) this.ringN++
    this.subSum = 0; this.subCount = 0
    if (this.ringN >= 4) {
      let s = 0
      for (let k = 1; k <= 4; k++) s += this.ring[(this.ringPos - k + 30) % 30]
      const e = s / 4
      this.blocks.push(e)
      this.momentary = energyToLufs(e)
      this.momentarySeries.push(this.momentary)
      if (this.momentary > this.maxMomentary) this.maxMomentary = this.momentary
    }
    if (this.ringN >= 30) {
      let s = 0
      for (let k = 0; k < 30; k++) s += this.ring[k]
      this.shortTerm = energyToLufs(s / 30)
      this.shortSeries.push(this.shortTerm)
      if (this.shortTerm > this.maxShortTerm) this.maxShortTerm = this.shortTerm
    } else if (this.ringN >= 4) {
      let s = 0
      for (let k = 1; k <= this.ringN; k++) s += this.ring[(this.ringPos - k + 30) % 30]
      this.shortTerm = energyToLufs(s / this.ringN)
    }
  }
  integrated(): number { return gatedIntegrated(this.blocks) }
  lra(): number { return loudnessRange(this.shortSeries) }
}

export const energyToLufs = (e: number) => (e > 0 ? -0.691 + 10 * Math.log10(e) : -Infinity)

export function gatedIntegrated(blocks: ArrayLike<number>): number {
  const absGate = Math.pow(10, (-70 + 0.691) / 10)
  let sum = 0, cnt = 0
  for (let i = 0; i < blocks.length; i++) if (blocks[i] > absGate) { sum += blocks[i]; cnt++ }
  if (!cnt) return -Infinity
  const relGate = (sum / cnt) * Math.pow(10, -10 / 10)
  sum = 0; cnt = 0
  for (let i = 0; i < blocks.length; i++) if (blocks[i] > absGate && blocks[i] > relGate) { sum += blocks[i]; cnt++ }
  return cnt ? energyToLufs(sum / cnt) : -Infinity
}

/** EBU Tech 3342 라우드니스 레인지: 단기 값 → -70 절대·-20 상대 게이트 → 10~95 백분위 차 */
export function loudnessRange(shortTerm: ArrayLike<number>): number {
  const v: number[] = []
  for (let i = 0; i < shortTerm.length; i++) if (shortTerm[i] > -70) v.push(shortTerm[i])
  if (v.length < 2) return 0
  let e = 0
  for (const x of v) e += Math.pow(10, (x + 0.691) / 10)
  const rel = energyToLufs(e / v.length) - 20
  const g = v.filter(x => x > rel).sort((a, b) => a - b)
  if (g.length < 2) return 0
  const pct = (p: number) => g[Math.min(g.length - 1, Math.max(0, Math.round((p / 100) * (g.length - 1))))]
  return pct(95) - pct(10)
}

/** 버퍼 전체의 통합 라우드니스 (테스트·분석용) */
export function measureIntegratedLufs(channels: Float32Array[], fs: number): number {
  const m = new LoudnessMeter(fs)
  m.process(channels[0], channels[1] ?? null, channels[0].length)
  return m.integrated()
}

export class TruePeakMeter {
  private h = [new TpHistory(), new TpHistory()]
  max = 0
  recent = 0
  process(L: Float32Array, R: Float32Array, n: number) {
    let m = 0
    for (let i = 0; i < n; i++) {
      this.h[0].push(L[i]); this.h[1].push(R[i])
      const p = Math.max(this.h[0].peak(), this.h[1].peak())
      if (p > m) m = p
    }
    this.recent = Math.max(this.recent, m)
    if (m > this.max) this.max = m
  }
  reset() { this.max = 0; this.recent = 0 }
}

// ───────────────────────── 체인 ─────────────────────────

export interface LevelStats { peakL: number; peakR: number; rmsL: number; rmsR: number }

export interface MeterSnapshot {
  inLevel: LevelStats
  outLevel: LevelStats
  momentary: number
  shortTerm: number
  integrated: number
  inIntegrated: number
  lra: number
  /** 최근 3초 트루 피크 - 단기 라우드니스 */
  psr: number
  /** 최대 트루 피크 - 통합 라우드니스 */
  plr: number
  truePeak: number
  truePeakMax: number
  correlation: number
  compGr: number
  mbGr: [number, number, number]
  limGr: number
  limGrMax: number
  dyneqGr: number[]
  deessGr: number
  gateGr: number
  transientDb: number
  latency: number
  /** 체인이 아는 지금 위치(초) */
  position: number
}

class LevelMeter {
  peakL = 0; peakR = 0; msL = 0; msR = 0
  private a: number
  constructor(fs: number) { this.a = Math.exp(-1 / (0.3 * fs)) }
  process(L: Float32Array, R: Float32Array, n: number) {
    const a = this.a
    for (let i = 0; i < n; i++) {
      const l = L[i], r = R[i]
      const al = Math.abs(l), ar = Math.abs(r)
      if (al > this.peakL) this.peakL = al
      if (ar > this.peakR) this.peakR = ar
      this.msL = a * this.msL + (1 - a) * l * l
      this.msR = a * this.msR + (1 - a) * r * r
    }
  }
  take(): LevelStats {
    const s = { peakL: this.peakL, peakR: this.peakR, rmsL: Math.sqrt(this.msL), rmsR: Math.sqrt(this.msR) }
    this.peakL = this.peakR = 0
    return s
  }
}

const SUB = 128 // 오토메이션 제어 주기(샘플)
const MAX_LAT_EXTRA = 2 * FIR_LATENCY

export class MasterChain {
  readonly fs: number
  latency: number
  private gate: GateStage
  private eq: EqStage
  private mseq: MsEqStage
  private dyneq: DynEqStage
  private deess: DeesserStage
  private match: MatchStage
  private comp: CompStage
  private mb: MultibandStage
  private trans: TransientStage
  private imager: ImagerStage
  private st: StereoStage
  private sat: SaturationStage
  private clip: ClipperStage
  private lim: LimiterStage
  private dryDelay: DelayLine
  private limBypassDelay: DelayLine
  private p: ChainParams | null = null
  private edit: EditParams = defaultEdit()
  private wL: Float32Array; private wR: Float32Array
  private dL: Float32Array; private dR: Float32Array
  private inTrim = 1; private origTrim = 1
  /** 입력 기준 샘플 위치 */
  pos = 0
  private eqAutoKey = ''
  // 미터
  meterOn = true
  private inLv: LevelMeter; private outLv: LevelMeter
  loud: LoudnessMeter
  inLoud: LoudnessMeter
  private tp = new TruePeakMeter()
  private tp3 = { v: 0, t: 0 }
  private cLR = 0; private cLL = 0; private cRR = 0; private cA: number

  constructor(fs: number, maxBlock = 4096) {
    this.fs = fs
    this.gate = new GateStage(fs)
    this.eq = new EqStage(fs)
    this.mseq = new MsEqStage(fs)
    this.dyneq = new DynEqStage(fs)
    this.deess = new DeesserStage(fs)
    this.match = new MatchStage(fs)
    this.comp = new CompStage(fs)
    this.mb = new MultibandStage(fs)
    this.trans = new TransientStage(fs)
    this.imager = new ImagerStage(fs)
    this.st = new StereoStage(fs)
    this.sat = new SaturationStage(fs)
    this.clip = new ClipperStage()
    this.lim = new LimiterStage(fs)
    this.latency = this.lim.latency
    this.dryDelay = new DelayLine(this.lim.latency + MAX_LAT_EXTRA, this.lim.latency)
    this.limBypassDelay = new DelayLine(this.lim.latency)
    this.wL = new Float32Array(maxBlock); this.wR = new Float32Array(maxBlock)
    this.dL = new Float32Array(maxBlock); this.dR = new Float32Array(maxBlock)
    this.inLv = new LevelMeter(fs); this.outLv = new LevelMeter(fs)
    this.loud = new LoudnessMeter(fs); this.inLoud = new LoudnessMeter(fs)
    this.cA = Math.exp(-1 / (0.3 * fs))
  }

  setParams(p: ChainParams) {
    this.p = p
    this.inTrim = dbToLin(p.inputTrim)
    this.origTrim = dbToLin(p.originalTrim)
    this.gate.set(p.gate)
    this.eq.set(p.eq); this.eqAutoKey = ''
    this.mseq.set(p.mseq); this.dyneq.set(p.dyneq); this.deess.set(p.deesser)
    if (matchActive(p)) this.match.set(p.match)
    this.comp.set(p.comp); this.mb.set(p.multiband); this.trans.set(p.transient)
    this.imager.set(p.imager); this.st.set(p.stereo); this.sat.set(p.saturation); this.clip.set(p.clipper)
    this.lim.set({ ...p.limiter, gain: p.limiter.gain })
    this.latency = this.lim.latency + (p.eq.mode === 'linear' && !p.bypass.eq ? FIR_LATENCY : 0) + (matchActive(p) ? FIR_LATENCY : 0)
    this.dryDelay.delay = this.latency
  }

  setEdit(e: EditParams) { this.edit = e; this.eqAutoKey = '' }
  setPosition(sec: number) { this.pos = Math.max(0, Math.round(sec * this.fs)) }

  resetMeters() {
    this.loud.reset(); this.inLoud.reset(); this.tp.reset()
    this.lim.maxGr = 0; this.comp.core.maxGr = 0
  }

  /** 지금 위치의 오토메이션을 EQ·리미터에 반영 */
  private applyAutomation(tSec: number) {
    const p = this.p!, a = this.edit.automation
    const bands = ['lf', 'lmf', 'mf', 'hmf', 'hf'] as const
    let hasEq = false
    for (const b of bands) if (a[`eq.${b}`]?.length) { hasEq = true; break }
    if (hasEq && p.eq.mode !== 'linear') {
      const eq = { ...p.eq }
      for (const b of bands) {
        const pts = a[`eq.${b}`]
        if (pts?.length) (eq as Record<string, unknown>)[b] = { ...eq[b], on: true, gain: Math.round(evalAuto(pts, tSec, eq[b].gain) * 20) / 20 }
      }
      const key = bands.map(b => eq[b].gain).join('|')
      if (key !== this.eqAutoKey) { this.eqAutoKey = key; this.eq.set(eq) }
    }
    const lg = a['limiter.gain']
    if (lg?.length) this.lim.setGain(evalAuto(lg, tSec, p.limiter.gain))
  }

  /**
   * 입력(L,R)을 처리해 out 에 쓴다. 입력과 출력 배열은 같아도 된다.
   * 블록 길이는 생성자의 maxBlock 이하.
   */
  process(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, n: number) {
    const p = this.p
    if (!p) { outL.set(inL.subarray(0, n)); outR.set(inR.subarray(0, n)); return }
    const e = this.edit
    const auto = e.automation
    const hasParamAuto = !!(auto['limiter.gain']?.length || auto['eq.lf']?.length || auto['eq.lmf']?.length || auto['eq.mf']?.length || auto['eq.hmf']?.length || auto['eq.hf']?.length)
    if (hasParamAuto && n > SUB) {
      for (let off = 0; off < n; off += SUB) {
        const m = Math.min(SUB, n - off)
        this.process(inL.subarray(off, off + m), inR.subarray(off, off + m), outL.subarray(off, off + m), outR.subarray(off, off + m), m)
      }
      return
    }
    const fs = this.fs
    const t0 = this.pos / fs
    if (hasParamAuto) this.applyAutomation(t0)

    const wL = this.wL, wR = this.wR, dL = this.dL, dR = this.dR
    const baseGain = this.inTrim * dbToLin(e.gainOffset)
    const vol = auto.volume
    for (let i = 0; i < n; i++) {
      const g = vol?.length ? baseGain * dbToLin(evalAuto(vol, t0 + i / fs, 0)) : baseGain
      wL[i] = inL[i] * g; wR[i] = inR[i] * g
      dL[i] = inL[i]; dR[i] = inR[i]
    }
    if (this.meterOn) { this.inLv.process(inL, inR, n); this.inLoud.process(inL, inR, n) }

    let limiterRan = false
    for (const id of p.order) {
      if (p.bypass[id]) continue
      switch (id) {
        case 'gate': this.gate.process(wL, wR, n); break
        case 'eq': this.eq.process(wL, wR, n); break
        case 'mseq': this.mseq.process(wL, wR, n); break
        case 'dyneq': this.dyneq.process(wL, wR, n); break
        case 'deesser': this.deess.process(wL, wR, n); break
        case 'match': if (matchActive(p)) this.match.process(wL, wR, n); break
        case 'comp': this.comp.process(wL, wR, n); break
        case 'multiband': this.mb.process(wL, wR, n); break
        case 'transient': this.trans.process(wL, wR, n); break
        case 'imager': this.imager.process(wL, wR, n); break
        case 'stereo': this.st.process(wL, wR, n); break
        case 'saturation': this.sat.process(wL, wR, n); break
        case 'clipper': this.clip.process(wL, wR, n); break
        case 'limiter': this.lim.process(wL, wR, n); limiterRan = true; break
      }
    }
    // 리미터를 끈 경우에도 지연을 같게 유지해 켜고 끌 때 박자가 밀리지 않게 한다
    if (!limiterRan) { this.limBypassDelay.process(wL, wR, n); this.lim.gr = 0 }

    // 원본(지연 맞춤)
    this.dryDelay.process(dL, dR, n)

    // 시간축 편집: 출력 위치 = 입력 위치 - 지연
    const lat = this.latency
    const startS = e.start, endS = e.end > 0 ? e.end : Infinity
    const fi = e.fadeIn.dur, fo = e.fadeOut.dur
    const region = e.region
    const hasTimeEdit = startS > 0 || endS < Infinity || fi > 0 || fo > 0 || !!region
    if (hasTimeEdit) {
      const ramp = 0.02
      for (let i = 0; i < n; i++) {
        const t = (this.pos + i - lat) / fs
        let g = 1
        if (t < startS || t > endS) g = 0
        else {
          if (fi > 0 && t < startS + fi) g *= fadeShape((t - startS) / fi, e.fadeIn.curve)
          if (fo > 0 && endS < Infinity && t > endS - fo) g *= fadeShape((endS - t) / fo, e.fadeOut.curve)
        }
        let l = wL[i], r = wR[i]
        if (region) {
          // 구간 안은 처리본, 밖은 원본 — 20ms 로 이어 붙인다
          const inside = Math.min(1, Math.max(0, Math.min(t - region.start, region.end - t) / ramp + 0.5))
          l = l * inside + dL[i] * (1 - inside)
          r = r * inside + dR[i] * (1 - inside)
        }
        wL[i] = l * g; wR[i] = r * g
        dL[i] *= g; dR[i] *= g
      }
    }

    if (this.meterOn) {
      this.loud.process(wL, wR, n)
      this.tp.process(wL, wR, n)
      const a = this.cA
      for (let i = 0; i < n; i++) {
        const l = wL[i], r = wR[i]
        this.cLR = a * this.cLR + (1 - a) * l * r
        this.cLL = a * this.cLL + (1 - a) * l * l
        this.cRR = a * this.cRR + (1 - a) * r * r
      }
    }

    if (p.listenOriginal) {
      const g = this.origTrim
      for (let i = 0; i < n; i++) { outL[i] = dL[i] * g; outR[i] = dR[i] * g }
    } else {
      for (let i = 0; i < n; i++) { outL[i] = wL[i]; outR[i] = wR[i] }
    }
    if (this.meterOn) this.outLv.process(outL, outR, n)
    this.pos += n
  }

  snapshot(): MeterSnapshot {
    const denom = Math.sqrt(this.cLL * this.cRR)
    const tpRecent = this.tp.recent
    this.tp.recent = 0
    // 최근 3초 트루 피크 (PSR 용)
    const now = this.pos / this.fs
    if (tpRecent >= this.tp3.v || now - this.tp3.t > 3) this.tp3 = { v: tpRecent, t: now }
    const integ = this.loud.integrated()
    const p = this.p
    return {
      inLevel: this.inLv.take(),
      outLevel: this.outLv.take(),
      momentary: this.loud.momentary,
      shortTerm: this.loud.shortTerm,
      integrated: integ,
      inIntegrated: this.inLoud.integrated(),
      lra: this.loud.lra(),
      psr: linToDb(this.tp3.v) - this.loud.shortTerm,
      plr: linToDb(this.tp.max) - integ,
      truePeak: linToDb(tpRecent),
      truePeakMax: linToDb(this.tp.max),
      correlation: denom > 1e-10 ? this.cLR / denom : 1,
      compGr: p?.bypass.comp ? 0 : this.comp.core.env,
      mbGr: p?.bypass.multiband ? [0, 0, 0] : [this.mb.cores[0].env, this.mb.cores[1].env, this.mb.cores[2].env],
      limGr: this.lim.gr,
      limGrMax: this.lim.maxGr,
      dyneqGr: p?.bypass.dyneq ? [] : this.dyneq.bands.map(b => b.dyn),
      deessGr: p?.bypass.deesser ? 0 : this.deess.band.dyn,
      gateGr: p?.bypass.gate ? 0 : this.gate.gr,
      transientDb: p?.bypass.transient ? 0 : this.trans.gainDb,
      latency: this.latency,
      position: this.pos / this.fs,
    }
  }
}
