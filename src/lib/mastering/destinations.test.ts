import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESTINATIONS, DEFAULT_DESTINATION, destinationById, exportOptsFor, DERIVATIVES } from './destinations'
import { USE_CARDS } from './compose'
import type { ExportOpts } from '@/components/studio/mastering/actions'

const docs = readFileSync(join(process.cwd(), 'docs/mastering-destinations.md'), 'utf8')

describe('destinations', () => {
  it('8개, id 유니크, album 이 첫째', () => {
    expect(DESTINATIONS).toHaveLength(8)
    expect(new Set(DESTINATIONS.map(d => d.id)).size).toBe(8)
    expect(DESTINATIONS[0].id).toBe('album')
    expect(DEFAULT_DESTINATION).toBe('album')
    expect(destinationById('nope').id).toBe('album')
  })
  it('모든 sources 에 url·checked', () => {
    for (const d of DESTINATIONS) {
      expect(d.sources.length).toBeGreaterThan(0)
      for (const s of d.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.checked).toBe('2026-10-21'); expect(['confirmed', 'secondary', 'unread']).toContain(s.grade) }
    }
  })
  it('useId 는 compose 의 용도, 파생본 id 는 유효', () => {
    const uses = USE_CARDS.map(u => u.id)
    for (const d of DESTINATIONS) { expect(uses).toContain(d.useId); expect(DERIVATIVES[d.id]).toBeDefined() }
    for (const ids of Object.values(DERIVATIVES)) for (const i of ids) expect(DESTINATIONS.some(d => d.id === i)).toBe(true)
  })
  it('verified=false 필드가 있으면 docs 에 「미확인」 표기', () => {
    for (const d of DESTINATIONS) {
      if (Object.values(d.verified).every(Boolean)) continue
      const row = docs.split('\n').find(l => l.includes(d.label.split(' (')[0]))
      expect(row, d.id).toBeTruthy()
      expect(row).toContain('미확인')
    }
    expect(docs).toContain('미확인')
  })
  it('방송·광고 트루피크는 ATSC 확인값 -2, 확인 표시는 확인 출처가 있을 때만', () => {
    for (const id of ['broadcast', 'ad'] as const) {
      const d = destinationById(id)
      expect(d.lufs).toBe(-24); expect(d.tp).toBe(-2)
      expect(d.sources.some(s => s.grade === 'confirmed')).toBe(true)
    }
    for (const d of DESTINATIONS) if (Object.values(d.verified).some(Boolean)) expect(d.sources.some(s => s.grade === 'confirmed'), d.id).toBe(true)
  })
  it('exportOptsFor 는 ExportOpts 형태', () => {
    for (const d of DESTINATIONS) {
      const o: Omit<ExportOpts, 'range'> = exportOptsFor(d)
      expect(['wav', 'mp3']).toContain(o.format)
      expect(['none', 'tpdf', 'shaped']).toContain(o.dither)
    }
    expect(exportOptsFor(destinationById('album')).dither).toBe('shaped')
    expect(exportOptsFor(destinationById('stream')).dither).toBe('none')
  })
})
