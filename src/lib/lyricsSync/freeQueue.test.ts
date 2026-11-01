import { describe, it, expect } from 'vitest'
import { freeJobsOf } from './freeQueue'

const now = Date.parse('2026-11-02T12:00:00Z')
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const row = (id: string, form: any = {}, extra: any = {}) => ({ id, audio_url: `audio/${id}.mp3`, lyrics: '첫째 줄\n둘째 줄\n셋째 줄', status: 'completed', created_at: ago(60), form, ...extra })
const lrc = [{ t: 1, text: '첫째 줄' }, { t: 9, text: '둘째 줄' }, { t: 20, text: '셋째 줄' }]

describe('Workers AI 무료 큐 순서', () => {
  it('공개 대기 → 폰에서 만든 곡 → 오래 기다린 곡 → 재생 많은 곡', () => {
    const rows = [
      row('plays', { play_count: 99 }),
      row('mobile', { client_platform: 'mobile' }, { created_at: ago(1) }),
      row('pending', { publish_pending: { at: ago(30) } }),
      row('pendingMobile', { publish_pending: { at: ago(2) }, client_platform: 'mobile' }),
      row('old', {}, { created_at: ago(600) }),
    ]
    expect(freeJobsOf(rows, now).fill.map((j) => j.id)).toEqual(['pendingMobile', 'pending', 'mobile', 'old', 'plays'])
  })
  it('PC 에서 막 만든 곡은 만든 사람 브라우저에 10분을 준다', () => {
    expect(freeJobsOf([row('fresh', {}, { created_at: ago(3) })], now).fill).toHaveLength(0)
    expect(freeJobsOf([row('fresh', { client_platform: 'mobile' }, { created_at: ago(3) })], now).fill).toHaveLength(1)
  })
  it('시간표가 있거나 경음악·접은 곡·최근 실패 곡은 채우지 않고, 브라우저 결과 공개 곡은 검수에 넣는다', () => {
    const rows = [
      row('done', { lrc_auto: lrc, lrc_auto_v: 5, lrc_auto_model: 'browser-whisper-base', play_count: 3 }, { is_published: true }),
      row('gpu', { lrc_auto: lrc, lrc_auto_v: 4, lrc_auto_model: 'gpu-whisper-large-v3' }, { is_published: true }),
      row('inst', {}, { lyrics: '[Instrumental]' }),
      row('failed', { lrc_auto_fail: { v: 4 } }),
      row('retry', { lrc_free_fail: { at: ago(60) } }),
      row('audited', { lrc_auto: lrc, lrc_auto_v: 5, lrc_auto_model: 'browser-whisper-base', lrc_audit: { at: ago(5) } }, { is_published: true }),
    ]
    const j = freeJobsOf(rows, now)
    expect(j.fill).toHaveLength(0)
    expect(j.audit.map((x) => x.id)).toEqual(['done'])
  })
})
