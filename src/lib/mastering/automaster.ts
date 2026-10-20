/**
 * 자동 마스터링(규칙 기반). 템플릿 값에서 출발해 곡 분석으로 보정한다.
 * 결과는 일반 체인 값이라 사용자가 그대로 고칠 수 있다. 무엇을 왜 바꿨는지 notes 로 돌려준다.
 */
import { MATCH_FREQS, autoMakeupDb, type ChainParams } from './dsp'
import type { Analysis } from './analyze'
import { normalizeBands } from './analyze'
import type { MasterTemplate, ToneTarget } from './templates'

export interface AutoMasterResult { params: ChainParams; notes: string[] }

/** 톤 목표 곡선 (평균 0 기준 dB) */
export function toneTargetDb(t: ToneTarget, f: number): number {
  let v = t.tilt * Math.log2(f / 1000)
  if (f < 120) v += t.low * Math.min(1, Math.log2(120 / f))
  if (f > 8000) v += t.air * Math.min(1, Math.log2(f / 8000))
  return v
}

function normalizedTarget(t: ToneTarget): number[] {
  return normalizeBands(MATCH_FREQS.map(f => toneTargetDb(t, f)))
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/** 분석 + 템플릿 → 체인 */
export function autoMaster(a: Analysis, tpl: MasterTemplate): AutoMasterResult {
  const p = tpl.build()
  const notes: string[] = []
  const src = normalizeBands(a.bands)
  const tgt = normalizedTarget(tpl.tone)
  const dev = src.map((v, i) => v - tgt[i])
  const devAround = (f: number, octs: number) => {
    const idx = MATCH_FREQS.map((x, i) => i).filter(i => Math.abs(Math.log2(MATCH_FREQS[i] / f)) <= octs / 2)
    return idx.reduce((s, i) => s + dev[i], 0) / Math.max(1, idx.length)
  }

  // 1) 톤: 각 EQ 밴드 근처의 차이를 60% 만 메운다(과보정 방지), ±4dB 안
  const bands: [keyof Pick<ChainParams['eq'], 'lf' | 'lmf' | 'mf' | 'hmf' | 'hf'>, number, number][] = [
    ['lf', p.eq.lf.freq, 1.5], ['lmf', p.eq.lmf.freq, 1], ['mf', p.eq.mf.freq, 1], ['hmf', p.eq.hmf.freq, 1], ['hf', p.eq.hf.freq, 1.5],
  ]
  const names: Record<string, string> = { lf: '저역', lmf: '저중역', mf: '중역', hmf: '중고역', hf: '고역' }
  for (const [k, f, w] of bands) {
    const d = devAround(f, w)
    const corr = clamp(-0.6 * d, -4, 4)
    if (Math.abs(corr) >= 0.5) {
      Object.assign(p.eq[k], { on: true, gain: r1(clamp(p.eq[k].gain + corr, -8, 8)) })
      notes.push(`${names[k]}(${f >= 1000 ? `${(f / 1000).toFixed(1)}k` : Math.round(f)}Hz)이 목표보다 ${d > 0 ? '많아' : '적어'} ${corr > 0 ? '+' : ''}${corr.toFixed(1)}dB 보정`)
    }
  }

  // 2) 다이내믹: 크레스트 팩터로 압축 강도 조절
  if (a.crest > 16) {
    p.comp.ratio = r1(clamp(p.comp.ratio + 0.5, 1, 6))
    p.comp.threshold = r1(clamp(a.rmsDb + 6, -36, -8))
    notes.push(`크레스트 팩터 ${a.crest.toFixed(1)}dB 로 다이내믹이 커서 컴프를 조금 더 걸고 스레숄드를 곡 평균(${a.rmsDb.toFixed(1)}dBFS) 근처로`)
  } else if (a.crest < 9) {
    p.comp.ratio = r1(Math.min(p.comp.ratio, 1.4))
    p.bypass.multiband = true
    p.limiter.release = Math.max(p.limiter.release, 120)
    notes.push(`이미 많이 눌린 소리(크레스트 ${a.crest.toFixed(1)}dB) — 압축을 줄이고 멀티밴드는 끔`)
  } else {
    p.comp.threshold = r1(clamp(a.rmsDb + 8, -36, -8))
  }
  p.comp.makeup = r1(clamp(autoMakeupDb(p.comp.threshold, p.comp.ratio, p.comp.knee) * 0.5, 0, 6))

  // 3) 저역 사이드가 크면 저역 모노
  if (a.sideLowDb > -14 && p.stereo.bassMono < 100) {
    p.stereo.bassMono = 120
    notes.push(`150Hz 아래에 좌우 차이가 많아(${a.sideLowDb.toFixed(1)}dB) 120Hz 아래를 모노로`)
  }
  // 4) 위상 상관이 낮으면 폭을 줄인다
  if (a.correlation < 0.3) {
    p.stereo.width = Math.min(p.stereo.width, 90)
    notes.push(`좌우 상관이 낮아(${a.correlation.toFixed(2)}) 모노 호환을 위해 폭을 90% 로`)
  }
  // 5) 치찰음
  if (a.sibilanceDb > -6) {
    p.bypass.deesser = false
    p.deesser.threshold = r1(clamp(a.rmsDb - 6, -40, -16))
    notes.push(`5~9kHz 가 중역 대비 큼(${a.sibilanceDb.toFixed(1)}dB) — 디에서 켬`)
  }
  // 6) 클리핑된 소스
  if (a.clipSamples > 0) {
    notes.push(`원본에 클리핑 ${a.clipSamples}샘플 — 입력을 2dB 낮춰 여유 확보`)
    p.inputTrim = r1(p.inputTrim - 2)
  }
  if (!notes.length) notes.push('곡이 템플릿 목표와 가까워 템플릿 값을 그대로 썼어요')
  return { params: p, notes }
}
