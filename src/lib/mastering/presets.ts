import type { ChainParams, EqParams, SlotId } from './dsp'

export const SLOT_LABEL: Record<SlotId, string> = {
  eq: '7밴드 EQ',
  comp: '컴프레서',
  multiband: '멀티밴드',
  stereo: '스테레오',
  saturation: '새추레이션',
  limiter: '리미터',
}

export const DEFAULT_EQ: EqParams = {
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
  return {
    order: ['eq', 'comp', 'multiband', 'stereo', 'saturation', 'limiter'],
    bypass: { eq: false, comp: false, multiband: true, stereo: false, saturation: true, limiter: false },
    listenOriginal: false,
    originalTrim: 0,
    inputTrim: 0,
    eq: structuredClone(DEFAULT_EQ),
    comp: { threshold: -18, ratio: 2, attack: 20, release: 200, knee: 6, makeup: 0, mix: 100 },
    multiband: {
      lowX: 120,
      highX: 4000,
      bands: [
        { threshold: -20, ratio: 2, attack: 30, release: 250, gain: 0, on: true, solo: false },
        { threshold: -18, ratio: 1.8, attack: 15, release: 180, gain: 0, on: true, solo: false },
        { threshold: -22, ratio: 2, attack: 5, release: 120, gain: 0, on: true, solo: false },
      ],
    },
    stereo: { width: 100, mid: 0, side: 0, bassMono: 0 },
    saturation: { drive: 3, mode: 'tape', mix: 50, output: 0 },
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
  { id: 'cd', label: 'CD · 클럽', lufs: -9, ceiling: -0.3 },
]

type Patch = (c: ChainParams) => void

export interface ChainPreset { id: string; label: string; apply: Patch }

const eqGains = (c: ChainParams, g: [number, number, number, number, number]) => {
  c.eq.lf.gain = g[0]; c.eq.lmf.gain = g[1]; c.eq.mf.gain = g[2]; c.eq.hmf.gain = g[3]; c.eq.hf.gain = g[4]
}

/** 장르 체인 프리셋 */
export const GENRE_PRESETS: ChainPreset[] = [
  { id: 'default', label: '기본', apply: () => {} },
  {
    id: 'pop', label: '팝', apply: c => {
      eqGains(c, [1, -1, 0, 1, 2])
      c.comp = { ...c.comp, threshold: -20, ratio: 2.5, attack: 15, release: 150 }
      c.bypass.multiband = false
      c.stereo.width = 110
      c.limiter.gain = 6
    },
  },
  {
    id: 'hiphop', label: '힙합', apply: c => {
      eqGains(c, [3, -1.5, 0, 1, 1])
      c.eq.lf.freq = 70
      c.comp = { ...c.comp, threshold: -16, ratio: 3, attack: 30, release: 120 }
      c.stereo.bassMono = 120
      c.bypass.saturation = false
      c.saturation = { ...c.saturation, drive: 4, mode: 'tube', mix: 35 }
      c.limiter.gain = 7
    },
  },
  {
    id: 'rock', label: '록', apply: c => {
      eqGains(c, [1.5, -1, 0.5, 1.5, 1])
      c.comp = { ...c.comp, threshold: -18, ratio: 3, attack: 10, release: 100 }
      c.bypass.saturation = false
      c.saturation = { ...c.saturation, drive: 5, mode: 'tape', mix: 40 }
      c.limiter.gain = 6
    },
  },
  {
    id: 'ballad', label: '발라드 · 어쿠스틱', apply: c => {
      eqGains(c, [0.5, -0.5, 0, 0.5, 1.5])
      c.comp = { ...c.comp, threshold: -22, ratio: 1.6, attack: 40, release: 300 }
      c.limiter.gain = 3
    },
  },
  {
    id: 'edm', label: 'EDM', apply: c => {
      eqGains(c, [2.5, -2, 0, 1.5, 2.5])
      c.comp = { ...c.comp, threshold: -14, ratio: 4, attack: 5, release: 80 }
      c.bypass.multiband = false
      c.stereo = { ...c.stereo, width: 120, bassMono: 150 }
      c.bypass.saturation = false
      c.saturation = { ...c.saturation, drive: 6, mode: 'clip', mix: 30 }
      c.limiter = { ...c.limiter, gain: 9, release: 40 }
    },
  },
  {
    id: 'lofi', label: '로파이', apply: c => {
      eqGains(c, [1.5, 1, 0, -2, -4])
      c.eq.lpf = { on: true, freq: 12000, slope: 12 }
      c.bypass.saturation = false
      c.saturation = { ...c.saturation, drive: 8, mode: 'tape', mix: 60 }
      c.stereo.width = 85
      c.limiter.gain = 4
    },
  },
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

export function buildGenrePreset(id: string): ChainParams {
  const c = defaultChain()
  GENRE_PRESETS.find(p => p.id === id)?.apply(c)
  return c
}
