// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react'
import { defaultChain } from '@/lib/mastering/presets'

const fakeEngine = vi.hoisted(() => ({
  meters: null, paused: true, playingAnything: false, listenRef: false, stemMode: false, error: null,
  currentTime: 0, duration: 0, ctx: null, refAudio: { currentTime: 0 },
  postAnalyser: null, preAnalyser: null, anL: null, anR: null,
  on: () => () => {},
  seek: () => {}, play: async () => {}, pause: () => {}, setParams: () => {}, setEdit: () => {},
  setMonitor: (() => {}) as (db: number, muted: boolean, mono?: boolean) => void,
  setRefTrim: () => {}, resetMeters: () => {}, setListenRef: async () => {}, load: () => {}, loadReference: () => {},
  updateStems: () => {}, leaveStems: () => {},
}))

vi.mock('./actions', async importOriginal => {
  const orig = await importOriginal<typeof import('./actions')>()
  return { ...orig, getEngine: () => fakeEngine }
})

import { MasteringClient } from '../MasteringClient'
import { useMastering, newTrack } from './store'
import { useUi } from './actions'
import { useStyleSel } from './StylePanel'
import { useDock, CHAIN_LIST_MAX_H } from './ChainList'
import { METER_COL_MAX_H } from './Meters'

const ctxStub = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: () => true,
})

let mem: Record<string, string> = {}
beforeEach(() => {
  mem = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v) }, removeItem: (k: string) => { delete mem[k] }, clear: () => { mem = {} } })
  HTMLCanvasElement.prototype.getContext = (() => ctxStub) as unknown as HTMLCanvasElement['getContext']
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  useMastering.setState({
    params: defaultChain(), tracks: [], activeId: null, templateId: null, reference: null, srcAnalysis: {}, outAnalysis: {},
    past: [], future: [], lastKey: '', lastPush: 0, target: { id: 'album', label: '음반 (CD · 디지털 앨범)', lufs: -9, tp: -0.3 },
  })
  useUi.setState({ busy: null, notice: null, templateParams: null, exportManual: false, reports: [], preview: null, loop: null, loopOn: false })
  useStyleSel.setState({ pick: { kind: 'auto' }, character: null, strength: 70 })
  useDock.setState({ view: null, folded: false })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function seedTrack() {
  const t = newTrack({ title: '테스트 곡', source: 'file', blob: new Blob([new Uint8Array(8)]) })
  useMastering.setState({ tracks: [t], activeId: t.id })
  return t
}
const proToggle = () => screen.getByRole('button', { name: /전문 설정$/ })
const closeTour = () => { const b = screen.queryByRole('button', { name: '둘러보기 닫기' }); if (b) fireEvent.click(b) }

describe('마스터링 화면 — 한 화면 단계적 펼침', () => {
  it('기본은 체인이 접혀 있고, 곡이 있으면 가운데에 「다시 분석해서 맞추기」가 있다', () => {
    seedTrack()
    render(<MasteringClient />)
    expect(screen.queryByTestId('chain-list')).toBeNull()
    expect(screen.getByRole('button', { name: /다시 분석해서 맞추기/ })).toBeTruthy()
    expect(proToggle().getAttribute('aria-pressed')).toBe('false')
  })

  it('곡이 없으면 가운데에 보관함·파일 열기 빈 상태', () => {
    render(<MasteringClient />)
    expect(screen.getByRole('heading', { name: '마스터링할 곡을 열어 주세요' })).toBeTruthy()
  })

  it('전문 설정을 펼치면 모듈 14행, 모듈을 누르면 타임라인 바로 아래(3열 본문 앞) 패널에 열리고 떠 있는 창은 없다', () => {
    const { container } = render(<MasteringClient />)
    fireEvent.click(proToggle())
    closeTour()
    const list = screen.getByTestId('chain-list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(14)
    fireEvent.click(screen.getByRole('button', { name: '압축(컴프레서) 설정 열기' }))
    const panel = screen.getByRole('region', { name: '모듈 패널' })
    expect(within(panel).getByRole('heading', { level: 3 }).textContent).toBe('마스터 · 압축(컴프레서)')
    // DOM 순서: 타임라인 → 패널 → 3열 본문, 가운데는 스타일 패널 그대로
    const timeline = container.querySelector('.ms-timeline')!, body = container.querySelector('.ms-body')!
    expect(timeline.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(body.contains(panel)).toBe(false)
    expect(within(list).getByRole('button', { name: '압축(컴프레서) 설정 열기' }).closest('li')!.className).toContain('sel')
    expect(container.querySelector('.ms-win')).toBeNull()
    expect(localStorage.getItem('cm.mastering.mode.v1')).toBe('"pro"')
    // 접기 → 제목 줄만
    fireEvent.click(within(panel).getByRole('button', { name: /접기/ }))
    expect(within(screen.getByRole('region', { name: '모듈 패널' })).queryByRole('group', { name: '파라미터' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /펼치기$/ }))
    expect(within(screen.getByRole('region', { name: '모듈 패널' })).getByRole('group', { name: '파라미터' })).toBeTruthy()
  })

  it('EQ 패널은 HPF·LF·LMF·MF·HMF·HF·LPF·공통 열로 나뉜다', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    closeTour()
    fireEvent.click(screen.getByRole('button', { name: '다듬기(EQ) 설정 열기' }))
    const panel = screen.getByRole('region', { name: '모듈 패널' })
    const heads = Array.from(panel.querySelectorAll('.ms-pcolhead')).map(e => e.textContent)
    expect(heads).toEqual(['HPF', 'LF', 'LMF', 'MF', 'HMF', 'HF', 'LPF', '공통'])
    expect(within(panel).getByRole('group', { name: 'LF 게인' })).toBeTruthy()
  })

  it('전문 설정 — 미터 열은 최대 높이 안에서, 체인 목록은 목록 안에서 세로로 스크롤한다(가로 아님)', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    closeTour()
    const meters = screen.getByTestId('meter-column')
    expect(meters.classList.contains('ms-meters')).toBe(true)
    expect(meters.style.maxHeight).toBe(`${METER_COL_MAX_H}px`)
    expect(METER_COL_MAX_H).toBeLessThanOrEqual(440)
    expect(meters.style.overflowY).toBe('auto')
    const chain = screen.getByTestId('chain-list')
    expect(chain.style.overflowY).toBe('auto')
    expect(chain.style.overflowX).toBe('hidden')
    expect(chain.style.maxHeight).toBe(`${CHAIN_LIST_MAX_H}px`)
    expect(CHAIN_LIST_MAX_H).toBeLessThanOrEqual(440)
  })

  it('모듈 패널의 「이 모듈은?」을 펼치면 도움말 4항목이 보인다', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    closeTour()
    fireEvent.click(screen.getByRole('button', { name: '다듬기(EQ) 설정 열기' }))
    const q = screen.getByRole('button', { name: '이 모듈은?' })
    expect(q.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(q)
    const dl = screen.getByLabelText('모듈 도움말')
    for (const t of ['무엇을', '언제 쓰나요', '추천 시작값', '흔한 실수']) expect(within(dl).getByText(t)).toBeTruthy()
  })

  it('위험값(천장 0)이면 그 노브에 「추천값」이 생기고 누르면 -1 이 된다', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    closeTour()
    act(() => { useMastering.setState(s => ({ params: { ...s.params, limiter: { ...s.params.limiter, ceiling: 0 } } })) })
    fireEvent.click(screen.getByRole('button', { name: '음량 상한(리미터) 설정 열기' }))
    const cell = screen.getByRole('group', { name: '천장' })
    expect(cell.className).toContain('warn')
    fireEvent.click(within(cell).getByRole('button', { name: '추천값' }))
    expect(useMastering.getState().params.limiter.ceiling).toBe(-1)
    expect(useMastering.getState().lastKey).toBe('recommend')
  })

  it('둘러보기: 첫 펼침에 1단계가 뜨고, 「다시 보지 않기」 뒤엔 다시 펼쳐도 안 뜨며, 「?」로 다시 본다', () => {
    const { unmount } = render(<MasteringClient />)
    fireEvent.click(proToggle())
    const tour = screen.getByRole('dialog', { name: '둘러보기' })
    expect(within(tour).getByText('1 / 5')).toBeTruthy()
    expect(within(tour).getByRole('heading', { name: '트랙' })).toBeTruthy()
    fireEvent.click(within(tour).getByRole('button', { name: '다음' }))
    expect(within(screen.getByRole('dialog', { name: '둘러보기' })).getByText('2 / 5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 보지 않기' }))
    expect(screen.queryByRole('dialog', { name: '둘러보기' })).toBeNull()
    expect(localStorage.getItem('cm.mastering.tour.v1')).toBe('done')
    unmount()
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    expect(screen.queryByRole('dialog', { name: '둘러보기' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '둘러보기' }))
    expect(within(screen.getByRole('dialog', { name: '둘러보기' })).getByText('1 / 5')).toBeTruthy()
  })

  it('LED 를 누르면 그 모듈의 바이패스가 바뀐다', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    const before = useMastering.getState().params.bypass.comp
    fireEvent.click(screen.getByRole('button', { name: before ? '압축(컴프레서) 켜기' : '압축(컴프레서) 끄기' }))
    expect(useMastering.getState().params.bypass.comp).toBe(!before)
  })

  it('도구 「레퍼런스」를 누르면 레퍼런스 패널이 열린다', () => {
    render(<MasteringClient />)
    fireEvent.click(proToggle())
    fireEvent.click(within(screen.getByLabelText('도구')).getByRole('button', { name: '레퍼런스' }))
    const panel = screen.getByRole('region', { name: '도구 패널' })
    expect(within(panel).getAllByText('레퍼런스 톤 맞추기').length).toBeGreaterThan(0)
  })

  it('위험 설정: 천장 0.0 이면 경고가 뜨고 「추천값으로」가 -1 로 고친다', () => {
    render(<MasteringClient />)
    expect(screen.queryByRole('alert', { name: '위험 설정 경고' })).toBeNull()
    act(() => { useMastering.setState(s => ({ params: { ...s.params, limiter: { ...s.params.limiter, ceiling: 0 } } })) })
    const bar = screen.getByRole('alert', { name: '위험 설정 경고' })
    fireEvent.click(within(bar).getByRole('button', { name: '추천값으로' }))
    expect(useMastering.getState().params.limiter.ceiling).toBe(-1)
  })

  it('첫 화면은 음반 납품처가 눌려 있고, 스트리밍을 누르면 목표가 바뀌며 파생본 칩이 보인다', () => {
    render(<MasteringClient />)
    const group = screen.getByRole('group', { name: '어디에 쓸 곡인가요' })
    expect(within(group).getByRole('button', { name: /음반/ }).getAttribute('aria-pressed')).toBe('true')
    const extra = screen.getByRole('group', { name: '함께 내보내기' })
    expect(within(extra).getByRole('button', { name: /^음원 스트리밍/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(extra).getByRole('button', { name: /^동영상 플랫폼/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(group).getByRole('button', { name: /^음원 스트리밍/ }))
    expect(useMastering.getState().target.id).toBe('stream')
    expect(useMastering.getState().target.lufs).toBe(-14)
  })

  it('스타일 카드를 고르면(곡 있음) 템플릿이 적용되고 강도 슬라이더가 보인다', () => {
    seedTrack()
    render(<MasteringClient />)
    act(() => { fireEvent.click(screen.getByRole('button', { name: '록 · 밴드 스타일' })) })
    expect(useMastering.getState().templateId).toMatch(/^style:rock:/)
    expect(useUi.getState().templateParams).not.toBeNull()
    expect(screen.getByRole('slider', { name: '강도' })).toBeTruthy()
  })

  it('목표 음량 노브: 위 화살표로 0.5 LUFS 올린다', () => {
    seedTrack()
    render(<MasteringClient />)
    const knob = screen.getByRole('slider', { name: /목표 음량/ })
    fireEvent.keyDown(knob, { key: 'ArrowUp' })
    expect(useMastering.getState().target.lufs).toBe(-8.5)
    expect(useMastering.getState().target.id).toBe('custom')
  })

  it('캐릭터 「따뜻한 진공관」을 누르면 템플릿이 다시 적용된다', () => {
    seedTrack()
    render(<MasteringClient />)
    fireEvent.click(screen.getByRole('button', { name: '따뜻한 진공관' }))
    expect(useMastering.getState().templateId).toMatch(/tex-warm$/)
  })

  it('「모노로 확인」은 엔진 모니터를 모노로 바꾼다', () => {
    const spy = vi.spyOn(fakeEngine, 'setMonitor')
    seedTrack()
    render(<MasteringClient />)
    fireEvent.click(screen.getByRole('button', { name: '모노로 확인' }))
    expect(spy).toHaveBeenLastCalledWith(0, false, true)
    spy.mockRestore()
  })

  it.each([['"pro"', true], ['"simple"', false], ['"이상한 값"', false], ['{깨진', false]])('저장된 모드 %s 로도 화면이 뜬다', (raw, open) => {
    localStorage.setItem('cm.mastering.mode.v1', raw)
    render(<MasteringClient />)
    expect(screen.getByRole('tablist', { name: '보기' })).toBeTruthy()
    expect(!!screen.queryByTestId('chain-list')).toBe(open)
  })

  it('보기 탭 「마스터링」「믹서」가 있다', () => {
    render(<MasteringClient />)
    const tabs = within(screen.getByRole('tablist', { name: '보기' })).getAllByRole('tab')
    expect(tabs.map(t => t.textContent?.trim())).toEqual(['마스터링', '믹서'])
  })
})
