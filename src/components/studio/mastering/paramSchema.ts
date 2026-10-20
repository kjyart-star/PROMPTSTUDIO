/**
 * 플러그인 창의 「이름 · 슬라이더 · 값」 표 정의. 경로 문자열(예: 'eq.lf.gain')로 체인 값을 읽고 쓴다.
 */
import type { ChainParams, SlotId } from '@/lib/mastering/dsp'
import type { Scale } from './controls'

export type Row =
  | { kind: 'num'; label: string; path: string; min: number; max: number; def: number; step?: number; unit?: string; scale?: Scale; fmt?: (v: number) => string }
  | { kind: 'bool'; label: string; path: string; on?: string; off?: string }
  | { kind: 'select'; label: string; path: string; options: { value: string | number; label: string }[] }
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

/** 슬롯마다 기본값(프리셋 「기본값」으로 되돌리기용) */
export function resetSlot(p: ChainParams, slot: SlotId, d: ChainParams): ChainParams {
  return { ...p, [slot]: structuredClone((d as unknown as Record<string, unknown>)[slot]) } as ChainParams
}
