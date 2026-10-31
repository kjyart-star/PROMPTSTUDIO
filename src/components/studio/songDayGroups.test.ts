import { describe, it, expect } from 'vitest'
import { groupSongsByDay } from './songDayGroups'

describe('groupSongsByDay', () => {
  const now = new Date(2026, 10, 1, 15, 0)
  it('오늘·어제·그 밖의 날짜로 묶고 순서를 지킨다', () => {
    const songs = [
      { id: 1, created_at: new Date(2026, 10, 1, 9).toISOString() },
      { id: 2, created_at: new Date(2026, 10, 1, 1).toISOString() },
      { id: 3, created_at: new Date(2026, 9, 31, 22).toISOString() },
      { id: 4, created_at: new Date(2026, 9, 20, 12).toISOString() },
      { id: 5, created_at: null },
    ]
    const g = groupSongsByDay(songs, 'KO', now)
    expect(g.map((x) => x.label)).toEqual(['오늘', '어제', '10월 20일', '날짜 없음'])
    expect(g[0].items.map((s) => s.id)).toEqual([1, 2])
  })
  it('다른 해는 연도를 붙인다', () => {
    const g = groupSongsByDay([{ created_at: new Date(2025, 0, 3).toISOString() }], 'KO', now)
    expect(g[0].label).toContain('2025')
  })
})
