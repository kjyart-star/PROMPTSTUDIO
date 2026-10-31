export type LibraryKind = 'all' | 'vocal' | 'instrumental'
export type LibrarySort = 'newest' | 'oldest' | 'title' | 'playlist'

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
  if (q.sort === 'playlist') {
    const ord = (i: T) => (Number.isInteger(i.playlist_order) ? (i.playlist_order as number) : Number.MAX_SAFE_INTEGER)
    out.sort((a, b) => ord(a) - ord(b) || time(b) - time(a))
  } else if (q.sort === 'oldest') out.sort((a, b) => time(a) - time(b))
  else if (q.sort === 'title') out.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ko'))
  else out.sort((a, b) => time(b) - time(a))
  return out
}

/** 재생목록 순서에서 한 칸 옮긴 뒤, 바뀐 곡들의 새 순번만 돌려준다 */
export function moveInOrder(ordered: { id: string; playlist_order?: number | null }[], id: string, dir: -1 | 1): { id: string; order: number }[] {
  const i = ordered.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ordered.length) return []
  const next = [...ordered]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next.map((x, k) => ({ id: x.id, order: k })).filter((x, k) => ordered.find((o) => o.id === x.id)?.playlist_order !== k)
}
