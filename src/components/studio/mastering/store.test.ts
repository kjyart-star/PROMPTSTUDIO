import { describe, it, expect, beforeEach } from 'vitest'
import { useMastering, newTrack, normalizeChain } from './store'
import { defaultChain } from '@/lib/mastering/presets'

describe('실행 취소 · 다시 실행', () => {
  beforeEach(() => useMastering.setState({ params: defaultChain(), tracks: [], past: [], future: [], lastKey: '', lastPush: 0, activeId: null }))
  it('파라미터 변경을 되돌리고 다시 적용한다', () => {
    const s = useMastering.getState
    s().setParams(p => ({ ...p, comp: { ...p.comp, threshold: -30 } }), 'a')
    useMastering.setState({ lastPush: 0 })
    s().setParams(p => ({ ...p, limiter: { ...p.limiter, gain: 9 } }), 'b')
    expect(s().params.limiter.gain).toBe(9)
    s().undo()
    expect(s().params.limiter.gain).toBe(defaultChain().limiter.gain)
    expect(s().params.comp.threshold).toBe(-30)
    s().undo()
    expect(s().params.comp.threshold).toBe(defaultChain().comp.threshold)
    s().redo(); s().redo()
    expect(s().params.limiter.gain).toBe(9)
  })
  it('같은 노브를 연속으로 돌린 것은 한 번으로 묶인다', () => {
    const s = useMastering.getState
    for (let i = 0; i < 10; i++) s().setParams(p => ({ ...p, comp: { ...p.comp, ratio: 2 + i } }), 'slot:comp')
    expect(s().past.length).toBe(1)
    s().undo()
    expect(s().params.comp.ratio).toBe(defaultChain().comp.ratio)
  })
  it('곡 편집(페이드·마커)도 되돌린다', () => {
    const s = useMastering.getState
    const t = newTrack({ title: 'a', source: 'file', blob: new Blob() })
    s().addTracks([t])
    s().updateTrack(t.id, x => ({ ...x, edit: { ...x.edit, fadeOut: { dur: 3, curve: 'lin' } } }), 'fade')
    expect(s().tracks[0].edit.fadeOut.dur).toBe(3)
    s().undo()
    expect(s().tracks[0].edit.fadeOut.dur).toBe(0)
  })
  it('A/B 전환은 기록하지 않는다', () => {
    const s = useMastering.getState
    s().setParams(p => ({ ...p, listenOriginal: true }))
    expect(s().past.length).toBe(0)
  })
  it('옛 체인(슬롯 6개)을 불러와도 새 슬롯이 채워진다', () => {
    const old = { order: ['eq', 'comp', 'multiband', 'stereo', 'saturation', 'limiter'], bypass: { eq: false }, comp: { threshold: -10 } }
    const c = normalizeChain(old as never)
    expect(c.order.length).toBe(15)
    expect(c.comp.threshold).toBe(-10)
    expect(c.dyneq.bands.length).toBe(4)
  })
  it('고음 정리 칸이 생기기 전(14칸)의 내 순서는 지키고 맨 앞에 고음 정리만 끼운다', () => {
    const mine = ['eq', 'gate', 'mseq', 'dyneq', 'deesser', 'match', 'comp', 'multiband', 'transient', 'imager', 'stereo', 'saturation', 'clipper', 'limiter']
    const c = normalizeChain({ order: mine } as never)
    expect(c.order).toEqual(['aiclean', ...mine])
    expect(c.bypass.aiclean).toBe(true)
    expect(c.aiclean.mode).toBe('natural')
    expect(normalizeChain({ aiclean: { mode: 'strong' } } as never).aiclean.mode).toBe('strong')
  })
})
