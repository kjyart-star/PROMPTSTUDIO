// @vitest-environment jsdom
/**
 * 화면 컨트롤 → 체인 값 → 내보내기(오프라인 렌더) 수치가 이어지는지.
 * 노브(ParamCell)는 setPath 로 체인을 바꾸고, 용도 드롭다운은 pickTarget 을 부른다 — 그 둘이 렌더 결과에 그대로 나타나야 한다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderChain } from '@/lib/mastering/render'
import { defaultChain } from '@/lib/mastering/presets'
import { useMastering } from './store'
import { useUi } from './actions'
import { setPath } from './paramSchema'
import { pickTarget } from './Shell'
import { destById } from './destination'

const FS = 48000
function sine(db: number, seconds = 1): Float32Array[] {
  const n = Math.round(FS * seconds), a = Math.pow(10, db / 20)
  const L = new Float32Array(n)
  for (let i = 0; i < n; i++) L[i] = a * Math.sin((2 * Math.PI * 440 * i) / FS)
  return [L, L.slice()]
}

beforeEach(() => {
  useMastering.setState({ params: defaultChain(), templateId: null, activeId: null, tracks: [], past: [], future: [] })
  useUi.setState({ exportOpts: { format: 'wav', bits: 24, rate: 48000, dither: 'tpdf', range: 'all' }, exportManual: false })
})

describe('컨트롤 → 체인 → 오프라인 렌더', () => {
  it('노브 경로(setPath)로 올린 리미터 게인 +6 dB 가 렌더 트루 피크에 +6 dB 로 나타난다', async () => {
    const src = sine(-24)
    const g0 = useMastering.getState().params.limiter.gain
    const base = await renderChain(src, FS, useMastering.getState().params)
    useMastering.getState().setParams(p => setPath(p, 'limiter.gain', g0 + 6), 'slot:limiter')
    expect(useMastering.getState().params.limiter.gain).toBe(g0 + 6)
    const up = await renderChain(src, FS, useMastering.getState().params)
    expect(Number.isFinite(base.truePeak) && Number.isFinite(up.truePeak)).toBe(true)
    expect(up.truePeak - base.truePeak).toBeCloseTo(6, 0)
    expect(up.integrated - base.integrated).toBeCloseTo(6, 0)
  })

  it('노브 경로로 내린 천장(-3 dB)보다 렌더 트루 피크가 높지 않다', async () => {
    const src = sine(-3)
    useMastering.getState().setParams(p => setPath(setPath(p, 'limiter.ceiling', -3), 'limiter.gain', 12), 'slot:limiter')
    const r = await renderChain(src, FS, useMastering.getState().params)
    expect(r.truePeak).toBeLessThanOrEqual(-3 + 0.3)
    expect(r.truePeak).toBeGreaterThan(-6)
  })

  it('용도 드롭다운(pickTarget) → 목표 음량·천장·파일 설정이 그 납품처 값으로 바뀐다', () => {
    pickTarget('stream')
    const d = destById('stream')!
    const s = useMastering.getState()
    expect(s.target).toMatchObject({ id: 'stream', lufs: d.lufs, tp: d.tp })
    expect(s.params.limiter.ceiling).toBe(d.tp)
    expect(s.params.limiter.truePeak).toBe(true)
    expect(useUi.getState().exportOpts).toEqual(d.opts)
  })
})
