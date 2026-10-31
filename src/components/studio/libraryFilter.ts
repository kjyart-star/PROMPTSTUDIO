export type LibraryKind = 'all' | 'vocal' | 'instrumental'
export type LibrarySort = 'newest' | 'oldest' | 'title'

export interface LibraryQuery {
  query: string
  kind: LibraryKind
  sort: LibrarySort
  /** 재생목록(폴더) 한정 — 없으면 전체 */
  playlistId?: string | null
}

/** 연주곡 여부 — 생성 때 켠 「연주곡만」 값, 없으면 가사가 비었는지로 본다 */
export function isInstrumental(item: any): boolean {
  if (typeof item?.form?.instrumentalOnly === 'boolean') return item.form.instrumentalOnly
  return !String(item?.lyrics || '').trim()
}

/** 제목·스타일·가사 검색 + 종류 필터 + 정렬. 원본 배열은 건드리지 않는다. */
export function filterLibrary<T extends Record<string, any>>(items: T[], q: LibraryQuery): T[] {
  const needle = q.query.trim().toLowerCase()
  const out = items.filter((item) => {
    if (q.playlistId && item.playlist_id !== q.playlistId) return false
    if (q.kind === 'instrumental' && !isInstrumental(item)) return false
    if (q.kind === 'vocal' && isInstrumental(item)) return false
    if (!needle) return true
    const hay = [item.title, item.style, item.style_desc, item.prompt, item.lyrics].map((v) => String(v || '').toLowerCase()).join('\n')
    return hay.includes(needle)
  })
  const time = (i: T) => new Date(i.created_at || 0).getTime()
  if (q.sort === 'oldest') out.sort((a, b) => time(a) - time(b))
  else if (q.sort === 'title') out.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko'))
  else out.sort((a, b) => time(b) - time(a))
  return out
}
