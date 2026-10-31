import { describe, it, expect } from 'vitest'
import { filterLibrary, isInstrumental } from './libraryFilter'

const items = [
  { id: '1', title: 'Rain', style: 'city pop', lyrics: '비가 와', created_at: '2026-10-01', form: { instrumentalOnly: false } },
  { id: '2', title: 'Beat', style: 'lofi', lyrics: '', created_at: '2026-10-03', form: { instrumentalOnly: true } },
  { id: '3', title: 'Alpha', style: 'rock', lyrics: 'night', created_at: '2026-10-02' },
]
const q = (o = {}) => ({ query: '', kind: 'all' as const, sort: 'newest' as const, ...o })

describe('filterLibrary', () => {
  it('최신순·오래된순·제목순', () => {
    expect(filterLibrary(items, q()).map((i) => i.id)).toEqual(['2', '3', '1'])
    expect(filterLibrary(items, q({ sort: 'oldest' })).map((i) => i.id)).toEqual(['1', '3', '2'])
    expect(filterLibrary(items, q({ sort: 'title' })).map((i) => i.id)).toEqual(['3', '2', '1'])
  })
  it('제목·스타일·가사 검색', () => {
    expect(filterLibrary(items, q({ query: '비가' })).map((i) => i.id)).toEqual(['1'])
    expect(filterLibrary(items, q({ query: 'LOFI' })).map((i) => i.id)).toEqual(['2'])
  })
  it('경음악/보컬 구분, 값이 없으면 가사로 판단', () => {
    expect(filterLibrary(items, q({ kind: 'instrumental' })).map((i) => i.id)).toEqual(['2'])
    expect(filterLibrary(items, q({ kind: 'vocal' })).map((i) => i.id)).toEqual(['3', '1'])
    expect(isInstrumental({ lyrics: '  ' })).toBe(true)
  })
  it('재생목록(폴더)로 좁힌다', () => {
    const withPl = [{ ...items[0], playlist_id: 'p1' }, items[1]]
    expect(filterLibrary(withPl, q({ playlistId: 'p1' })).map((i) => i.id)).toEqual(['1'])
  })
  it('원본 배열은 바뀌지 않는다', () => {
    const copy = [...items]
    filterLibrary(items, q({ sort: 'title' }))
    expect(items).toEqual(copy)
  })
})
