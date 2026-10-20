/**
 * 곡 전체 분석 — 라우드니스(통합·LRA·최대 M/S), 트루 피크, PLR/PSR, 크레스트 팩터,
 * LUFS 시간 그래프, 클리핑 위치, 1/3 옥타브 평균 스펙트럼, 스펙트로그램, 상관·저역 사이드·치찰음.
 */
import { LoudnessMeter, TruePeakMeter, MATCH_FREQS, linToDb, loudnessRange } from './dsp'
import { FFT } from './fft'

export interface ClipEvent { t: number; count: number }

export interface Analysis {
  duration: number
  sampleRate: number
  integrated: number
  lra: number
  maxMomentary: number
  maxShortTerm: number
  truePeak: number
  samplePeak: number
  rmsDb: number
  crest: number
  plr: number
  psrAvg: number
  psrMin: number
  /** 100ms 간격 단기 라우드니스 (처음 3초는 짧은 창) */
  shortSeries: Float32Array
  momentarySeries: Float32Array
  clips: ClipEvent[]
  clipSamples: number
  /** MATCH_FREQS 위치의 평균 스펙트럼 dB */
  bands: number[]
  spectrogram: { cols: number; rows: number; data: Uint8Array; fMin: number; fMax: number }
  correlation: number
  /** 150Hz 아래 사이드 에너지 / 미드 에너지 (dB) */
  sideLowDb: number
  /** 5~9kHz 에너지 - 1~4kHz 에너지 (dB) */
  sibilanceDb: number
}

const tick = () => new Promise<void>(r => setTimeout(r, 0))

export async function analyzeAudio(ch: Float32Array[], fs: number, opts: { spectrogramCols?: number; onProgress?: (p: number) => void } = {}): Promise<Analysis> {
  const L = ch[0], R = ch[1] ?? ch[0]
  const n = L.length
  const meter = new LoudnessMeter(fs)
  const tp = new TruePeakMeter()
  const hop = Math.round(fs / 10)
  const tpBlocks: number[] = []
  let peak = 0, sumSq = 0, sLR = 0, sLL = 0, sRR = 0
  const clips: ClipEvent[] = []
  let clipSamples = 0
  let lastClipT = -1
  const CLIP = 0.99995
  for (let pos = 0; pos < n; pos += hop) {
    const m = Math.min(hop, n - pos)
    const l = L.subarray(pos, pos + m), r = R.subarray(pos, pos + m)
    meter.process(l, r, m)
    tp.recent = 0
    tp.process(l, r, m)
    tpBlocks.push(tp.recent)
    for (let i = 0; i < m; i++) {
      const a = l[i], b = r[i]
      const aa = Math.abs(a), bb = Math.abs(b)
      if (aa > peak) peak = aa
      if (bb > peak) peak = bb
      sumSq += a * a + b * b
      sLR += a * b; sLL += a * a; sRR += b * b
      if (aa >= CLIP || bb >= CLIP) {
        clipSamples++
        const t = (pos + i) / fs
        if (clips.length && t - lastClipT < 0.05) clips[clips.length - 1].count++
        else if (clips.length < 500) clips.push({ t, count: 1 })
        lastClipT = t
      }
    }
    if ((pos / hop) % 200 === 0) { opts.onProgress?.((pos / n) * 0.6); await tick() }
  }
  const rms = Math.sqrt(sumSq / Math.max(1, 2 * n))
  const integrated = meter.integrated()
  const tpDb = linToDb(tp.max)
  // PSR: 100ms 마다 최근 3초 트루 피크 - 단기 라우드니스
  const st = meter.shortSeries
  const psr: number[] = []
  for (let k = 0; k < st.length; k++) {
    const blockIdx = k + 29 // shortSeries 는 30번째 100ms 블록부터
    let mx = 0
    for (let j = Math.max(0, blockIdx - 29); j <= Math.min(tpBlocks.length - 1, blockIdx); j++) if (tpBlocks[j] > mx) mx = tpBlocks[j]
    if (st[k] > -70) psr.push(linToDb(mx) - st[k])
  }

  // 스펙트럼 (미드), 저역 사이드, 치찰음
  const N = 4096
  const fft = new FFT(N)
  const win = new Float64Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const frames = Math.max(1, Math.min(400, Math.floor(n / N)))
  const step = Math.max(N, Math.floor((n - N) / frames))
  const pow = new Float64Array(N / 2)
  let sidePowLow = 0, midPowLow = 0
  const re = new Float64Array(N), im = new Float64Array(N), sre = new Float64Array(N), sim = new Float64Array(N)
  let used = 0
  for (let s = 0; s + N <= n; s += step) {
    for (let i = 0; i < N; i++) {
      const a = L[s + i], b = R[s + i]
      re[i] = (a + b) * 0.5 * win[i]; im[i] = 0
      sre[i] = (a - b) * 0.5 * win[i]; sim[i] = 0
    }
    fft.transform(re, im); fft.transform(sre, sim)
    for (let k = 1; k < N / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      pow[k] += p
      const f = (k * fs) / N
      if (f < 150) { midPowLow += p; sidePowLow += sre[k] * sre[k] + sim[k] * sim[k] }
    }
    used++
    if (used % 40 === 0) { opts.onProgress?.(0.6 + (s / n) * 0.25); await tick() }
  }
  const bandPow = (f0: number, f1: number) => {
    let e = 0
    for (let k = Math.max(1, Math.floor((f0 * N) / fs)); k <= Math.min(N / 2 - 1, Math.ceil((f1 * N) / fs)); k++) e += pow[k]
    return e
  }
  const bands = MATCH_FREQS.map(f => {
    const e = bandPow(f / Math.pow(2, 1 / 6), f * Math.pow(2, 1 / 6))
    return 10 * Math.log10(e / Math.max(1, used) + 1e-20)
  })
  const sibilanceDb = 10 * Math.log10((bandPow(5000, 9000) + 1e-20) / (bandPow(1000, 4000) + 1e-20))
  const sideLowDb = 10 * Math.log10((sidePowLow + 1e-20) / (midPowLow + 1e-20))

  // 스펙트로그램
  const cols = opts.spectrogramCols ?? 600
  const rows = 96
  const SN = 1024
  const sfft = new FFT(SN)
  const swin = new Float64Array(SN)
  for (let i = 0; i < SN; i++) swin[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SN - 1))
  const data = new Uint8Array(cols * rows)
  const fMin = 30, fMax = Math.min(20000, fs / 2)
  const rowBins: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    const f0 = fMin * Math.pow(fMax / fMin, r / rows), f1 = fMin * Math.pow(fMax / fMin, (r + 1) / rows)
    const b0 = Math.max(1, Math.floor((f0 * SN) / fs)), b1 = Math.max(b0, Math.min(SN / 2 - 1, Math.floor((f1 * SN) / fs)))
    rowBins.push([b0, b1])
  }
  const sre2 = new Float64Array(SN), sim2 = new Float64Array(SN)
  for (let c = 0; c < cols; c++) {
    const s = Math.floor((c / cols) * Math.max(0, n - SN))
    for (let i = 0; i < SN; i++) { sre2[i] = ((L[s + i] ?? 0) + (R[s + i] ?? 0)) * 0.5 * swin[i]; sim2[i] = 0 }
    sfft.transform(sre2, sim2)
    for (let r = 0; r < rows; r++) {
      const [b0, b1] = rowBins[r]
      let mx = 0
      for (let b = b0; b <= b1; b++) { const p = sre2[b] * sre2[b] + sim2[b] * sim2[b]; if (p > mx) mx = p }
      const db = 10 * Math.log10(mx / (SN * SN / 16) + 1e-20)
      data[c * rows + r] = Math.max(0, Math.min(255, Math.round(((db + 100) / 100) * 255)))
    }
    if (c % 60 === 0) { opts.onProgress?.(0.85 + (c / cols) * 0.15); await tick() }
  }
  opts.onProgress?.(1)

  const rmsDb = linToDb(rms)
  const samplePeak = linToDb(peak)
  return {
    duration: n / fs,
    sampleRate: fs,
    integrated,
    lra: loudnessRange(meter.shortSeries),
    maxMomentary: meter.maxMomentary,
    maxShortTerm: meter.maxShortTerm,
    truePeak: tpDb,
    samplePeak,
    rmsDb,
    crest: samplePeak - rmsDb,
    plr: tpDb - integrated,
    psrAvg: psr.length ? psr.reduce((a, b) => a + b, 0) / psr.length : 0,
    psrMin: psr.length ? Math.min(...psr) : 0,
    shortSeries: Float32Array.from(meter.shortSeries),
    momentarySeries: Float32Array.from(meter.momentarySeries),
    clips,
    clipSamples,
    bands,
    spectrogram: { cols, rows, data, fMin, fMax },
    correlation: Math.sqrt(sLL * sRR) > 1e-12 ? sLR / Math.sqrt(sLL * sRR) : 1,
    sideLowDb,
    sibilanceDb,
  }
}

/** 곡에서 가장 큰(후렴 근처) 구간의 시작 초 — 미리듣기용 */
export function loudestWindow(a: Analysis, seconds = 8): number {
  const s = a.shortSeries
  if (!s.length) return 0
  let best = 0, bi = 0
  for (let i = 0; i < s.length; i++) if (s[i] > best || i === 0) { best = s[i]; bi = i }
  // shortSeries[i] 는 (i+30)*0.1 초에서 끝나는 3초 창
  const end = (bi + 30) * 0.1
  return Math.max(0, Math.min(a.duration - seconds, end - seconds / 2 - 1.5))
}

/** 스펙트럼을 평균 0 으로 (60Hz~12kHz 기준) */
export function normalizeBands(b: number[]): number[] {
  const idx = b.map((_, i) => i).filter(i => MATCH_FREQS[i] >= 60 && MATCH_FREQS[i] <= 12000)
  const mean = idx.reduce((s, i) => s + b[i], 0) / idx.length
  return b.map(v => v - mean)
}

/** 레퍼런스 톤 맞추기 — 원곡을 레퍼런스 스펙트럼 모양으로 옮기는 곡선(dB) */
export function matchingCurve(src: number[], ref: number[], maxDb = 9): number[] {
  const a = normalizeBands(src), b = normalizeBands(ref)
  let d = b.map((v, i) => v - a[i])
  // 1/3 옥타브 3칸 평균을 두 번 → 좁은 봉우리를 따라가지 않게
  for (let k = 0; k < 2; k++) d = d.map((_, i) => (d[Math.max(0, i - 1)] + d[i] + d[Math.min(d.length - 1, i + 1)]) / 3)
  // 25Hz 아래·18kHz 위는 끝값 유지 정도로 약하게
  return d.map((v, i) => {
    const f = MATCH_FREQS[i]
    const w = f < 30 || f > 16000 ? 0.5 : 1
    return Math.round(Math.max(-maxDb, Math.min(maxDb, v * w)) * 10) / 10
  })
}

/** 앞뒤 무음 찾기 — 임계값(dBFS)을 처음/마지막으로 넘는 지점, 앞은 10ms·뒤는 50ms 여유 */
export function detectSilence(ch: Float32Array[], fs: number, thresholdDb = -60): { start: number; end: number } {
  const thr = Math.pow(10, thresholdDb / 20)
  const L = ch[0], R = ch[1] ?? ch[0], n = L.length
  let a = 0, b = n - 1
  while (a < n && Math.abs(L[a]) < thr && Math.abs(R[a]) < thr) a++
  while (b > a && Math.abs(L[b]) < thr && Math.abs(R[b]) < thr) b--
  if (a >= n) return { start: 0, end: n / fs }
  return { start: Math.max(0, (a - fs * 0.01) / fs), end: Math.min(n, b + fs * 0.05) / fs }
}
