import { MATCH_FREQS, type ChainParams, type EqParams, type SlotId } from './dsp'

export const SLOT_LABEL: Record<SlotId, string> = {
  gate: '게이트',
  eq: '7밴드 EQ',
  mseq: 'M/S EQ',
  dyneq: '다이내믹 EQ',
  deesser: '디에서',
  match: '매칭 EQ',
  comp: '컴프레서',
  multiband: '멀티밴드',
  transient: '트랜지언트',
  imager: '대역별 폭',
  stereo: '스테레오',
  saturation: '새추레이션',
  clipper: '소프트 클리퍼',
  limiter: '리미터',
}

export const DEFAULT_EQ: EqParams = {
  mode: 'min',
  input: 0,
  output: 0,
  deharsh: 0,
  hpf: { on: true, freq: 25, slope: 24 },
  lf: { on: true, freq: 80, gain: 0, q: 0.7, shape: 'shelf' },
  lmf: { on: true, freq: 250, gain: 0, q: 1 },
  mf: { on: true, freq: 1000, gain: 0, q: 1 },
  hmf: { on: true, freq: 3500, gain: 0, q: 1 },
  hf: { on: true, freq: 10000, gain: 0, q: 0.7, shape: 'shelf' },
  lpf: { on: false, freq: 20000, slope: 12 },
}

export function defaultChain(): ChainParams {
  const msFlat = () => ({
    low: { freq: 120, gain: 0 }, b1: { freq: 400, gain: 0, q: 1 }, b2: { freq: 3000, gain: 0, q: 1 }, high: { freq: 10000, gain: 0 },
  })
  return {
    order: ['gate', 'eq', 'mseq', 'dyneq', 'deesser', 'match', 'comp', 'multiband', 'transient', 'imager', 'stereo', 'saturation', 'clipper', 'limiter'],
    bypass: {
      gate: true, eq: false, mseq: true, dyneq: true, deesser: true, match: true, comp: false, multiband: true,
      transient: true, imager: true, stereo: false, saturation: true, clipper: true, limiter: false,
    },
    listenOriginal: false,
    originalTrim: 0,
    inputTrim: 0,
    gate: { threshold: -60, ratio: 2, range: 20, attack: 1, hold: 50, release: 200 },
    eq: structuredClone(DEFAULT_EQ),
    mseq: { mid: msFlat(), side: msFlat() },
    dyneq: {
      bands: [
        { on: true, freq: 200, q: 1.2, gain: 0, threshold: -24, ratio: 3, range: 4, attack: 10, release: 120, mode: 'cut' },
        { on: true, freq: 2800, q: 1.5, gain: 0, threshold: -26, ratio: 3, range: 4, attack: 3, release: 80, mode: 'cut' },
        { on: false, freq: 60, q: 1, gain: 0, threshold: -20, ratio: 2, range: 3, attack: 20, release: 200, mode: 'cut' },
        { on: false, freq: 9000, q: 1, gain: 0, threshold: -30, ratio: 2, range: 3, attack: 5, release: 100, mode: 'boost' },
      ],
    },
    deesser: { freq: 6500, threshold: -28, range: 6, listen: false },
    match: { curve: MATCH_FREQS.map(() => 0), strength: 70 },
    comp: { threshold: -18, ratio: 2, attack: 20, release: 200, knee: 6, makeup: 0, mix: 100, autoMakeup: false },
    multiband: {
      lowX: 120,
      highX: 4000,
      bands: [
        { threshold: -20, ratio: 2, attack: 30, release: 250, gain: 0, on: true, solo: false },
        { threshold: -18, ratio: 1.8, attack: 15, release: 180, gain: 0, on: true, solo: false },
        { threshold: -22, ratio: 2, attack: 5, release: 120, gain: 0, on: true, solo: false },
      ],
    },
    transient: { attack: 0, sustain: 0, output: 0 },
    imager: { lowX: 150, highX: 4000, widths: [100, 100, 100] },
    stereo: { width: 100, mid: 0, side: 0, bassMono: 0 },
    saturation: { drive: 3, mode: 'tape', mix: 50, output: 0 },
    clipper: { threshold: -0.5, softness: 40, output: 0 },
    limiter: { gain: 4, ceiling: -1, release: 80, truePeak: true },
  }
}

export interface LoudnessTarget { id: string; label: string; lufs: number; ceiling: number }

/** 타깃 라우드니스 — 화면에는 용도로만 부른다 */
export const LOUDNESS_TARGETS: LoudnessTarget[] = [
  { id: 'stream', label: '스트리밍', lufs: -14, ceiling: -1 },
  { id: 'video', label: '동영상 플랫폼', lufs: -14, ceiling: -1 },
  { id: 'hifi', label: '고음질 스트리밍', lufs: -16, ceiling: -1 },
  { id: 'podcast', label: '팟캐스트', lufs: -16, ceiling: -1 },
  { id: 'broadcast', label: '방송', lufs: -23, ceiling: -1 },
  { id: 'cd', label: 'CD · 음반', lufs: -9, ceiling: -1 },
  { id: 'club', label: '클럽 · DJ', lufs: -8, ceiling: -0.3 },
]

/** EQ 톤 프리셋 (예전 마스터링 화면의 성향 프리셋을 7밴드 EQ 로 옮김) */
export const EQ_TONE_PRESETS: { id: string; label: string; gains: [number, number, number, number, number] }[] = [
  { id: 'flat', label: '평탄', gains: [0, 0, 0, 0, 0] },
  { id: 'clean', label: '선명', gains: [0, -2.5, -1, 1.5, 2.5] },
  { id: 'punchy', label: '타격감', gains: [3, 2, 0, 1.5, 0.5] },
  { id: 'warm', label: '따뜻함', gains: [2, 1.5, 0, -1, -2.5] },
  { id: 'airy', label: '공간감', gains: [-1, 0, 1, 2.5, 4.5] },
  { id: 'vshape', label: 'V자', gains: [3.5, -2, -1.5, 1.5, 3.5] },
]

