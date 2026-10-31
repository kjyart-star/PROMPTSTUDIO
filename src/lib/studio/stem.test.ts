import { describe, it, expect } from 'vitest'
import { stemAvailability, variantIndex, pickStems, stemIdempotencyKey } from './stem'

const song = (o: any = {}) => ({ status: 'completed', audio_url: 'audio/a.mp3', suno_task_id: 'apipass:T', form: { suno_audio_id: 'A' }, ...o })

describe('스템 가능 여부 — 메뉴에서 눌러 보고 실패하는 일이 없게', () => {
  it('Suno(APIPASS) 곡 id 가 남은 완성곡만 ready', () => {
    expect(stemAvailability(song())).toBe('ready')
    expect(stemAvailability(song({ suno_task_id: 'task_old' }))).toBe('ready') // 접두사 없는 옛 id 는 apipass
  })
  it('올린 파일·kie·id 없음·미완성·음원 없음은 none', () => {
    expect(stemAvailability(song({ form: { source: 'upload', suno_audio_id: 'A' } }))).toBe('none')
    expect(stemAvailability(song({ suno_task_id: 'kie:T' }))).toBe('none')
    expect(stemAvailability(song({ form: {} }))).toBe('none')
    expect(stemAvailability(song({ status: 'processing' }))).toBe('none')
    expect(stemAvailability(song({ audio_url: null }))).toBe('none')
    expect(stemAvailability(song({ suno_task_id: null }))).toBe('none')
  })
  it('진행·완료 상태는 그대로 반영', () => {
    expect(stemAvailability(song({ form: { stems: { status: 'done' } } }))).toBe('view')
    expect(stemAvailability(song({ form: { stems: { status: 'processing' } } }))).toBe('busy')
  })
  it('보조 함수', () => {
    expect(variantIndex('곡 (v2)')).toBe(1)
    expect(variantIndex('곡')).toBe(0)
    expect(pickStems([{ type: 'instrumental', audio_url: 'i' }, { type: 'vocals', audio_url: 'v' }])).toEqual({ vocals: 'v', instrumental: 'i' })
    expect(pickStems([{ type: 'vocals', audio_url: 'v' }])).toBeNull()
    expect(stemIdempotencyKey('u', 'h', { status: 'failed', attempt: 1 })).toBe('music.stem2:u:h:2')
  })
})
