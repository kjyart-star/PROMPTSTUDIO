// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { HelpButton } from './HelpPanel'
import { DESTINATIONS } from '@/lib/mastering/destinations'
import { MODULE_LABEL } from './labels'
import { MODULE_HELP, HELP_TABS, moduleRecommend } from './helpContent'
import { defaultChain } from '@/lib/mastering/presets'

afterEach(cleanup)

const open = () => { render(<HelpButton />); fireEvent.click(screen.getByRole('button', { name: /사용 설명서/ })); return screen.getByRole('dialog', { name: '사용 설명서' }) }

describe('사용 설명서 패널', () => {
  it('버튼을 누르면 열리고 목차가 5개다', () => {
    const d = open()
    expect(within(d).getAllByRole('tab')).toHaveLength(5)
    expect(HELP_TABS).toHaveLength(5)
  })
  it('목표 음량 표 행 수가 납품처 수와 같다', () => {
    const d = open()
    fireEvent.click(within(d).getByRole('tab', { name: '목표 음량 표' }))
    expect(d.querySelectorAll('[data-row="dest"]')).toHaveLength(DESTINATIONS.length)
    const unverified = DESTINATIONS.filter(x => !(x.verified.lufs && x.verified.tp)).length
    expect(within(d).getAllByText('미확인·보수적 값')).toHaveLength(unverified)
  })
  it('모듈 탭에 14 모듈이 화면 이름으로 나온다', () => {
    const d = open()
    fireEvent.click(within(d).getByRole('tab', { name: '모듈별 설명' }))
    for (const label of Object.values(MODULE_LABEL)) expect(within(d).getByRole('heading', { name: label })).toBeTruthy()
  })
  it('Esc 로 닫힌다', () => {
    open()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('닫기 X 로 닫힌다', () => {
    const d = open()
    fireEvent.click(within(d).getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('설명서 내용이 화면과 일치', () => {
  it('모듈 설명이 MODULE_LABEL 의 14개 모듈을 한 번씩 정확히 가리킨다', () => {
    const slots = Object.keys(MODULE_LABEL)
    expect(MODULE_HELP.map(m => m.slot).sort()).toEqual([...slots].sort())
    expect(slots).toHaveLength(14)
  })
  it('추천값이 defaultChain 과 같다', () => {
    const c = defaultChain()
    expect(moduleRecommend('limiter')).toContain(`천장 ${c.limiter.ceiling} dB`)
    expect(moduleRecommend('comp')).toContain(`기준 ${c.comp.threshold} dB`)
    expect(moduleRecommend('stereo')).toContain(`넓이 ${c.stereo.width}%`)
  })
})
