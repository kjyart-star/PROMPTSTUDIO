/**
 * 자동 마스터링(규칙 기반) — 「먼저 곡을 분석해 보정하고, 템플릿은 성격만 입힌다」.
 *
 *  1) 톤: 곡 스펙트럼과 템플릿 톤 목표(toneTarget)의 차이로 보정 EQ 를 계산하고,
 *     템플릿 EQ 게인은 「성격(상대값)」으로만 더한다. 곡이 이미 그 방향으로 넘쳐 있으면 성격 몫을 덜어낸다.
 *  2) 다이내믹: 크레스트로 압축 강도를 정하고, 원본 PLR 대비 결과 PLR 감소가 템플릿 허용치를 넘지 않게
 *     압축·멀티밴드·클리퍼를 줄이고, 그래도 넘으면 목표 음량을 낮춘다(targetLufs 로 돌려준다).
 *  3) 폭: 좌우 상관이 낮으면 템플릿의 넓히기를 줄인다. 저역 사이드가 크면 저역 모노.
 *  4) 음량: 리미터 게인을 목표 LUFS 에 맞게 예측해 둔다(정확한 값은 autoMatchLoudness / masterToTarget 가 잰다).
 * 결과는 일반 체인 값이라 사용자가 그대로 고칠 수 있다. 무엇을 왜 바꿨는지 notes 로 돌려준다.
 */
import { MATCH_FREQS, autoMakeupDb, type ChainParams, type EditParams } from './dsp'
import type { Analysis } from './analyze'
import { normalizeBands } from './analyze'
import { plrLossOf, type MasterTemplate, type ToneTarget } from './templates'
import { autoMatchLoudness, renderChain } from './render'

export interface AutoMasterResult {
  params: ChainParams
  notes: string[]
  /** 실제로 맞출 목표 LUFS — 다이내믹 보호로 템플릿 목표보다 낮아질 수 있다 */
  targetLufs: number
  /** 이 템플릿이 허용하는 PLR 감소(dB) */
  plrLossMax: number
}

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

/** 리미터 천장 안쪽 여유 — 트루피크 측정 오차로 천장을 넘지 않게 */
const CEIL_MARGIN = 0.2

/**
 * 템플릿 성격 몫: 곡이 이미 그 방향으로 dev(dB) 만큼 넘쳐 있으면 그만큼 덜어낸다.
 * (예: 고역 +2.5 성격인데 곡이 목표보다 3dB 밝다 → 성격 0)
 */
export function characterShare(char: number, dev: number): number {
  if (char > 0 && dev > 0) return Math.max(0, char - dev)
  if (char < 0 && dev < 0) return Math.min(0, char - dev)
  return char
}

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

  // 1) 톤 = 분석 보정(목표와의 차이 60%, ±4) + 템플릿 성격(상대값, 곡이 이미 넘친 만큼 덜어냄)
  const bands: [keyof Pick<ChainParams['eq'], 'lf' | 'lmf' | 'mf' | 'hmf' | 'hf'>, number, number][] = [
    ['lf', p.eq.lf.freq, 1.5], ['lmf', p.eq.lmf.freq, 1], ['mf', p.eq.mf.freq, 1], ['hmf', p.eq.hmf.freq, 1], ['hf', p.eq.hf.freq, 1.5],
  ]
  const names: Record<string, string> = { lf: '저역', lmf: '저중역', mf: '중역', hmf: '중고역', hf: '고역' }
  for (const [k, f, w] of bands) {
    const d = devAround(f, w)
    const corr = clamp(-0.6 * d, -4, 4)
    const char = p.eq[k].gain
    const share = characterShare(char, d)
    const g = r1(clamp(corr + share, -8, 8))
    if (g !== char) Object.assign(p.eq[k], { on: true, gain: g })
    if (Math.abs(corr) >= 0.5) {
      notes.push(`${names[k]}(${f >= 1000 ? `${(f / 1000).toFixed(1)}k` : Math.round(f)}Hz)이 목표보다 ${d > 0 ? '많아' : '적어'} ${corr > 0 ? '+' : ''}${corr.toFixed(1)}dB 보정${share !== char ? ` — 템플릿 성격 ${char > 0 ? '+' : ''}${char}dB 중 ${share.toFixed(1)}dB 만 더함` : ''}`)
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

  // 2-1) 다이내믹 과손실 방지: 결과 PLR ≤ 천장 - 목표 LUFS 이므로, 허용치를 넘을 목표면 낮춘다
  const plrLossMax = plrLossOf(tpl)
  const ceiling = p.limiter.ceiling
  let targetLufs = tpl.lufs
  if (Number.isFinite(a.plr) && Number.isFinite(a.integrated)) {
    const outPlrMax = ceiling - tpl.lufs
    const loss = a.plr - outPlrMax
    if (loss > plrLossMax - 0.5) {
      // 압축 계열을 먼저 줄인다 — 리미터만으로도 PLR 이 깎이므로 앞단에서 더 깎지 않게
      p.comp.ratio = r1(Math.min(p.comp.ratio, 1.5))
      p.bypass.multiband = true
      p.bypass.clipper = true
      // 그래도 리미터 몫만으로 허용치를 넘으면 목표 음량을 낮춘다(0.5dB 여유)
      if (loss > plrLossMax - 1) {
        targetLufs = r1(Math.min(tpl.lufs, ceiling - (a.plr - plrLossMax) - 0.5))
        notes.push(`원곡 다이내믹(PLR ${a.plr.toFixed(1)}dB)을 지키려고 목표를 ${tpl.lufs} → ${targetLufs} LUFS 로 낮춤 (허용 감소 ${plrLossMax}dB)`)
      } else notes.push(`다이내믹 보호 — 압축을 줄이고 멀티밴드·클리퍼를 끔 (허용 감소 ${plrLossMax}dB)`)
    }
  }
  if (plrLossMax <= 3) {
    // 배경음악·클래식 계열: 과한 압축 금지
    p.comp.ratio = r1(Math.min(p.comp.ratio, 2))
    p.bypass.multiband = true
    p.bypass.clipper = true
  }
  p.comp.makeup = r1(clamp(autoMakeupDb(p.comp.threshold, p.comp.ratio, p.comp.knee) * 0.5, 0, 6))

  // 3) 저역 사이드가 크면 저역 모노
  if (a.sideLowDb > -14 && p.stereo.bassMono < 100) {
    p.stereo.bassMono = 120
    notes.push(`150Hz 아래에 좌우 차이가 많아(${a.sideLowDb.toFixed(1)}dB) 120Hz 아래를 모노로`)
  }
  // 4) 폭: 상관이 낮을수록 템플릿의 넓히기를 덜 쓴다 (0.3 아래면 넓히기 없음 + 전체 90%)
  if (a.correlation < 0.6) {
    const f = clamp((a.correlation - 0.3) / 0.3, 0, 1)
    const shrink = (w: number) => (w > 100 ? Math.round(100 + (w - 100) * f) : w)
    const before = [p.stereo.width, ...p.imager.widths].join()
    p.stereo.width = shrink(p.stereo.width)
    p.imager.widths = [p.imager.widths[0], shrink(p.imager.widths[1]), shrink(p.imager.widths[2])]
    if (a.correlation < 0.3) p.stereo.width = Math.min(p.stereo.width, 90)
    if ([p.stereo.width, ...p.imager.widths].join() !== before)
      notes.push(`좌우 상관이 낮아(${a.correlation.toFixed(2)}) 모노 호환을 위해 넓히기를 줄임`)
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

  // 7) 천장·음량: 천장은 템플릿 트루피크에서 측정 여유만큼 안쪽, 리미터 게인은 목표에 맞게 예측
  p.limiter.ceiling = r1(tpl.tp - CEIL_MARGIN)
  if (Number.isFinite(a.integrated)) {
    let g = targetLufs - a.integrated - p.inputTrim
    const over = a.truePeak + g - p.limiter.ceiling
    if (over > 0) g += 0.3 * over // 리미팅으로 잃는 음량 대략 보충
    p.limiter.gain = r1(clamp(g, -30, 24))
  }

  if (!notes.length) notes.push('곡이 템플릿 목표와 가까워 템플릿 값을 그대로 썼어요')
  return { params: p, notes, targetLufs, plrLossMax }
}

export interface MasterToTargetResult extends AutoMasterResult {
  integrated: number
  truePeak: number
  /** 원본 PLR - 결과 PLR (dB) */
  plrLoss: number
}

/**
 * 리미터 게인을 할선법으로 목표 LUFS ±0.15 까지 맞춘다. 리미팅이 깊으면 게인을 올려도 음량이 덜 올라
 * (기울기 < 1) 단순 덧셈 반복이 수렴하지 못하는 경우를 메운다.
 */
export async function refineGain(ch: Float32Array[], fs: number, p0: ChainParams, target: number, edit?: EditParams) {
  const useLim = !p0.bypass.limiter
  const trim0 = p0.inputTrim
  // 리미터 게인 상한(24dB)을 넘는 몫은 입력 트림으로(최대 +12dB) — 아주 조용한 곡을 크게 만들 때
  const get = (p: ChainParams) => (useLim ? p.limiter.gain + (p.inputTrim - trim0) : p.inputTrim)
  const put = (p: ChainParams, g: number): ChainParams => {
    if (!useLim) return { ...p, inputTrim: Math.round(clamp(g, -24, 24) * 100) / 100 }
    const lg = Math.round(clamp(g, -30, 24) * 100) / 100
    const extra = Math.round(clamp(g - lg, 0, 12) * 100) / 100
    return { ...p, inputTrim: trim0 + extra, limiter: { ...p.limiter, gain: lg } }
  }
  let p = p0
  let m = await renderChain(ch, fs, p, { write: false, edit })
  let prev: { g: number; i: number } | null = null
  for (let k = 0; k < 6 && Number.isFinite(m.integrated) && Math.abs(m.integrated - target) > 0.15; k++) {
    const g = get(p)
    const slope = prev && Math.abs(g - prev.g) > 0.02 ? clamp((m.integrated - prev.i) / (g - prev.g), 0.15, 1.2) : 0.7
    prev = { g, i: m.integrated }
    const ng = g + (target - m.integrated) / slope
    if (Math.abs(clamp(ng, -30, 36) - g) < 0.01) break
    p = put(p, ng)
    m = await renderChain(ch, fs, p, { write: false, edit })
  }
  return { params: p, integrated: m.integrated, truePeak: m.truePeak }
}

/**
 * autoMaster → 음량 맞춤 → 실제 렌더로 PLR 감소를 재서, 허용치를 넘으면 압축을 풀고 목표를 낮춰 다시 맞춘다.
 * 트루피크가 천장을 넘으면 리미터 천장을 조금 더 안으로.
 */
export async function masterToTarget(
  ch: Float32Array[], fs: number, a: Analysis, tpl: MasterTemplate,
  opts: { onProgress?: (p: number) => void } = {},
): Promise<MasterToTargetResult> {
  const am = autoMaster(a, tpl)
  let params = am.params
  let target = am.targetLufs
  const notes = [...am.notes]
  let r = { integrated: NaN, truePeak: NaN }
  const ROUNDS = 5
  for (let k = 0; k < ROUNDS; k++) {
    const m = await autoMatchLoudness(ch, fs, params, target, x => opts.onProgress?.((k + x) / ROUNDS))
    params = m.params
    r = m
    // autoMatchLoudness 가 마지막에 게인을 고친 뒤 다시 재지 않았으면 한 번 더 재고, 덜 맞았으면 할선법으로 좁힌다
    if (Math.abs(m.integrated - target) >= 0.2) {
      const e = await refineGain(ch, fs, params, target)
      params = e.params; r = e
    }
    const loss = a.plr - (r.truePeak - r.integrated)
    const tpOver = r.truePeak - tpl.tp
    // 리미터만으로 목표에 못 닿는 곡(긴 조용한 구간 + 짧은 큰 구간): 리미터를 더 밀면 게이트 안으로 조용한 블록이 들어와
    // 통합 음량이 오히려 떨어진다 — 컴프가 일부를 나눠 맡게 한다(PLR 상한은 천장-목표로 이미 묶여 있다)
    const short = target - r.integrated
    if ((loss <= am.plrLossMax && tpOver <= 0 && short <= 0.4) || k === ROUNDS - 1) break
    if (short > 0.4 && loss <= am.plrLossMax) {
      const c = params.comp
      const th = r1(clamp(Math.min(c.threshold, a.rmsDb) - 2 - short, -40, -8)), ra = r1(Math.min(4, Math.max(c.ratio, 2) + 0.5))
      params = { ...params, comp: { ...c, threshold: th, ratio: ra, attack: Math.min(c.attack, 15), release: Math.max(c.release, 300), makeup: r1(clamp(autoMakeupDb(th, ra, c.knee) * 0.7, 0, 12)) }, bypass: { ...params.bypass, comp: false } }
      notes.push(`리미터만으로는 목표 음량에 못 닿아(${short.toFixed(1)}dB 부족) 컴프가 나눠 맡게 함 (스레숄드 ${th}dB, 비율 ${ra})`)
      continue
    }
    if (tpOver > 0) params = { ...params, limiter: { ...params.limiter, ceiling: r1(params.limiter.ceiling - tpOver - 0.1) } }
    if (loss > am.plrLossMax) {
      const ex = loss - am.plrLossMax
      // 앞단(압축·클리퍼·트랜지언트·새추레이션)이 깎은 몫부터 푼다
      const c = params.comp
      const ratio = r1(Math.max(1, c.ratio - 0.5))
      params = {
        ...params,
        comp: { ...c, ratio },
        saturation: { ...params.saturation, mix: Math.round(params.saturation.mix * 0.5) },
        bypass: { ...params.bypass, comp: params.bypass.comp || ratio <= 1.1, multiband: true, clipper: true, transient: true },
      }
      // 리미터가 실제로 천장을 치고 있을 때만 목표를 낮춘다 — 아니면 낮춰도 PLR 은 그대로다
      const limiting = !params.bypass.limiter && r.truePeak >= params.limiter.ceiling - 0.6
      if (limiting) target = r1(target - ex - 0.2)
      // 리미터가 놀고 있으면 앞단 처리(압축·새추레이션·EQ 보정이 피크 모양을 바꾼 몫)가 원인 — 압축은 끄고 보정을 30% 씩 덜 쓴다
      else {
        params = { ...params, bypass: { ...params.bypass, comp: true } }
        const eq = structuredClone(params.eq)
        for (const k of ['lf', 'lmf', 'mf', 'hmf', 'hf'] as const) eq[k].gain = r1(eq[k].gain * 0.7)
        params = { ...params, eq, bypass: { ...params.bypass, deesser: true } }
      }
      notes.push(`렌더 결과 다이내믹이 ${loss.toFixed(1)}dB 줄어 허용치(${am.plrLossMax}dB)를 넘어 압축을 풂${limiting ? ` · 목표를 ${target} LUFS 로 낮춤` : ''}`)
    }
  }
  return { ...am, params, notes, targetLufs: target, integrated: r.integrated, truePeak: r.truePeak, plrLoss: a.plr - (r.truePeak - r.integrated) }
}
