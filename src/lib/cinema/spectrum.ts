/**
 * 음원을 분석해 그림 — 재생 위치(초)마다 64개 막대(0..1)를 만든다.
 * 미리보기와 영상 내보내기가 같은 함수를 쓴다(결과물이 미리보기와 같아야 하므로).
 * 상태(부드럽게 내려오는 효과)가 있어 시간 순서대로 호출해야 한다.
 */
import { binSpectrum } from '@/lib/audio/spectrumTap'

export const BAR_COUNT = 64
// 지금 재생 화면(AnalyserNode: fftSize 512, 평활 0.78, -100~-30dB)과 같은 값 체계로 계산한다.
// 브라우저의 AnalyserNode 를 오프라인에서 그대로 흉내 낸 것이라 미리보기와 영상 출력이 똑같이 나온다.
const N = 512
const SMOOTH = 0.78
const MIN_DB = -100, MAX_DB = -30

function makeFFT(n: number) {
  const levels = Math.log2(n)
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = Math.sin(2 * Math.PI * i / n) }
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b); rev[i] = r }
  return (re: Float32Array, im: Float32Array) => {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half
          const tre = re[l] * cos[k] + im[l] * sin[k]
          const tim = -re[l] * sin[k] + im[l] * cos[k]
          re[l] = re[j] - tre; im[l] = im[j] - tim
          re[j] += tre; im[j] += tim
        }
      }
    }
  }
}

export interface SpectrumAnalyzer {
  /** t 초 위치의 막대·음량 */
  at(t: number): { bars: Float32Array; level: number }
  reset(): void
}

export function createSpectrumAnalyzer(channels: Float32Array[], fs: number, gain = 1): SpectrumAnalyzer {
  const fft = makeFFT(N)
  const win = new Float32Array(N)
  const alpha = 0.16
  for (let i = 0; i < N; i++) win[i] = 0.5 * (1 - alpha) - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.5 * alpha * Math.cos(4 * Math.PI * i / N)
  const re = new Float32Array(N), im = new Float32Array(N)
  const mag = new Float32Array(N / 2) // 시간 평활된 선형 크기
  const bytes = new Uint8Array(N / 2)
  const out = new Float32Array(BAR_COUNT)
  const tmp = new Array<number>(BAR_COUNT).fill(0)
  let lvl = 0
  let lastT = -1
  return {
    reset() { mag.fill(0); out.fill(0); lvl = 0; lastT = -1 },
    at(t: number) {
      const end = Math.floor(t * fs) + 1
      const start = end - N
      const len = channels[0].length
      let rms = 0
      for (let i = 0; i < N; i++) {
        const idx = start + i
        let v = 0
        if (idx >= 0 && idx < len) { for (const ch of channels) v += ch[idx]; v = (v / channels.length) * gain }
        re[i] = v * win[i]; im[i] = 0; rms += v * v
      }
      fft(re, im)
      const dt = lastT < 0 ? 1 / 30 : Math.min(0.25, Math.max(0, t - lastT))
      lastT = t
      const k = Math.pow(SMOOTH, dt * 60) // 60Hz 갱신 기준 평활을 시간 비례로
      for (let i = 0; i < N / 2; i++) {
        const m = Math.hypot(re[i], im[i]) / N
        mag[i] = k * mag[i] + (1 - k) * m
        const db = 20 * Math.log10(mag[i] + 1e-12)
        bytes[i] = Math.max(0, Math.min(255, Math.round(((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255)))
      }
      binSpectrum(bytes, BAR_COUNT, tmp)
      for (let i = 0; i < BAR_COUNT; i++) out[i] = tmp[i]
      const rl = Math.min(1, Math.sqrt(rms / N) * 3.2)
      lvl = rl > lvl ? rl : lvl * k + rl * (1 - k)
      return { bars: out, level: lvl }
    },
  }
}

/** 곡 앞뒤 무음을 제외한 소리 구간 추정용 100ms 단위 에너지 (자동 가사 보정이 쓴다) */
export function energyEnvelope(channels: Float32Array[], fs: number, stepSec = 0.1): Float32Array {
  const step = Math.round(fs * stepSec)
  const n = Math.floor(channels[0].length / step)
  const out = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    let e = 0
    for (let i = k * step; i < (k + 1) * step; i++) { let v = 0; for (const ch of channels) v += ch[i]; v /= channels.length; e += v * v }
    out[k] = Math.sqrt(e / step)
  }
  return out
}
