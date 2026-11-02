// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import type { Analysis } from '@/lib/mastering/analyze'

const m = vi.hoisted(() => ({ decode: vi.fn(), analyze: vi.fn(), fetchBlob: vi.fn() }))
vi.mock('@/lib/mastering/render', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/mastering/render')>()), decodeAudio: m.decode }))
vi.mock('@/lib/mastering/analyze', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/mastering/analyze')>()), analyzeAudio: m.analyze }))
vi.mock('./actions', async importOriginal => ({ ...(await importOriginal<typeof import('./actions')>()), fetchSongBlob: m.fetchBlob }))

import { ReleaseCheckDialog } from './ReleaseCheckDialog'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const analysis = (o: Partial<Analysis> = {}): Analysis => ({
  duration: 1, sampleRate: 44100, integrated: -6.5, lra: 5, maxMomentary: -4, maxShortTerm: -5, truePeak: 0.3, samplePeak: 0, rmsDb: -8, crest: 8, plr: 6.8,
  psrAvg: 6, psrMin: 4, shortSeries: new Float32Array(), momentarySeries: new Float32Array(), clips: [], clipSamples: 40, bands: [],
  spectrogram: { cols: 0, rows: 0, data: new Uint8Array(), fMin: 30, fMax: 20000 }, correlation: 0.7, sideLowDb: -20, sibilanceDb: -12,
  harsh: { hfMeanDb: -30, hfPeakDb: -24, flatness: 0.2, spikeDb: 5, bulgeDb: 13.5, frames: 100 }, ...o,
})

describe('발매 점검 단독 도구', () => {
  it('파일을 고르면 이 브라우저에서 분석해 6항목 신호등과 원인·해결 방법을 보여 준다', async () => {
    m.decode.mockResolvedValue({ channels: [new Float32Array(4), new Float32Array(4)], sampleRate: 44100, duration: 1 })
    m.analyze.mockResolvedValue(analysis())
    const onMaster = vi.fn(), onClose = vi.fn()
    render(<ReleaseCheckDialog onClose={onClose} pickFromLibrary={() => {}} onMaster={onMaster} />)
    const d = screen.getByRole('dialog', { name: '발매 점검' })
    expect(within(d).getByText(/어디에도 올리지 않고/)).toBeTruthy()
    // 둘러보기 말풍선(z 91)보다 위, 보관함 선택 창(z 96)보다 아래
    expect(d.className).toContain('z-[95]')
    const input = d.querySelector('input[type="file"]') as HTMLInputElement
    // jsdom 의 Blob 에는 arrayBuffer 가 없을 수 있다
    const file = Object.assign(new File([new Uint8Array(16)], '내 곡.wav', { type: 'audio/wav' }), { arrayBuffer: async () => new ArrayBuffer(16) })
    fireEvent.change(input, { target: { files: [file] } })
    const card = await within(d).findByTestId('release-check')
    expect(m.analyze.mock.calls[0][2]).toMatchObject({ harsh: true })
    const st = Object.fromEntries([...card.querySelectorAll('[data-check]')].map(e => [e.getAttribute('data-check'), e.getAttribute('data-status')]))
    expect(st).toEqual({ loudness: 'warn', truePeak: 'bad', clipping: 'bad', dynamics: 'warn', mono: 'ok', harsh: 'warn' })
    expect(within(card).getByLabelText('원인과 해결 방법').querySelectorAll('li').length).toBe(5)
    fireEvent.click(within(d).getByRole('button', { name: '이 곡 마스터링하기' }))
    expect(onMaster).toHaveBeenCalledWith({ file })
    expect(onClose).toHaveBeenCalled()
  })

  it('보관함에서 고른 곡은 저장소에서 받아 와 분석한다(업로드 없음)', async () => {
    m.fetchBlob.mockResolvedValue(Object.assign(new Blob([new Uint8Array(8)]), { arrayBuffer: async () => new ArrayBuffer(8) }))
    m.decode.mockResolvedValue({ channels: [new Float32Array(4), new Float32Array(4)], sampleRate: 44100, duration: 1 })
    m.analyze.mockResolvedValue(analysis({ integrated: -14, truePeak: -1.2, clipSamples: 0, plr: 12, harsh: undefined }))
    const pick = vi.fn((cb: (s: { id: string; title: string; audio_url: string }) => void) => cb({ id: 'a', title: '보관함 곡', audio_url: 'a.mp3' }))
    render(<ReleaseCheckDialog onClose={() => {}} pickFromLibrary={pick} onMaster={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /보관함에서 고르기/ }))
    const card = await screen.findByTestId('release-check')
    expect(m.fetchBlob).toHaveBeenCalled()
    expect(within(card).getByText('발매 점검 통과')).toBeTruthy()
  })
})
