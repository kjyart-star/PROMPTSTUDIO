import { describe, it, expect } from 'vitest'
import { hasSyncedLrc, holdExpired, needsSync, releaseIfSynced } from './publishGate'

const lrc = [{ t: 1, text: '첫째 줄' }, { t: 9, text: '둘째 줄' }]

describe('공개 전 가사 싱크 보장', () => {
  it('가사 줄이 2줄 이상이면 싱크가 필요하고, 경음악·시간 표시 가사는 아니다', () => {
    expect(needsSync({ lyrics: '[Verse]\n첫째 줄\n둘째 줄' })).toBe(true)
    expect(needsSync({ lyrics: '[Instrumental]' })).toBe(false)
    expect(needsSync({ lyrics: '[00:01.00]첫째 줄\n[00:09.00]둘째 줄' })).toBe(false)
  })
  it('사람이 고친 시간표나 읽을 수 있는 판의 자동 결과가 있어야 싱크된 것', () => {
    expect(hasSyncedLrc({ lrc_by: 'user', lrc })).toBe(true)
    expect(hasSyncedLrc({ lrc_auto: lrc, lrc_auto_v: 5 })).toBe(true)
    expect(hasSyncedLrc({ lrc_auto: lrc, lrc_auto_v: 2 })).toBe(false)
    expect(hasSyncedLrc({})).toBe(false)
  })
  it('공개 대기 곡은 시간표가 생기는 순간 공개로 바뀌고, 대기하지 않던 곡은 건드리지 않는다', () => {
    const r = releaseIfSynced({ publish_pending: { at: '2026-11-02T00:00:00Z' }, lrc_auto: lrc, lrc_auto_v: 5 })
    expect(r.is_published).toBe(true)
    expect(r.form.publish_pending).toBeUndefined()
    expect(releaseIfSynced({ publish_pending: { at: 'x' } })).toEqual({})
    expect(releaseIfSynced({ lrc_auto: lrc, lrc_auto_v: 5 })).toEqual({})
  })
  it('공개 대기는 24시간이 지나면 끝난다', () => {
    const at = '2026-11-02T00:00:00Z'
    expect(holdExpired({ publish_pending: { at } }, Date.parse('2026-11-02T23:59:00Z'))).toBe(false)
    expect(holdExpired({ publish_pending: { at } }, Date.parse('2026-11-03T00:00:01Z'))).toBe(true)
  })
})
