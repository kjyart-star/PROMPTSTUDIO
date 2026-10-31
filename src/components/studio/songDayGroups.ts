/** 곡 목록을 만든 날짜(현지 시간)별로 묶는다 — 들어온 순서를 그대로 지킨다. */
export interface SongDayGroup<T> {
  key: string
  label: string
  items: T[]
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export function groupSongsByDay<T extends { created_at?: string | null }>(
  songs: T[],
  lang: string,
  now: Date = new Date(),
): SongDayGroup<T>[] {
  const today = dayKey(now)
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  const yesterday = dayKey(y)
  const locale = lang === 'KO' ? 'ko-KR' : lang === 'JA' ? 'ja-JP' : 'en-US'

  const groups: SongDayGroup<T>[] = []
  for (const song of songs) {
    const d = song.created_at ? new Date(song.created_at) : null
    const valid = d && !Number.isNaN(d.getTime())
    const key = valid ? dayKey(d!) : 'unknown'
    let group = groups.find((g) => g.key === key)
    if (!group) {
      let label: string
      if (!valid) label = lang === 'KO' ? '날짜 없음' : lang === 'JA' ? '日付なし' : 'No date'
      else if (key === today) label = lang === 'KO' ? '오늘' : lang === 'JA' ? '今日' : 'Today'
      else if (key === yesterday) label = lang === 'KO' ? '어제' : lang === 'JA' ? '昨日' : 'Yesterday'
      else
        label = d!.toLocaleDateString(locale, {
          month: 'long',
          day: 'numeric',
          ...(d!.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
        })
      group = { key, label, items: [] }
      groups.push(group)
    }
    group.items.push(song)
  }
  return groups
}
