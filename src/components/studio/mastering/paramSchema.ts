/**
 * 플러그인 창의 「이름 · 슬라이더 · 값」 표 정의. 경로 문자열(예: 'eq.lf.gain')로 체인 값을 읽고 쓴다.
 */
import type { ChainParams, SlotId } from '@/lib/mastering/dsp'
import type { Scale } from './controls'

export type Row =
  | { kind: 'num'; label: string; path: string; min: number; max: number; def: number; step?: number; unit?: string; scale?: Scale; fmt?: (v: number) => string; help?: string }
  | { kind: 'bool'; label: string; path: string; on?: string; off?: string; help?: string }
  | { kind: 'select'; label: string; path: string; options: { value: string | number; label: string }[]; help?: string }
  | { kind: 'section'; label: string }

export function getPath(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o)
}

export function setPath<T>(o: T, path: string, v: unknown): T {
  const [k, ...rest] = path.split('.')
  if (Array.isArray(o)) {
    const i = Number(k)
    const arr = [...o]
    arr[i] = rest.length ? setPath(arr[i], rest.join('.'), v) : v
    return arr as T
  }
  const obj = o as Record<string, unknown>
  return { ...obj, [k]: rest.length ? setPath(obj[k], rest.join('.'), v) : v } as T
}

const n = (label: string, path: string, min: number, max: number, def: number, o: Partial<Extract<Row, { kind: 'num' }>> = {}): Row => ({ kind: 'num', label, path, min, max, def, ...o })
const b = (label: string, path: string, on = '켬', off = '끔'): Row => ({ kind: 'bool', label, path, on, off })
const sel = (label: string, path: string, options: { value: string | number; label: string }[]): Row => ({ kind: 'select', label, path, options })
const sec = (label: string): Row => ({ kind: 'section', label })
const hz = { step: 1, unit: 'Hz', scale: 'log' as const }
const ms = (min: number, max: number) => ({ step: max > 100 ? 1 : 0.1, unit: 'ms', scale: 'log' as const, min, max })
const ratio = { step: 0.1, scale: 'log' as const, fmt: (v: number) => `${v.toFixed(1)}:1` }
const slopes = [12, 24, 36, 48].map(v => ({ value: v, label: `${v} dB/oct` }))

function eqBand(name: string, key: string, def: { freq: number; q: number }, shelf = false): Row[] {
  return [
    b(`${name}`, `eq.${key}.on`),
    n(`${name} 주파수`, `eq.${key}.freq`, 20, 20000, def.freq, hz),
    n(`${name} 게인`, `eq.${key}.gain`, -18, 18, 0, { unit: 'dB' }),
    n(`${name} Q`, `eq.${key}.q`, 0.1, 10, def.q, { step: 0.01, scale: 'log' }),
    ...(shelf ? [sel(`${name} 모양`, `eq.${key}.shape`, [{ value: 'shelf', label: '셸프' }, { value: 'bell', label: '벨' }])] : []),
  ]
}

function msSet(side: 'mid' | 'side', name: string): Row[] {
  const p = `mseq.${side}`
  return [
    sec(name),
    n('저역 셸프', `${p}.low.gain`, -12, 12, 0, { unit: 'dB' }), n('저역 주파수', `${p}.low.freq`, 30, 500, 120, hz),
    n('벨 1', `${p}.b1.gain`, -12, 12, 0, { unit: 'dB' }), n('벨 1 주파수', `${p}.b1.freq`, 100, 5000, 400, hz), n('벨 1 Q', `${p}.b1.q`, 0.3, 6, 1, { step: 0.01, scale: 'log' }),
    n('벨 2', `${p}.b2.gain`, -12, 12, 0, { unit: 'dB' }), n('벨 2 주파수', `${p}.b2.freq`, 500, 16000, 3000, hz), n('벨 2 Q', `${p}.b2.q`, 0.3, 6, 1, { step: 0.01, scale: 'log' }),
    n('고역 셸프', `${p}.high.gain`, -12, 12, 0, { unit: 'dB' }), n('고역 주파수', `${p}.high.freq`, 2000, 18000, 10000, hz),
  ]
}

export const SCHEMA: Record<SlotId, Row[]> = {
  eq: [
    sel('처리 방식', 'eq.mode', [{ value: 'min', label: '최소 위상' }, { value: 'linear', label: '리니어 페이즈' }]),
    n('입력', 'eq.input', -18, 18, 0, { unit: 'dB' }),
    b('HPF', 'eq.hpf.on'), n('HPF 주파수', 'eq.hpf.freq', 20, 1000, 25, hz), sel('HPF 기울기', 'eq.hpf.slope', slopes),
    ...eqBand('LF', 'lf', { freq: 80, q: 0.7 }, true),
    ...eqBand('LMF', 'lmf', { freq: 250, q: 1 }),
    ...eqBand('MF', 'mf', { freq: 1000, q: 1 }),
    ...eqBand('HMF', 'hmf', { freq: 3500, q: 1 }),
    ...eqBand('HF', 'hf', { freq: 10000, q: 0.7 }, true),
    b('LPF', 'eq.lpf.on'), n('LPF 주파수', 'eq.lpf.freq', 1000, 20000, 20000, hz), sel('LPF 기울기', 'eq.lpf.slope', slopes),
    n('거친 고역 다듬기', 'eq.deharsh', 0, 100, 0, { step: 1, unit: '%' }),
    n('출력', 'eq.output', -18, 18, 0, { unit: 'dB' }),
  ],
  comp: [
    n('스레숄드', 'comp.threshold', -60, 0, -18, { unit: 'dB' }),
    n('레이쇼', 'comp.ratio', 1, 20, 2, ratio),
    n('어택', 'comp.attack', 0.1, 200, 20, ms(0.1, 200)),
    n('릴리스', 'comp.release', 10, 2000, 200, ms(10, 2000)),
    n('니', 'comp.knee', 0, 24, 6, { unit: 'dB' }),
    n('메이크업', 'comp.makeup', -12, 24, 0, { unit: 'dB' }),
    b('자동 메이크업', 'comp.autoMakeup'),
    n('믹스', 'comp.mix', 0, 100, 100, { step: 1, unit: '%' }),
  ],
  multiband: [
    n('저/중 경계', 'multiband.lowX', 40, 1000, 120, hz),
    n('중/고 경계', 'multiband.highX', 500, 16000, 4000, hz),
    ...(['저역', '중역', '고역'] as const).flatMap((nm, i) => [
      sec(nm),
      b('켬', `multiband.bands.${i}.on`), b('솔로', `multiband.bands.${i}.solo`),
      n('스레숄드', `multiband.bands.${i}.threshold`, -60, 0, -20, { unit: 'dB' }),
      n('레이쇼', `multiband.bands.${i}.ratio`, 1, 10, 2, ratio),
      n('어택', `multiband.bands.${i}.attack`, 0.1, 200, 20, ms(0.1, 200)),
      n('릴리스', `multiband.bands.${i}.release`, 10, 2000, 200, ms(10, 2000)),
      n('게인', `multiband.bands.${i}.gain`, -12, 12, 0, { unit: 'dB' }),
    ]),
  ],
  stereo: [
    n('스테레오 폭', 'stereo.width', 0, 200, 100, { step: 1, unit: '%' }),
    n('미드', 'stereo.mid', -12, 12, 0, { unit: 'dB' }),
    n('사이드', 'stereo.side', -12, 12, 0, { unit: 'dB' }),
    n('저역 모노', 'stereo.bassMono', 0, 300, 0, { step: 1, unit: 'Hz', fmt: v => (v < 20 ? '끔' : `${Math.round(v)} Hz`) }),
  ],
  saturation: [
    sel('종류', 'saturation.mode', [
      { value: 'tape', label: '테이프' }, { value: 'tapeWarm', label: '테이프(따뜻)' }, { value: 'tube', label: '진공관' },
      { value: 'triode', label: '3극관' }, { value: 'transformer', label: '트랜스포머' }, { value: 'clip', label: '소프트 클립' },
    ]),
    n('드라이브', 'saturation.drive', 0, 24, 3, { unit: 'dB' }),
    n('믹스', 'saturation.mix', 0, 100, 50, { step: 1, unit: '%' }),
    n('출력', 'saturation.output', -12, 12, 0, { unit: 'dB' }),
  ],
  limiter: [
    n('게인', 'limiter.gain', -30, 24, 0, { unit: 'dB' }),
    n('천장', 'limiter.ceiling', -6, 0, -1, { unit: 'dB' }),
    n('릴리스', 'limiter.release', 1, 1000, 80, ms(1, 1000)),
    b('트루 피크', 'limiter.truePeak'),
  ],
  gate: [
    n('스레숄드', 'gate.threshold', -90, -10, -60, { unit: 'dB' }),
    n('레이쇼', 'gate.ratio', 1, 20, 2, { step: 0.1, scale: 'log', fmt: v => `1:${v.toFixed(1)}` }),
    n('최대 감쇠', 'gate.range', 0, 80, 20, { unit: 'dB' }),
    n('어택', 'gate.attack', 0.1, 50, 1, ms(0.1, 50)),
    n('홀드', 'gate.hold', 0, 500, 50, { step: 1, unit: 'ms' }),
    n('릴리스', 'gate.release', 5, 2000, 200, ms(5, 2000)),
  ],
  mseq: [...msSet('mid', '미드 (가운데)'), ...msSet('side', '사이드 (양옆)')],
  dyneq: [0, 1, 2, 3].flatMap(i => [
    sec(`밴드 ${i + 1}`),
    b('켬', `dyneq.bands.${i}.on`),
    sel('동작', `dyneq.bands.${i}.mode`, [{ value: 'cut', label: '넘으면 깎기' }, { value: 'boost', label: '넘으면 올리기' }]),
    n('주파수', `dyneq.bands.${i}.freq`, 20, 20000, 1000, hz),
    n('Q', `dyneq.bands.${i}.q`, 0.3, 8, 1.2, { step: 0.01, scale: 'log' }),
    n('스레숄드', `dyneq.bands.${i}.threshold`, -60, 0, -24, { unit: 'dB' }),
    n('레이쇼', `dyneq.bands.${i}.ratio`, 1, 10, 3, ratio),
    n('최대 변화', `dyneq.bands.${i}.range`, 0, 12, 4, { unit: 'dB' }),
    n('고정 게인', `dyneq.bands.${i}.gain`, -12, 12, 0, { unit: 'dB' }),
    n('어택', `dyneq.bands.${i}.attack`, 0.1, 100, 10, ms(0.1, 100)),
    n('릴리스', `dyneq.bands.${i}.release`, 10, 1000, 120, ms(10, 1000)),
  ]),
  deesser: [
    n('주파수', 'deesser.freq', 2000, 14000, 6500, hz),
    n('스레숄드', 'deesser.threshold', -60, 0, -28, { unit: 'dB' }),
    n('최대 감쇠', 'deesser.range', 0, 18, 6, { unit: 'dB' }),
    b('감지 소리 듣기', 'deesser.listen'),
  ],
  match: [n('강도', 'match.strength', 0, 100, 70, { step: 1, unit: '%' })],
  transient: [
    n('어택', 'transient.attack', -100, 100, 0, { step: 1, unit: '%' }),
    n('서스테인', 'transient.sustain', -100, 100, 0, { step: 1, unit: '%' }),
    n('출력', 'transient.output', -12, 12, 0, { unit: 'dB' }),
  ],
  imager: [
    n('저/중 경계', 'imager.lowX', 40, 1000, 150, hz),
    n('중/고 경계', 'imager.highX', 500, 16000, 4000, hz),
    n('저역 폭', 'imager.widths.0', 0, 200, 100, { step: 1, unit: '%' }),
    n('중역 폭', 'imager.widths.1', 0, 200, 100, { step: 1, unit: '%' }),
    n('고역 폭', 'imager.widths.2', 0, 200, 100, { step: 1, unit: '%' }),
  ],
  clipper: [
    n('스레숄드', 'clipper.threshold', -12, 0, -0.5, { unit: 'dB' }),
    n('부드럽게', 'clipper.softness', 0, 100, 40, { step: 1, unit: '%' }),
    n('출력', 'clipper.output', -6, 6, 0, { unit: 'dB' }),
  ],
}

/** 값 이름(경로 끝) → 쉬운 한 줄 설명. 화면에서 title 툴팁으로 보여 준다 */
const HELP: Record<string, string> = {
  threshold: '이 높이를 넘는 소리부터 처리해요 — 낮출수록 더 많이 걸려요',
  ratio: '넘친 소리를 얼마나 누를지 — 2는 살짝, 8 이상은 아주 세게',
  attack: '소리가 넘친 뒤 얼마나 빨리 누를지 — 느리면 타격감이 살아요',
  release: '누른 뒤 얼마나 빨리 놓을지 — 너무 빠르면 출렁거려요',
  knee: '누르기 시작하는 부분을 얼마나 부드럽게 할지',
  makeup: '눌러서 작아진 만큼 다시 키우는 양',
  autoMakeup: '눌러서 작아진 만큼 알아서 다시 키워요',
  mix: '처리한 소리와 원래 소리를 섞는 비율 — 100%면 처리한 소리만',
  gain: '이 부분의 소리를 키우거나 줄이는 양',
  ceiling: '소리가 절대 넘지 못하는 천장 — -1 dB 이 안전해요',
  truePeak: '변환 뒤 생기는 숨은 피크까지 막아요 — 켜 두는 걸 권해요',
  width: '소리가 양옆으로 퍼지는 정도 — 100%가 원래 그대로',
  widths: '이 대역이 양옆으로 퍼지는 정도 — 100%가 원래 그대로',
  bassMono: '이 주파수 아래 저음을 가운데로 모아 스피커에서 안정적으로',
  mid: '가운데(보컬·킥) 소리 크기', side: '양옆(공간·반주) 소리 크기',
  drive: '색감을 얼마나 진하게 입힐지 — 높으면 거칠어져요',
  mode: '처리하는 방식',
  q: '다듬는 범위의 폭 — 클수록 좁고 날카롭게',
  freq: '다듬을 소리의 높이(주파수)',
  lowX: '저역과 중역을 나누는 높이', highX: '중역과 고역을 나누는 높이',
  input: '이 단계로 들어가는 소리 크기', output: '이 단계에서 나가는 소리 크기',
  range: '최대로 줄이거나 바꿀 수 있는 양', hold: '닫히기 전에 기다리는 시간',
  strength: '레퍼런스 톤을 얼마나 따라갈지', deharsh: '귀를 찌르는 고음만 골라 부드럽게',
  softness: '깎는 모서리를 얼마나 둥글게 할지', sustain: '소리의 꼬리(울림) 길이',
  on: '이 부분을 켜거나 꺼요', solo: '이 대역만 따로 들어요', slope: '자르는 경사 — 클수록 가파르게',
  listen: '치찰음으로 감지된 소리만 들어 봐요',
}
for (const rows of Object.values(SCHEMA)) {
  for (const r of rows) {
    if (r.kind === 'section' || r.help) continue
    const segs = r.path.split('.')
    const key = segs[segs.length - 1]
    r.help = HELP[key] ?? (/^\d+$/.test(key) ? HELP[segs[segs.length - 2]] : undefined)
  }
}

/** 모듈 패널의 열 — EQ 는 밴드별(섹션 행이 없어 경로로 나눈다) */
export const EQ_COLUMNS: { label: string; match: (path: string) => boolean }[] = [
  ...(['HPF', 'LF', 'LMF', 'MF', 'HMF', 'HF', 'LPF'] as const).map(label => ({ label, match: (p: string) => p.startsWith(`eq.${label.toLowerCase()}.`) })),
  { label: '공통', match: (p: string) => ['eq.mode', 'eq.input', 'eq.output', 'eq.deharsh'].includes(p) },
]

export type ParamRow = Exclude<Row, { kind: 'section' }>
export interface ParamColumn { label: string; rows: ParamRow[] }

/** 슬롯의 파라미터를 열로 나눈다 — 섹션 행이 열 머리, 첫 섹션 앞의 행은 맨 뒤 「공통」 열. 섹션이 없으면 이름 없는 열 하나 */
export function paramColumns(slot: SlotId): ParamColumn[] {
  const rows = SCHEMA[slot]
  if (slot === 'eq') {
    const all = rows.filter((r): r is ParamRow => r.kind !== 'section')
    return EQ_COLUMNS.map(c => ({ label: c.label, rows: all.filter(r => c.match(r.path)) }))
  }
  const common: ParamRow[] = []
  const cols: ParamColumn[] = []
  for (const r of rows) {
    if (r.kind === 'section') cols.push({ label: r.label, rows: [] })
    else if (cols.length) cols[cols.length - 1].rows.push(r)
    else common.push(r)
  }
  if (!cols.length) return [{ label: '', rows: common }]
  return common.length ? [...cols, { label: '공통', rows: common }] : cols
}

/** 슬롯마다 기본값(프리셋 「기본값」으로 되돌리기용) */
export function resetSlot(p: ChainParams, slot: SlotId, d: ChainParams): ChainParams {
  return { ...p, [slot]: structuredClone((d as unknown as Record<string, unknown>)[slot]) } as ChainParams
}
