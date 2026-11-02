import { describe, it, expect } from 'vitest'
import { releaseCheck, autoFix, worstStatus, STREAM_TARGET } from './releaseCheck'
import { defaultChain } from './presets'
import type { Analysis } from './analyze'

const base = (o: Partial<Analysis> = {}): Analysis => ({
  duration: 180, sampleRate: 44100, integrated: -14, lra: 6, maxMomentary: -8, maxShortTerm: -10, truePeak: -1.2, samplePeak: -1.3,
  rmsDb: -16, crest: 14, plr: 12.8, psrAvg: 9, psrMin: 7, shortSeries: new Float32Array(), momentarySeries: new Float32Array(),
  clips: [], clipSamples: 0, bands: [], spectrogram: { cols: 0, rows: 0, data: new Uint8Array(), fMin: 30, fMax: 20000 },
  correlation: 0.8, sideLowDb: -20, sibilanceDb: -12,
  harsh: { hfMeanDb: -30, hfPeakDb: -24, flatness: 0.2, spikeDb: 5, bulgeDb: 10, frames: 1000 },
  ...o,
})

const status = (a: Analysis, t?: { lufs: number; tp: number } | null) => Object.fromEntries(releaseCheck(a, t).map(i => [i.id, i.status]))

describe('발매 점검 6항목', () => {
  it('정상 곡은 6항목 모두 통과', () => {
    const items = releaseCheck(base())
    expect(items.map(i => i.id)).toEqual(['loudness', 'truePeak', 'clipping', 'dynamics', 'mono', 'harsh'])
    expect(worstStatus(items)).toBe('ok')
    expect(items.every(i => !i.cause && !i.fix)).toBe(true)
  })
  it('트루피크 0 초과·클리핑 많음·강약 납작·상관도 음수·고음 거칠기 큼은 문제', () => {
    const s = status(base({ truePeak: 0.4, clipSamples: 120, plr: 4, correlation: -0.2, harsh: { hfMeanDb: -30, hfPeakDb: -20, flatness: 0.2, spikeDb: 8, bulgeDb: 16, frames: 900 } }))
    expect(s).toMatchObject({ truePeak: 'bad', clipping: 'bad', dynamics: 'bad', mono: 'bad', harsh: 'bad' })
  })
  it('문제 항목에는 원인과 해결 방법이 붙는다', () => {
    const items = releaseCheck(base({ truePeak: 0.4 }))
    const tp = items.find(i => i.id === 'truePeak')!
    expect(tp.cause).toBeTruthy()
    expect(tp.fix).toBeTruthy()
  })
  it('목표가 있으면 목표와의 차이로 음량을 본다(±1 통과, ±2 주의, 그 밖 문제)', () => {
    const t = { lufs: -9, tp: -1 }
    expect(status(base({ integrated: -9.6, plr: 8.4 }), t).loudness).toBe('ok')
    expect(status(base({ integrated: -10.8 }), t).loudness).toBe('warn')
    expect(status(base({ integrated: -14 }), t).loudness).toBe('bad')
  })
  it('목표가 없으면 스트리밍 기준의 넓은 범위', () => {
    expect(STREAM_TARGET.lufs).toBe(-14)
    expect(status(base({ integrated: -10 })).loudness).toBe('ok')
    expect(status(base({ integrated: -7 })).loudness).toBe('warn')
    expect(status(base({ integrated: -25 })).loudness).toBe('bad')
  })
})

describe('자동 재처리용 설정 고치기', () => {
  it('통과면 고칠 게 없다', () => {
    expect(autoFix(releaseCheck(base()), defaultChain(), { lufs: -14, tp: -1 }, base())).toBeNull()
  })
  it('피크 초과 → 천장을 낮추고, 강약 납작 → 목표를 낮추고, 상관도 음수 → 폭을 줄이고, 거칠면 고음 정리를 켠다', () => {
    const a = base({ truePeak: 0.3, plr: 4.5, correlation: -0.1, harsh: { hfMeanDb: -30, hfPeakDb: -20, flatness: 0.2, spikeDb: 8, bulgeDb: 16, frames: 900 } })
    const p = defaultChain()
    const f = autoFix(releaseCheck(a, { lufs: -9, tp: -1 }), p, { lufs: -9, tp: -1 }, a)!
    expect(f.params.limiter.ceiling).toBeLessThan(p.limiter.ceiling)
    expect(f.target.lufs).toBeLessThan(-9)
    expect(f.params.stereo.width).toBeLessThanOrEqual(90)
    expect(f.params.bypass.aiclean).toBe(false)
    expect(f.changes.length).toBeGreaterThanOrEqual(4)
    // 원래 설정은 그대로
    expect(p.bypass.aiclean).toBe(true)
  })
  it('이미 자연스럽게 켜져 있으면 강하게로 올린다', () => {
    const a = base({ harsh: { hfMeanDb: -30, hfPeakDb: -20, flatness: 0.2, spikeDb: 8, bulgeDb: 16, frames: 900 } })
    const p = defaultChain(); p.bypass.aiclean = false
    const f = autoFix(releaseCheck(a), p, STREAM_TARGET, a)!
    expect(f.params.aiclean.mode).toBe('strong')
  })
})
