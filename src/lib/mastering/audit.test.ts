/**
 * 마스터링 전수 점검 — 슬롯 14개가 실제로 소리를 바꾸는지, 바이패스가 진짜인지, 템플릿·조합이 목표에 맞는지 수치로 확인.
 * 무음: 오프라인 계산만. 측정값은 콘솔에 한 줄씩 찍는다.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { MATCH_FREQS, type ChainParams, type SlotId } from './dsp'
import { defaultChain } from './presets'
import { TEMPLATES } from './templates'
import { composeChoice, USE_CARDS, GENRE_GROUPS, TEXTURE_CARDS, type Choice } from './compose'
import { autoMaster } from './automaster'
import { analyzeAudio } from './analyze'
import { renderChain, autoMatchLoudness, mixStems, type StemMix } from './render'
import {
  FS, SIG, bandFilter, makeSignal, bandDb, sideMidDb, samplePeakDb, rmsDbOf, crestDb, lufsOf, truePeakDb, residualDb,
} from './audit-signal'

const log = (name: string, msg: string) => console.log(`[audit] ${name.padEnd(12)} ${msg}`)
const f1 = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)

let sig: Float32Array[]
let base: Float32Array[]

function off(): ChainParams {
  const c = defaultChain()
  for (const k of Object.keys(c.bypass) as SlotId[]) c.bypass[k] = true
  c.inputTrim = 0
  return c
}
function only(slot: SlotId, patch?: (c: ChainParams) => void) {
  const c = off(); c.bypass[slot] = false; patch?.(c); return c
}
async function render(p: ChainParams, src = sig) {
  const r = await renderChain(src, FS, p)
  return r.channels!
}

beforeAll(async () => {
  sig = makeSignal()
  base = await render(off())
}, 60000)

describe('신호 점검', () => {
  it('합성 신호가 의도대로: 48kHz 10초 스테레오, 피크 -6dBFS 초과(클리퍼 점검용), 꼬리는 조용', () => {
    expect(sig[0].length).toBe(10 * FS)
    expect(samplePeakDb(sig)).toBeGreaterThan(-6)
    expect(samplePeakDb(sig)).toBeLessThan(0)
    expect(rmsDbOf(sig, SIG.body)).toBeGreaterThan(rmsDbOf(sig, SIG.quiet) + 30)
    log('signal', `LUFS ${lufsOf(sig).toFixed(2)} peak ${samplePeakDb(sig).toFixed(2)} crest ${crestDb(sig, SIG.body).toFixed(2)}`)
  })
})

describe('a. 슬롯별 켬 vs 끔', () => {
  it('gate: 조용한 구간 RMS 하강 ≥ 6dB', async () => {
    const o = await render(only('gate', c => { c.gate = { threshold: -20, ratio: 10, range: 40, attack: 1, hold: 50, release: 200 } }))
    const d = rmsDbOf(o, SIG.quiet) - rmsDbOf(base, SIG.quiet)
    log('gate', `조용한 구간 RMS ${f1(d)} dB`)
    expect(d).toBeLessThanOrEqual(-6)
  })
  it('eq: lf +6dB → 저역 에너지 ≥ +3dB, 고역은 거의 그대로', async () => {
    const o = await render(only('eq', c => { c.eq.lf.gain = 6 }))
    const dl = bandDb(o, 'low', SIG.body) - bandDb(base, 'low', SIG.body)
    const dh = bandDb(o, 'high', SIG.body) - bandDb(base, 'high', SIG.body)
    log('eq', `저역 ${f1(dl)} dB, 고역 ${f1(dh)} dB`)
    expect(dl).toBeGreaterThanOrEqual(3)
    expect(Math.abs(dh)).toBeLessThan(1)
  })
  it('mseq: 사이드 high +8dB → 고역 사이드/미드 ≥ +3dB, 미드는 그대로', async () => {
    const o = await render(only('mseq', c => { c.mseq.side.high = { freq: 4000, gain: 8 } }))
    const d = sideMidDb(o, 'high', SIG.body) - sideMidDb(base, 'high', SIG.body)
    const dm = bandDb(o, 'mid', SIG.body) - bandDb(base, 'mid', SIG.body)
    log('mseq', `고역 S/M ${f1(d)} dB, 중역 전체 ${f1(dm)} dB`)
    expect(d).toBeGreaterThanOrEqual(3)
  })
  it('dyneq: range 8 (2.8k 밴드, 임계 -50) → 2.2~3.6k 에너지 하강 ≥ 1.5dB, 저역 불변', async () => {
    const o = await render(only('dyneq', c => {
      c.dyneq.bands.forEach((b, i) => { b.on = i === 1 })
      Object.assign(c.dyneq.bands[1], { freq: 2800, q: 1.5, threshold: -50, ratio: 10, range: 8, attack: 3, release: 80, mode: 'cut' })
    }))
    const dh = bandDb(o, 'hmf', SIG.body) - bandDb(base, 'hmf', SIG.body)
    const dm = bandDb(o, 'mid', SIG.body) - bandDb(base, 'mid', SIG.body)
    const dl = bandDb(o, 'low', SIG.body) - bandDb(base, 'low', SIG.body)
    log('dyneq', `2.2~3.6k ${f1(dh)} dB, 중역 ${f1(dm)} dB, 저역 ${f1(dl)} dB (잔차 ${residualDb(base, o).toFixed(1)} dB)`)
    expect(residualDb(base, o)).toBeGreaterThan(-30)
    expect(dh).toBeLessThanOrEqual(-1.5)
    expect(Math.abs(dl)).toBeLessThan(0.5)
  })
  it('deesser: range 12, 임계 -50 → 치찰음 버스트(5.5~9k) 에너지 하강 ≥ 3dB', async () => {
    const o = await render(only('deesser', c => { c.deesser = { freq: 6500, threshold: -50, range: 12, listen: false } }))
    const d = bandDb(o, 'sib', SIG.sibWindows) - bandDb(base, 'sib', SIG.sibWindows)
    const dm = bandDb(o, 'mid', SIG.body) - bandDb(base, 'mid', SIG.body)
    log('deesser', `버스트 ${f1(d)} dB, 중역 ${f1(dm)} dB`)
    expect(d).toBeLessThanOrEqual(-3)
  })
  it('match: 곡선 저역 +6 / 고역 -6, 강도 100 → 저역 ≥ +3dB, 고역 ≤ -3dB', async () => {
    const o = await render(only('match', c => {
      c.match.curve = MATCH_FREQS.map(f => (f < 150 ? 6 : f > 4000 ? -6 : 0)); c.match.strength = 100
    }))
    const dl = bandDb(o, 'low', SIG.body) - bandDb(base, 'low', SIG.body)
    const dh = bandDb(o, 'high', SIG.body) - bandDb(base, 'high', SIG.body)
    log('match', `저역 ${f1(dl)} dB, 고역 ${f1(dh)} dB`)
    expect(dl).toBeGreaterThanOrEqual(3)
    expect(dh).toBeLessThanOrEqual(-3)
  })
  it('comp: 임계 -30 · 비 4 → 본문 RMS ≤ -2dB 또는 크레스트 감소 ≥ 1.5dB', async () => {
    const o = await render(only('comp', c => { c.comp = { threshold: -30, ratio: 4, attack: 5, release: 150, knee: 6, makeup: 0, mix: 100, autoMakeup: false } }))
    const dr = rmsDbOf(o, SIG.body) - rmsDbOf(base, SIG.body)
    const dc = crestDb(o, SIG.body) - crestDb(base, SIG.body)
    log('comp', `RMS ${f1(dr)} dB, 크레스트 ${f1(dc)} dB`)
    expect(dr <= -2 || dc <= -1.5).toBe(true)
  })
  it('multiband: 임계 -40 · 비 4 → 통합 LUFS 하강 ≥ 2dB', async () => {
    const o = await render(only('multiband', c => { c.multiband.bands.forEach(b => { b.threshold = -40; b.ratio = 4; b.attack = 10; b.release = 120 }) }))
    const d = lufsOf(o) - lufsOf(base)
    log('multiband', `LUFS ${f1(d)} dB, 크레스트 ${f1(crestDb(o, SIG.body) - crestDb(base, SIG.body))} dB`)
    expect(d).toBeLessThanOrEqual(-2)
  })
  it('transient: attack +80 → 크레스트 증가 ≥ 1.5dB', async () => {
    const o = await render(only('transient', c => { c.transient = { attack: 80, sustain: 0, output: 0 } }))
    const dc = crestDb(o, SIG.body) - crestDb(base, SIG.body)
    log('transient', `크레스트 ${f1(dc)} dB, 피크 ${f1(samplePeakDb(o, SIG.body) - samplePeakDb(base, SIG.body))} dB`)
    expect(dc).toBeGreaterThanOrEqual(1.5)
  })
  it('imager: 폭 [50,100,180] → 저역 S/M 하강 ≥ 2dB, 고역 S/M 상승 ≥ 2dB', async () => {
    const o = await render(only('imager', c => { c.imager.widths = [50, 100, 180] }))
    const dl = sideMidDb(o, 'low', SIG.body) - sideMidDb(base, 'low', SIG.body)
    const dh = sideMidDb(o, 'high', SIG.body) - sideMidDb(base, 'high', SIG.body)
    log('imager', `저역 S/M ${f1(dl)} dB, 고역 S/M ${f1(dh)} dB`)
    expect(dl).toBeLessThanOrEqual(-2)
    expect(dh).toBeGreaterThanOrEqual(2)
  })
  it('stereo: 폭 150 → 전체 S/M 상승 ≥ 3dB', async () => {
    const o = await render(only('stereo', c => { c.stereo.width = 150 }))
    const d = sideMidDb(o, 'full', SIG.body) - sideMidDb(base, 'full', SIG.body)
    log('stereo', `S/M ${f1(d)} dB`)
    expect(d).toBeGreaterThanOrEqual(3)
  })
  it('saturation: drive 12 · mix 100 → 파형 변화(잔차 > -30dB)', async () => {
    const o = await render(only('saturation', c => { c.saturation = { drive: 12, mode: 'tape', mix: 100, output: 0 } }))
    const r = residualDb(base, o)
    const dh = bandDb(o, 'high', SIG.body) - bandDb(base, 'high', SIG.body)
    log('saturation', `잔차 ${r.toFixed(1)} dB, 고역 ${f1(dh)} dB, 크레스트 ${f1(crestDb(o, SIG.body) - crestDb(base, SIG.body))} dB`)
    expect(r).toBeGreaterThan(-30)
  })
  it('clipper: 임계 -6 → 샘플 피크 ≤ -5.5, 끈 쪽보다 ≥ 0.5dB 낮음', async () => {
    const o = await render(only('clipper', c => { c.clipper = { threshold: -6, softness: 40, output: 0 } }))
    const pk = samplePeakDb(o), pb = samplePeakDb(base)
    log('clipper', `피크 ${pk.toFixed(2)} dBFS (끔 ${pb.toFixed(2)})`)
    expect(pb).toBeGreaterThan(-6)
    expect(pk).toBeLessThanOrEqual(-5.5)
    expect(pk).toBeLessThanOrEqual(pb - 0.5)
  })
  it('limiter: gain 12 · 천장 -1 → 트루피크 ≤ -0.7, LUFS 상승 ≥ 3dB', async () => {
    const o = await render(only('limiter', c => { c.limiter = { gain: 12, ceiling: -1, release: 80, truePeak: true } }))
    const tp = truePeakDb(o), d = lufsOf(o) - lufsOf(base)
    log('limiter', `트루피크 ${tp.toFixed(2)} dBTP, LUFS ${f1(d)} dB`)
    expect(tp).toBeLessThanOrEqual(-0.7)
    expect(d).toBeGreaterThanOrEqual(3)
  })
})

describe('b. 바이패스', () => {
  it('전부 bypass · inputTrim 0 → 출력 ≈ 입력 (최대 오차 < 0.001)', () => {
    let maxErr = 0
    for (let c = 0; c < 2; c++) for (let i = 0; i < sig[c].length; i++) maxErr = Math.max(maxErr, Math.abs(base[c][i] - sig[c][i]))
    log('bypass', `최대 오차 ${maxErr.toExponential(2)}, 길이 ${base[0].length}/${sig[0].length}`)
    expect(base[0].length).toBe(sig[0].length)
    expect(maxErr).toBeLessThan(1e-3)
  })
  it('슬롯별 개별 bypass: 한 슬롯을 켰다 끄면(끔 상태) 항상 같은 출력', async () => {
    // 파라미터를 극단값으로 두고 bypass 만 true — 출력이 입력과 같아야 한다
    const c = off()
    c.gate.threshold = -10; c.comp.threshold = -40; c.stereo.width = 200; c.saturation.drive = 20; c.clipper.threshold = -12; c.limiter.gain = 20
    c.eq.lf.gain = 12; c.deesser.range = 12; c.imager.widths = [0, 300, 300]
    const o = await render(c)
    let maxErr = 0
    for (let k = 0; k < 2; k++) for (let i = 0; i < sig[k].length; i++) maxErr = Math.max(maxErr, Math.abs(o[k][i] - sig[k][i]))
    log('bypass2', `극단 파라미터 + bypass 최대 오차 ${maxErr.toExponential(2)}`)
    expect(maxErr).toBeLessThan(1e-3)
  })
})

describe('c. 템플릿·조합 전수 (autoMaster → 음량 맞춤)', () => {
  // 5초 구간(클릭·치찰음 포함) 으로 줄여 시간 절약
  let short: Float32Array[]
  let ana: Awaited<ReturnType<typeof analyzeAudio>>
  beforeAll(async () => {
    short = sig.map(c => c.slice(0, 5 * FS))
    ana = await analyzeAudio(short, FS, { spectrogramCols: 8 })
  })

  async function check(label: string, tpl: { lufs: number; tp: number; build: () => ChainParams }, tplFull: Parameters<typeof autoMaster>[1]) {
    const am = autoMaster(ana, tplFull)
    const r = await autoMatchLoudness(short, FS, am.params, tpl.lufs)
    return { label, dl: r.integrated - tpl.lufs, tp: r.truePeak - tpl.tp }
  }

  it(`템플릿 ${TEMPLATES.length}개 전부: LUFS ±1.5, 트루피크 ≤ 천장+0.3`, async () => {
    const bad: string[] = []
    for (const t of TEMPLATES) {
      const r = await check(t.id, t, t)
      if (Math.abs(r.dl) > 1.5 || r.tp > 0.3) bad.push(`${t.id}: LUFS 오차 ${f1(r.dl)}, 트루피크-천장 ${f1(r.tp)}`)
    }
    log('templates', `${TEMPLATES.length}개 중 실패 ${bad.length}`)
    bad.forEach(b => log('templates', b))
    expect(bad).toEqual([])
  }, 600000)

  it('용도 8 × 느낌 7 에서 고른 조합 24개: LUFS ±1.5, 트루피크 ≤ 천장+0.3', async () => {
    const genres = GENRE_GROUPS.flatMap(g => g.genres)
    const combos: Choice[] = []
    for (let i = 0; i < 24; i++) {
      combos.push({
        use: USE_CARDS[i % USE_CARDS.length].id,
        genre: i % 5 === 4 ? null : genres[(i * 5) % genres.length],
        texture: TEXTURE_CARDS[(i * 3) % TEXTURE_CARDS.length].id,
      })
    }
    const bad: string[] = []
    for (const ch of combos) {
      const t = composeChoice(ch)
      const r = await check(t.label, t, t)
      if (Math.abs(r.dl) > 1.5 || r.tp > 0.3) bad.push(`${t.id}: LUFS 오차 ${f1(r.dl)}, 트루피크-천장 ${f1(r.tp)}`)
    }
    log('combos', `${combos.length}개 중 실패 ${bad.length}`)
    bad.forEach(b => log('combos', b))
    expect(bad).toEqual([])
  }, 600000)
})

describe('d. 슬롯 순서', () => {
  it('saturation 을 limiter 뒤로 두면 결과가 달라지고, 리미터가 마지막이면 천장을 지킨다', async () => {
    const mk = (order: SlotId[]) => {
      const c = off()
      c.bypass.saturation = false; c.bypass.limiter = false
      c.saturation = { drive: 12, mode: 'tape', mix: 100, output: 0 }
      c.limiter = { gain: 8, ceiling: -1, release: 80, truePeak: true }
      c.order = order
      return c
    }
    const rest = defaultChain().order.filter(s => s !== 'saturation' && s !== 'limiter')
    const a = await render(mk([...rest, 'saturation', 'limiter']))
    const b = await render(mk([...rest, 'limiter', 'saturation']))
    const r = residualDb(a, b)
    log('order', `잔차 ${r.toFixed(1)} dB, 트루피크 sat→lim ${truePeakDb(a).toFixed(2)} / lim→sat ${truePeakDb(b).toFixed(2)}, LUFS ${lufsOf(a).toFixed(2)} / ${lufsOf(b).toFixed(2)}`)
    expect(r).toBeGreaterThan(-40)
    expect(truePeakDb(a)).toBeLessThanOrEqual(-0.7)
  })
})

describe('e. 믹서 (mixStems)', () => {
  const N = 3 * FS
  const stem = (ch: Float32Array[], p: Partial<StemMix> = {}): StemMix =>
    ({ channels: ch, gain: 0, pan: 0, mute: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, ...p })
  let bass: Float32Array[], midS: Float32Array[], hiS: Float32Array[]
  const mix = (a: Partial<StemMix> = {}, b: Partial<StemMix> = {}, c: Partial<StemMix> = {}) =>
    mixStems([stem(bass, a), stem(midS, b), stem(hiS, c)], FS)
  const white = (seed: number) => { let s = seed; const x = new Float32Array(N); for (let i = 0; i < N; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = (s / 4294967296 * 2 - 1) } return x }
  const scale = (x: Float32Array, g: number) => x.map(v => v * g)
  beforeAll(() => {
    const b = new Float32Array(N)
    for (let i = 0; i < N; i++) b[i] = 0.1 * Math.sin(2 * Math.PI * 60 * i / FS) + 0.05 * Math.sin(2 * Math.PI * 100 * i / FS)
    bass = [b, b]
    const m = scale(bandFilter(white(5), 'mid'), 0.3); midS = [m, m]
    const h = scale(bandFilter(white(9), 'high'), 0.3); hiS = [h, h]
  })

  // 스템 사이 대역 누설(중음 노이즈가 저·고역에도 있음)이 측정을 흐리지 않게, 스템 하나씩 따로 믹스해 잰다
  const alone = (st: Float32Array[], p: Partial<StemMix>) => mixStems([stem(st, p)], FS)
  const diffDb = (x: Float32Array[], y: Float32Array[], ref: Float32Array[]) => {
    const d = [x[0].map((v, i) => v - y[0][i]), x[1].map((v, i) => v - y[1][i])]
    return rmsDbOf(d) - rmsDbOf(ref)
  }
  it('(1) gain -6 dB 스템의 대역 에너지 ≈ -6 (±0.5)', async () => {
    const r: number[] = []
    for (const [st, band] of [[bass, 'low'], [midS, 'mid'], [hiS, 'high']] as const)
      r.push(bandDb(await alone(st, { gain: -6 }), band) - bandDb(await alone(st, {}), band))
    log('mixer gain', `저 ${f1(r[0])} 중 ${f1(r[1])} 고 ${f1(r[2])} dB`)
    for (const v of r) expect(Math.abs(v + 6)).toBeLessThanOrEqual(0.5)
  })
  it('(2) mute 스템이 사라진다: 믹스가 나머지 스템만 섞은 것과 같다 (차이 ≤ -40dB), 스템 단독은 무음', async () => {
    const out = await mix({ mute: true })
    const others = await mixStems([stem(midS), stem(hiS)], FS)
    const dd = diffDb(out, others, others)
    const solo = await alone(bass, { mute: true })
    log('mixer mute', `저음 mute: 나머지만 섞은 것과 차이 ${dd.toFixed(1)} dB, 단독 mute RMS ${rmsDbOf(solo).toFixed(0)} dB, (참고) 믹스 안 저역 ${f1(bandDb(out, 'low') - bandDb(await mix(), 'low'))} dB`)
    expect(dd).toBeLessThanOrEqual(-40)
    expect(rmsDbOf(solo)).toBeLessThanOrEqual(-100)
  })
  it('(3) 한 스템 solo 면 나머지가 사라진다: 믹스 = 그 스템 단독 (차이 ≤ -40dB)', async () => {
    const out = await mix({}, { solo: true })
    const only1 = await alone(midS, {})
    const dd = diffDb(out, only1, only1)
    log('mixer solo', `중음 solo: 단독과 차이 ${dd.toFixed(1)} dB`)
    expect(dd).toBeLessThanOrEqual(-40)
  })
  it('(4) pan -100 → R 거의 0(≤ -30dB), pan 0 → L=R, 팬 법칙 값 기록', async () => {
    const ref = await mixStems([stem(midS)], FS)
    const l100 = await mixStems([stem(midS, { pan: -100 })], FS)
    const r100 = await mixStems([stem(midS, { pan: 100 })], FS)
    const q = await mixStems([stem(midS, { pan: -50 })], FS)
    const e = (x: Float32Array) => 10 * Math.log10(x.reduce((a, v) => a + v * v, 0) / x.length + 1e-30)
    const rRel = e(l100[1]) - e(l100[0])
    let maxDiff = 0
    for (let i = 0; i < N; i++) maxDiff = Math.max(maxDiff, Math.abs(ref[0][i] - ref[1][i]))
    log('mixer pan', `pan-100: R-L ${rRel.toFixed(1)} dB, L 이득 ${f1(e(l100[0]) - e(ref[0]))} dB, pan+100 R 이득 ${f1(e(r100[1]) - e(ref[1]))} dB, pan-50 L ${f1(e(q[0]) - e(ref[0]))} R ${f1(e(q[1]) - e(ref[1]))} dB, pan0 L-R 최대차 ${maxDiff.toExponential(1)}, 중앙 이득 ${f1(e(ref[0]) - e(midS[0]))} dB`)
    expect(rRel).toBeLessThanOrEqual(-30)
    expect(maxDiff).toBeLessThan(1e-6)
  })
  it('(5) 스템 eq low +6 → 저역 대역 +6 (±1)', async () => {
    const d = bandDb(await alone(bass, { eq: { low: 6, mid: 0, high: 0 } }), 'low') - bandDb(await alone(bass, {}), 'low')
    log('mixer eq', `low +6 → 저역 ${f1(d)} dB`)
    expect(Math.abs(d - 6)).toBeLessThanOrEqual(1)
  })
})
