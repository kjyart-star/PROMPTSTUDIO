/**
 * 템플릿 품질 검사 — 실제 곡(없으면 합성 신호) × 템플릿·스타일·납품처 × 캐릭터를
 * masterToTarget(autoMaster → 음량 맞춤 → PLR 안전장치)으로 처리하고 수치로 판정한다.
 *
 *  - 통합 LUFS: 실제 목표(다이내믹 보호로 낮춘 경우 그 값) ±0.5, 템플릿 목표에서 낮춘 폭은 따로 기록
 *  - 트루피크 ≤ 템플릿 천장, 샘플 클리핑(|x|≥1) 0
 *  - PLR 감소 ≤ 템플릿 허용치(plrLossOf)
 *
 * 샘플: MASTERING_SAMPLES 폴더(scripts/mastering/fetch-library-samples.mjs 가 만든 manifest.json + WAV).
 * 없으면 합성 신호 3종(밝은/어두운/다이내믹 큰)으로 대신하고 테스트 이름에 「합성」 이라고 적는다.
 * 실제 곡이 있어도 PLR 안전장치 점검용으로 「합성-다이내믹」 1종을 늘 함께 돌린다.
 * 각 곡은 가장 큰 5초 구간만 쓴다(3분 제한). 무음: 오프라인 계산만.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Biquad, designShelf, designPass, dbToLin } from './dsp'
import { analyzeAudio, type Analysis } from './analyze'
import { TEMPLATES, plrLossOf, type MasterTemplate } from './templates'
import { composeChoice, SIMPLE_STYLES, TARGET_USE, type TextureId } from './compose'
import { DESTINATIONS } from './destinations'
import { masterToTarget } from './automaster'
import { FS, makeSignal } from './audit-signal'

const WIN_SEC = 5
const CHARS: TextureId[] = ['none', 'tex-clean', 'tex-warm', 'tex-punch']
// MASTERING_SAMPLES=none 이면 합성 신호만
const SAMPLE_DIRS = process.env.MASTERING_SAMPLES === 'none' ? [] : [
  process.env.MASTERING_SAMPLES,
  '/private/tmp/claude-501/-Users-jin-Documents------------COOKIELAB/062601a9-2dfc-4d38-af8e-74d1644092f8/scratchpad/samples',
].filter((d): d is string => !!d && existsSync(join(d, 'manifest.json')))

interface Source { name: string; ch: Float32Array[]; a?: Analysis }

/** 32bit float / 16bit PCM WAV 읽기 (스테레오, 48kHz 가정 확인) */
function readWav(path: string): Float32Array[] {
  const b = readFileSync(path)
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = 12, fmt = 0, chs = 2, rate = 0, bits = 0
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = v.getUint32(p + 4, true)
    if (id === 'fmt ') { fmt = v.getUint16(p + 8, true); chs = v.getUint16(p + 10, true); rate = v.getUint32(p + 12, true); bits = v.getUint16(p + 22, true) }
    if (id === 'data') {
      if (rate !== FS) throw new Error(`${path}: ${rate}Hz (48kHz 필요)`)
      const bytes = bits / 8, n = Math.floor(size / (bytes * chs))
      const out = [new Float32Array(n), new Float32Array(n)]
      for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
        const o = p + 8 + (i * chs + Math.min(c, chs - 1)) * bytes
        out[c][i] = fmt === 3 ? v.getFloat32(o, true) : v.getInt16(o, true) / 32768
      }
      return out
    }
    p += 8 + size + (size & 1)
  }
  throw new Error(`${path}: data 없음`)
}

/** 가장 큰 WIN_SEC 구간 */
function loudestWindow(ch: Float32Array[]): Float32Array[] {
  const blk = FS / 2, nb = Math.floor(ch[0].length / blk), w = WIN_SEC * 2
  if (nb <= w) return ch
  const e = new Float64Array(nb)
  for (let k = 0; k < nb; k++) for (let i = k * blk; i < (k + 1) * blk; i++) e[k] += ch[0][i] * ch[0][i] + ch[1][i] * ch[1][i]
  let best = 0, bi = 0, s = 0
  for (let k = 0; k < nb; k++) { s += e[k]; if (k >= w) s -= e[k - w]; if (k >= w - 1 && s > best) { best = s; bi = k - w + 1 } }
  return ch.map(c => c.slice(bi * blk, (bi + w) * blk))
}

function filtered(ch: Float32Array[], stages: Parameters<Biquad['set']>[0][]): Float32Array[] {
  return ch.map(x => {
    const bq = stages.map(s => { const b = new Biquad(); b.set(s); return b })
    const y = new Float32Array(x.length)
    for (let i = 0; i < x.length; i++) { let t = x[i]; for (const b of bq) t = b.l(t); y[i] = t }
    return y
  })
}

/** 합성 3종: 밝은(고역 +8) / 어두운(저역 +6·고역 -10) / 다이내믹 큰(조용한 구간 -18dB 와 큰 구간 교대) */
function synthetic(): Source[] {
  // 핑크 노이즈 생성기는 1Hz 근처까지 저역이 계속 올라가 실제 곡에 없는 초저역(<20Hz)을 품는다.
  // 그대로 두면 체인의 25Hz 하이패스가 피크를 2~3dB 깎아 「PLR 감소」로 잘못 잡히므로, 실제 믹스처럼 20Hz 아래를 먼저 걷어 낸다.
  const s = filtered(makeSignal(10, 21).map(c => c.slice(0, Math.round(Math.min(8.4, WIN_SEC) * FS))), [designPass('hp', 20, 0.7071, FS), designPass('hp', 20, 0.7071, FS)])
  const bright = filtered(s, [designShelf('high', 4000, 8, 0.7071, FS)])
  const dark = filtered(s, [designShelf('low', 150, 6, 0.7071, FS), designShelf('high', 2500, -10, 0.7071, FS), designPass('lp', 9000, 0.7071, FS)])
  const dyn = s.map(c => c.map((v, i) => v * (Math.floor(i / FS) % 3 === 2 ? 1 : dbToLin(-18))))
  return [{ name: '합성-밝은', ch: bright }, { name: '합성-어두운', ch: dark }, { name: '합성-다이내믹', ch: dyn }]
}

function loadSources(): { real: boolean; list: Source[] } {
  const dir = SAMPLE_DIRS[0]
  if (!dir) return { real: false, list: synthetic() }
  const man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { id: string; title: string; bucket: string; file: string }[]
  const list = man.filter(m => existsSync(join(dir, m.file))).map(m => ({ name: `${m.bucket}:${m.title}`, ch: loudestWindow(readWav(join(dir, m.file))) }))
  return list.length ? { real: true, list: [...list, synthetic()[2]] } : { real: false, list: synthetic() }
}

interface Row { src: string; axis: string; id: string; lufsErr: number; lowered: number; tp: number; tpMax: number; peak: number; plrLoss: number; plrMax: number; ok: boolean }
const rows: Row[] = []
const { real, list: SOURCES } = loadSources()
const KIND = real ? `실제 곡 ${SOURCES.length - 1}곡+합성-다이내믹` : '합성 신호 3종(샘플 없음)'

async function check(src: Source, axis: string, id: string, tpl: MasterTemplate): Promise<Row> {
  const r = await masterToTarget(src.ch, FS, src.a!, tpl)
  const tpMax = tpl.tp
  // 샘플 피크 ≤ 트루피크 이므로 트루피크 < 0 이면 클리핑 0
  const peak = r.truePeak
  const plrMax = plrLossOf(tpl)
  const lufsErr = r.integrated - r.targetLufs
  const ok = Math.abs(lufsErr) <= 0.5 && r.truePeak <= tpMax && peak < 0 && r.plrLoss <= plrMax
  const row = { src: src.name, axis, id, lufsErr, lowered: tpl.lufs - r.targetLufs, tp: r.truePeak, tpMax, peak, plrLoss: r.plrLoss, plrMax, ok }
  rows.push(row)
  return row
}
const fmt = (x: Row) => `${x.src} | ${x.axis} | ${x.id} | ${x.lufsErr >= 0 ? '+' : ''}${x.lufsErr.toFixed(2)} | ${x.lowered ? `-${x.lowered.toFixed(1)}` : '0'} | ${x.tp.toFixed(2)} / ${x.tpMax} | ${x.plrLoss.toFixed(1)} / ${x.plrMax} | ${x.ok ? '통과' : '실패'}`

beforeAll(async () => {
  for (const s of SOURCES) s.a = await analyzeAudio(s.ch, FS, { spectrogramCols: 8 })
  for (const s of SOURCES) console.log(`[quality] ${s.name}: LUFS ${s.a!.integrated.toFixed(1)}, TP ${s.a!.truePeak.toFixed(1)}, PLR ${s.a!.plr.toFixed(1)}, 크레스트 ${s.a!.crest.toFixed(1)}`)
}, 120000)

afterAll(() => {
  const out = process.env.MASTERING_QUALITY_OUT
  const body = ['곡 | 축 | 항목 | LUFS 오차 | 목표 하향 | TP / 천장 | PLR 감소 / 허용 | 결과', ...rows.map(fmt)].join('\n')
  if (out) writeFileSync(out, body)
  const bad = rows.filter(r => !r.ok)
  console.log(`[quality] ${KIND}: ${rows.length}건 중 실패 ${bad.length}, 목표 하향 ${rows.filter(r => r.lowered > 0).length}건`)
})

function runAxis(axis: string, items: { id: string; tpl: MasterTemplate }[]) {
  it(`${KIND} × ${axis} ${items.length}개: LUFS ±0.5 · TP ≤ 천장 · 클리핑 0 · PLR 감소 ≤ 허용치`, async () => {
    const bad: string[] = []
    for (const s of SOURCES) for (const { id, tpl } of items) {
      const r = await check(s, axis, id, tpl)
      if (!r.ok) bad.push(fmt(r))
    }
    bad.forEach(b => console.log(`[quality] 실패 ${b}`))
    expect(bad).toEqual([])
  }, 300000)
}

describe(`템플릿 품질 (${KIND}, 곡마다 가장 큰 ${WIN_SEC}초)`, () => {
  runAxis('템플릿', TEMPLATES.map(t => ({ id: t.id, tpl: t })))
  runAxis('스타일×캐릭터', SIMPLE_STYLES.flatMap(st => CHARS.map(c => ({
    id: `${st.id}/${c}`,
    tpl: composeChoice({ use: TARGET_USE.stream, genre: st.genre, texture: c === 'none' ? st.texture : c }),
  }))))
  // 납품처 8(destinations.ts) × 캐릭터 4 — 장르는 스타일 카드를 돌려 가며 섞는다.
  // 납품처의 목표 LUFS·천장이 용도 템플릿 값을 덮고, 배경음악 모드면 PLR 허용 3dB
  runAxis('납품처×캐릭터', DESTINATIONS.flatMap((d, di) => CHARS.map((c, ci) => {
    const st = SIMPLE_STYLES[(di + ci) % SIMPLE_STYLES.length]
    const base = composeChoice({ use: d.useId, genre: st.genre, texture: c === 'none' ? st.texture : c })
    const tpl: MasterTemplate = {
      ...base, lufs: d.lufs, tp: d.tp, plrLoss: d.bgmMode ? Math.min(3, plrLossOf(base)) : base.plrLoss,
      build: () => { const p = base.build(); p.limiter.ceiling = d.tp; return p },
    }
    return { id: `${d.id}/${c}(${st.id})`, tpl }
  })))
})
