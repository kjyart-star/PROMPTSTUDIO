/**
 * AI 곡 고음 정리 — 판단·측정 도우미.
 *  - isAiSong: 곡 보관함에서 온 곡(우리 서비스가 만든 AI 곡)이면 자동으로 켠다.
 *  - harshMetrics: 3~12kHz 의 「튀는 정도」를 숫자로 잰다(처리 전후 비교·발매 점검의 음색 항목).
 * 처리 자체는 dsp.ts 의 AiCleanStage(체인 맨 앞 'aiclean' 칸).
 */
import { FFT } from './fft'
import type { ChainParams } from './dsp'

export type AiCleanMode = 'natural' | 'strong'

/** 곡 보관함 곡이면 AI 로 만든 곡이다(직접 올린 파일은 사용자가 고른다) */
export function isAiSong(src: { source?: string; song?: unknown } | null | undefined): boolean {
  return !!src && (src.source === 'library' || (!!src.song && src.source !== 'file'))
}

/** 체인 맨 앞의 고음 정리를 켜거나 끈다(다른 값은 그대로) */
export function withAiClean(p: ChainParams, mode: AiCleanMode | null): ChainParams {
  const order = p.order.includes('aiclean') ? p.order : (['aiclean', ...p.order] as ChainParams['order'])
  return { ...p, order, aiclean: { mode: mode ?? p.aiclean?.mode ?? 'natural' }, bypass: { ...p.bypass, aiclean: !mode } }
}

export interface HarshMetrics {
  /** 3~12kHz 평균 에너지(dB, 파워 평균) — 처리 전후 차이가 「고역 평균 손실」 */
  hfMeanDb: number
  /** 3~12kHz 프레임 에너지 상위 1%(dB) — 「고역 피크 에너지」 */
  hfPeakDb: number
  /** 3~12kHz 스펙트럼 평탄도 평균(0~1, 클수록 고르고 뾰족한 공진이 적다) */
  flatness: number
  /** 한 대역만 홀로 튀는 정도(dB, 상위 5%) — 프레임 사이 변화량 기준 */
  spikeDb: number
  /** 한 대역이 양옆 대역보다 평소보다 도드라진 정도(dB, 상위 1%) — 「쇳소리 지표」(고역 돌출 피크) */
  bulgeDb: number
  /** 분석한 프레임 수 */
  frames: number
}

const EDGES = [3000, 3800, 5000, 6500, 9000, 12000]
/** 측정용 고정 대역(반 옥타브) 중심 + 양 끝 이웃 — 처리 단계의 대역과 따로 둔다(처리에 맞춘 측정이 되지 않게) */
const SHAPE_C = [2350, 3200, 4350, 5930, 8070, 11000, 15000]

/**
 * 모노 합의 STFT(2048, 절반 겹침)로 3~12kHz 를 잰다. 무음 프레임(고역 -90dB 아래)은 뺀다.
 * 프레임이 maxFrames 를 넘으면 8프레임 묶음 단위로 고르게 건너뛴다(긴 곡도 가볍게).
 */
export function harshMetrics(ch: Float32Array[], fs: number, maxFrames = 6000): HarshMetrics {
  const L = ch[0], R = ch[1] ?? ch[0]
  const N = 2048, hop = 1024
  const n = L.length
  const total = Math.max(0, Math.floor((n - N) / hop) + 1)
  const stride = Math.max(1, Math.ceil(total / maxFrames))
  const fft = new FFT(N)
  const win = new Float64Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
  const re = new Float64Array(N), im = new Float64Array(N)
  const k0 = Math.max(1, Math.round((3000 * N) / fs)), k1 = Math.min(N / 2 - 1, Math.round((12000 * N) / fs))
  const bandK = EDGES.map(f => Math.min(N / 2 - 1, Math.round((f * N) / fs)))
  const nb = EDGES.length - 1
  const sEdges = SHAPE_C.map((c, i) => [i ? Math.sqrt(c * SHAPE_C[i - 1]) : c / 1.17, i < SHAPE_C.length - 1 ? Math.sqrt(c * SHAPE_C[i + 1]) : c * 1.17])
    .map(([a, b]) => [Math.max(1, Math.round((a * N) / fs)), Math.min(N / 2 - 1, Math.round((b * N) / fs))])
  const shapes: number[][] = SHAPE_C.slice(1, -1).map(() => [])
  const energies: number[] = []
  const spikes: number[] = []
  let flatSum = 0, flatN = 0, powSum = 0
  let prev: Float64Array | null = null
  const cur = new Float64Array(nb)
  const silence = 1e-9 * N * N
  for (let f = 0; f < total; f++) {
    // 긴 곡은 연속 8프레임 묶음 단위로 건너뛴다(묶음 안은 이어져 있어 변화량을 잴 수 있다)
    if (stride > 1 && Math.floor(f / 8) % stride !== 0) { prev = null; continue }
    const s = f * hop
    for (let i = 0; i < N; i++) { re[i] = (L[s + i] + R[s + i]) * 0.5 * win[i]; im[i] = 0 }
    fft.transform(re, im)
    let e = 0, logSum = 0, cnt = 0
    for (let k = k0; k <= k1; k++) {
      const p = re[k] * re[k] + im[k] * im[k]
      e += p; logSum += Math.log(p + 1e-30); cnt++
    }
    for (let b = 0; b < nb; b++) {
      let be = 0
      for (let k = bandK[b]; k < bandK[b + 1]; k++) be += re[k] * re[k] + im[k] * im[k]
      cur[b] = be
    }
    if (e < silence) { prev = null; continue }
    energies.push(e); powSum += e
    const lv = sEdges.map(([a, b]) => { let x = 0; for (let k = a; k <= b; k++) x += re[k] * re[k] + im[k] * im[k]; return 10 * Math.log10(x / (b - a + 1) + 1e-30) })
    for (let k = 1; k < lv.length - 1; k++) shapes[k - 1].push(lv[k] - 0.5 * (lv[k - 1] + lv[k + 1]))
    flatSum += Math.exp(logSum / cnt) / (e / cnt); flatN++
    // 대역별 양(+)의 변화량(dB) — 한 대역만 홀로 오른 만큼(다른 대역 평균을 뺀 값)
    if (prev) {
      const d = new Array<number>(nb)
      let sum = 0
      for (let b = 0; b < nb; b++) { d[b] = Math.max(0, 10 * Math.log10((cur[b] + 1e-20) / (prev[b] + 1e-20))); sum += d[b] }
      let mx = 0
      for (let b = 0; b < nb; b++) { const iso = d[b] - (sum - d[b]) / (nb - 1); if (iso > mx) mx = iso }
      spikes.push(mx)
    }
    prev = Float64Array.from(cur)
  }
  if (!energies.length) return { hfMeanDb: -Infinity, hfPeakDb: -Infinity, flatness: 0, spikeDb: 0, bulgeDb: 0, frames: 0 }
  const norm = N * N / 4
  const sorted = [...energies].sort((a, b) => a - b)
  const pct = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(q * (arr.length - 1))))]
  const sp = [...spikes].sort((a, b) => a - b)
  // 돌출: 프레임마다 (대역 모양 - 그 대역의 곡 전체 중앙값) 의 최댓값 → 상위 1%
  const med = shapes.map(v => { const x = [...v].sort((a, b) => a - b); return x[Math.floor(x.length / 2)] })
  const bulge = energies.map((_, t) => Math.max(0, ...shapes.map((v, k) => v[t] - med[k]))).sort((a, b) => a - b)
  return {
    hfMeanDb: 10 * Math.log10(powSum / energies.length / norm),
    hfPeakDb: 10 * Math.log10(pct(sorted, 0.99) / norm),
    flatness: flatSum / Math.max(1, flatN),
    spikeDb: sp.length ? pct(sp, 0.95) : 0,
    bulgeDb: pct(bulge, 0.99),
    frames: energies.length,
  }
}
