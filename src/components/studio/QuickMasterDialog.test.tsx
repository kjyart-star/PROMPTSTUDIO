// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react'
import { defaultChain } from '@/lib/mastering/presets'
import { releaseCheck } from '@/lib/mastering/releaseCheck'
import type { Analysis } from '@/lib/mastering/analyze'

const qm = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('./mastering/quickMaster', async importOriginal => {
  const orig = await importOriginal<typeof import('./mastering/quickMaster')>()
  return { ...orig, quickMaster: qm.run }
})

import QuickMasterDialog from './QuickMasterDialog'
import { matchedVolumes } from './mastering/ABCompare'

afterEach(() => { cleanup(); qm.run.mockReset() })

const song = { id: 's1', title: '테스트 곡', audio_url: 'x.mp3' }
const a = (o: Partial<Analysis>): Analysis => ({
  duration: 1, sampleRate: 44100, integrated: -12, lra: 5, maxMomentary: -8, maxShortTerm: -9, truePeak: -1.1, samplePeak: -1.2, rmsDb: -14, crest: 12, plr: 10.9,
  psrAvg: 8, psrMin: 6, shortSeries: new Float32Array(), momentarySeries: new Float32Array(), clips: [], clipSamples: 0, bands: [],
  spectrogram: { cols: 0, rows: 0, data: new Uint8Array(), fMin: 30, fMax: 20000 }, correlation: 0.8, sideLowDb: -20, sibilanceDb: -12,
  harsh: { hfMeanDb: -30, hfPeakDb: -24, flatness: 0.2, spikeDb: 5, bulgeDb: 10, frames: 100 }, ...o,
})

function open(onAdvanced = vi.fn()) {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }))
  render(<QuickMasterDialog song={song} onClose={() => {}} onDone={() => {}} onAdvanced={onAdvanced} />)
  return screen.getByRole('dialog', { name: '마스터링' })
}

describe('간단 마스터링 마감', () => {
  it('음량은 조용하게·보통·크게 3단이고, 용도를 고르면 어울리는 음량이 먼저 골라진다', () => {
    const d = open()
    const loud = within(d).getByRole('group', { name: '음량' })
    const chips = within(loud).getAllByRole('button')
    expect(chips.map(b => b.textContent?.replace(/약.*/, ''))).toEqual(['조용하게', '보통', '크게'])
    expect(within(loud).getByRole('button', { name: /조용하게/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(within(d).getByLabelText('어디에 쓸 곡인가요'), { target: { value: 'use-club' } })
    expect(within(loud).getByRole('button', { name: /크게/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('AI 곡 고음 정리는 기본 「자연스럽게」, 고른 값이 처리로 넘어간다', async () => {
    const d = open()
    const g = within(d).getByRole('group', { name: 'AI 곡 고음 정리' })
    expect(within(g).getByRole('button', { name: '자연스럽게' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(g).getByRole('button', { name: '강하게' }))
    qm.run.mockRejectedValueOnce(new Error('cancelled'))
    fireEvent.click(within(d).getByRole('button', { name: '마스터링 시작' }))
    await waitFor(() => expect(qm.run).toHaveBeenCalled())
    expect(qm.run.mock.calls[0][1]).toMatchObject({ aiClean: 'strong', use: 'use-stream', lufs: -14 })
  })

  it('결과 뒤: 신호등 6항목 카드 · 음량 맞춘 전후 비교 · 「고급 마스터링에서 이어서」가 설정을 그대로 넘긴다', async () => {
    const params = defaultChain(); params.limiter.gain = 7.7
    const checks = releaseCheck(a({ truePeak: 0.4 }), { lufs: -12, tp: -1 })
    qm.run.mockResolvedValueOnce({
      id: 'n1', title: '테스트 곡 (마스터링)', integrated: -12.1, truePeak: -1.1, targetLufs: -12, makeWav: vi.fn(),
      checks, srcChecks: checks, retried: ['천장을 -1.9 dB 로 낮춤'], aiCleanMaxCut: -3.2,
      srcBlob: new Blob(['a']), outBlob: new Blob(['b']), srcIntegrated: -16, params,
      options: { lufs: -12, tp: -1, tone: 'balanced', use: 'use-stream', aiClean: 'natural', genre: 'pop' },
    })
    const onAdvanced = vi.fn()
    const d = open(onAdvanced)
    fireEvent.click(within(d).getByRole('button', { name: '마스터링 시작' }))
    const card = await within(d).findByTestId('release-check')
    expect(card.querySelectorAll('[data-check]')).toHaveLength(6)
    expect(card.querySelector('[data-check="truePeak"]')!.getAttribute('data-status')).toBe('bad')
    expect(within(card).getByText(/자동으로 한 번 다시 처리했어요/)).toBeTruthy()
    expect(within(card).getByText(/줄인 고음: 최대 -3.2 dB/)).toBeTruthy()
    const ab = within(d).getByLabelText('전후 비교 듣기')
    expect(within(ab).getByRole('button', { name: '마스터링' }).getAttribute('aria-pressed')).toBe('true')
    expect((within(ab).getByRole('checkbox', { name: /음량 맞춰 비교/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(d).getByRole('button', { name: '고급 마스터링에서 이어서' }))
    expect(onAdvanced).toHaveBeenCalledOnce()
    const h = onAdvanced.mock.calls[0][0]
    expect(h.params.limiter.gain).toBe(7.7)
    expect(h.target).toMatchObject({ lufs: -12, tp: -1 })
    expect(h.song.id).toBe('s1')
  })
})

describe('음량 맞춤 볼륨', () => {
  it('큰 쪽만 줄인다', () => {
    const v = matchedVolumes(-16, -10, true)
    expect(v.a).toBe(1)
    expect(v.b).toBeCloseTo(Math.pow(10, -6 / 20), 5)
    expect(matchedVolumes(-16, -10, false)).toEqual({ a: 1, b: 1 })
    expect(matchedVolumes(-8, -10, true).a).toBeLessThan(1)
  })
})
