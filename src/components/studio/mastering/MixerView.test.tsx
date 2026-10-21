// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const fakeEngine = {
  meters: null, paused: true, stemMode: false,
  stemLevels: () => [], updateStems: () => {}, leaveStems: () => {}, on: () => () => {},
}
vi.mock('./actions', async orig => ({
  ...(await orig<typeof import('./actions')>()),
  getEngine: () => fakeEngine,
  enterStems: async () => {},
  addStemFiles: () => {},
}))

import { MixerView } from './MixerView'
import { useMastering, newTrack, type Stem } from './store'
import { MODULE_LABEL } from './labels'

const stem = (id: string, title: string): Stem => ({ id, title, blob: new Blob(), gain: 0, pan: 0, mute: false, solo: false, eq: { low: 2, mid: 0, high: 0 } })

function seed(stems: Stem[]) {
  const t = { ...newTrack({ title: '곡', source: 'file', blob: new Blob() }), stems }
  useMastering.setState({ tracks: [t], activeId: t.id, past: [], future: [] })
  return t
}

// 캔버스 그리기 문맥 — 모듈 패널(EQ 그래프 등)이 바로 열리므로 아무것도 안 그리는 가짜 문맥을 준다
const ctxStub = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: () => true,
})
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as HTMLCanvasElement['getContext']
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useMastering.setState({ tracks: [], activeId: null }) })

describe('MixerView', () => {
  it('스템 2개 → 스트립 3개(스템 2 + 마스터), 가로 스크롤 없음', () => {
    seed([stem('a', '보컬'), stem('b', '드럼')])
    const { container } = render(<MixerView />)
    expect(container.querySelectorAll('[data-strip="stem"]').length).toBe(2)
    expect(container.querySelectorAll('[data-strip="master"]').length).toBe(1)
    expect(container.querySelector('.overflow-x-auto, .overflow-x-scroll, .overflow-auto')).toBeNull()
  })

  it('[M] 누르면 스템 mute 토글', () => {
    const t = seed([stem('a', '보컬'), stem('b', '드럼')])
    render(<MixerView />)
    const m = screen.getByRole('button', { name: '보컬 음소거' })
    expect(m.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(m)
    const s = useMastering.getState().tracks.find(x => x.id === t.id)!.stems[0]
    expect(s.mute).toBe(true)
    expect(screen.getByRole('button', { name: '보컬 음소거' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('스템 「저음」 슬롯 → 아래 패널 제목에 스템 이름과 저음', () => {
    seed([stem('a', '보컬'), stem('b', '드럼')])
    render(<MixerView />)
    fireEvent.click(screen.getAllByRole('button', { name: /^저음/ })[0])
    const h = screen.getByRole('heading', { level: 3 })
    expect(h.textContent).toContain('보컬')
    expect(h.textContent).toContain('저음')
  })

  it('마스터 슬롯 → 패널 제목에 마스터, 떠 있는 창 없음', () => {
    seed([stem('a', '보컬')])
    const { container } = render(<MixerView />)
    const master = container.querySelector('[data-strip="master"]')!
    fireEvent.click(master.querySelector('.ms-slot')!)
    const h = screen.getByRole('heading', { level: 3 })
    expect(h.textContent).toContain('마스터')
    expect(document.querySelector('.ms-win')).toBeNull()
  })

  it('스템이 없으면 작은 안내 카드 + 마스터 모듈 패널이 바로 열려 있고, 마스터 스트립은 두 열(wide)', () => {
    seed([])
    const { container } = render(<MixerView />)
    expect(container.querySelector('.ms-mixer.nostems')).toBeTruthy()
    expect(screen.getByText(/스템\(보컬·드럼·베이스·반주처럼 나뉜 파일\)을 넣으면 채널이 생겨요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /스템 파일 추가/ })).toBeTruthy()
    expect(container.querySelectorAll('[data-strip="stem"]').length).toBe(0)
    const master = container.querySelector('[data-strip="master"]')!
    expect(master.className).toContain('wide')
    // 빈 영역 대신 모듈 패널 — 켜진 첫 모듈이 열려 있고, 다른 슬롯을 누르면 바뀐다
    const panel = screen.getByRole('region', { name: '모듈 패널' })
    const p = useMastering.getState().params
    const first = p.order.find(s => !p.bypass[s])!
    expect(within(panel).getByRole('heading', { level: 3 }).textContent).toContain(MODULE_LABEL[first])
    fireEvent.click(within(master as HTMLElement).getByRole('button', { name: /^음량 상한\(리미터\)/ }))
    expect(within(screen.getByRole('region', { name: '모듈 패널' })).getByRole('heading', { level: 3 }).textContent).toBe('마스터 · 음량 상한(리미터)')
    // 닫으면 한 줄 안내만
    fireEvent.click(screen.getByRole('button', { name: '패널 닫기' }))
    expect(screen.queryByRole('region', { name: '모듈 패널' })).toBeNull()
    expect(container.querySelector('.ms-mixdock.empty')).toBeTruthy()
  })

  it('마스터 모듈 노브를 돌리면 체인 값이 바뀐다(믹서 패널 → 실제 체인)', () => {
    seed([])
    const { container } = render(<MixerView />)
    const master = container.querySelector('[data-strip="master"]')!
    fireEvent.click(within(master as HTMLElement).getByRole('button', { name: /^음량 상한\(리미터\)/ }))
    const before = useMastering.getState().params.limiter.ceiling
    const knob = within(screen.getByRole('region', { name: '모듈 패널' })).getByRole('slider', { name: '천장' })
    fireEvent.keyDown(knob, { key: 'ArrowDown' })
    expect(useMastering.getState().params.limiter.ceiling).toBeCloseTo(before - 0.1, 5)
  })
})
