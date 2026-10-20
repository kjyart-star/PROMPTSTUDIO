// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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

const stem = (id: string, title: string): Stem => ({ id, title, blob: new Blob(), gain: 0, pan: 0, mute: false, solo: false, eq: { low: 2, mid: 0, high: 0 } })

function seed(stems: Stem[]) {
  const t = { ...newTrack({ title: '곡', source: 'file', blob: new Blob() }), stems }
  useMastering.setState({ tracks: [t], activeId: t.id, past: [], future: [] })
  return t
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})
afterEach(() => { cleanup(); useMastering.setState({ tracks: [], activeId: null }) })

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

  it('스템이 없으면 안내 카드와 「스템 파일 추가」 버튼', () => {
    seed([])
    const { container } = render(<MixerView />)
    expect(screen.getByText(/스템\(보컬·드럼·베이스·반주처럼 나뉜 파일\)을 넣으면 채널이 생겨요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /스템 파일 추가/ })).toBeTruthy()
    expect(container.querySelectorAll('[data-strip="stem"]').length).toBe(0)
    expect(container.querySelectorAll('[data-strip="master"]').length).toBe(1)
  })
})
